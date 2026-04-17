"""ReAct agent orchestrator — the core of EVA Agentic's chat pipeline.

Replaces MSIA's hardcoded linear approach with an observable, tool-calling
agent loop.  Every step is streamed as NDJSON for real-time UI transparency.
"""

from __future__ import annotations

import json
import time
import uuid
from collections.abc import AsyncGenerator

from ..guardrails.degradation import DegradationManager, DependencyStatus
from ..provenance.correlation import generate_correlation_id
from ..provenance.models import (
    AgentStep,
    BehavioralFingerprint,
    Citation,
    ConfidenceFactors,
    ExplainabilityRecord,
    FreshnessInfo,
    ModelSnapshot,
)
from ..provenance.tracker import ProvenanceTracker
from ..stores.compat import aio
from ..stores.prompt_store import PromptStore
from ..stores.workspace_store import WorkspaceStore
from ..tools.registry import ToolRegistry

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL_ID = "gpt-5.1-2026-04"
_PROMPT_VERSION = "v3.2"
_CORPUS_SNAPSHOT = "2026-04-10"
_POLICY_RULES_VERSION = "v1.4"
_UNGROUNDED_DEFAULT_CONFIDENCE = 0.5

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_QUERY_REWRITE_SYSTEM = """\
You are a search-query optimizer for a Canadian government knowledge base.
Given a user question and conversation history, produce a single optimized
search query that maximizes retrieval recall.

Rules:
- Keep the query concise (under 40 words).
- Include key terms from the user's question.
- Expand acronyms when obvious (OAS → Old Age Security).
- If the conversation provides context, incorporate it.
- Output ONLY the query string, nothing else.
"""

_RAG_SYSTEM = """\
You are EVA, a bilingual (EN/FR) assistant for Employment and Social \
Development Canada (ESDC). Answer the user's question based ONLY on the \
provided sources. Follow these rules strictly:

1. Ground every claim in the sources. Use inline citations like [1], [2].
2. If the sources do not contain enough information, say so explicitly.
3. Respond in the same language the user used.
4. Be concise, professional, and accurate.
5. Never fabricate information beyond what the sources provide.

Sources:
{sources}
"""

_UNGROUNDED_SYSTEM = """\
You are EVA, a bilingual (EN/FR) assistant for Employment and Social \
Development Canada (ESDC). You are operating in ungrounded mode — no \
document retrieval is performed. Respond helpfully based on your general \
knowledge. Always clarify that your answer is not grounded in official \
ESDC documents and may not reflect current policy.
"""


def _build_source_block(search_results: list[dict]) -> str:
    """Format search results into a numbered source block for the RAG prompt."""
    parts: list[str] = []
    for i, result in enumerate(search_results, start=1):
        section = result.get("section", "")
        page = result.get("page", "")
        file = result.get("file", "")
        content = result.get("content", "")
        header = f"[{i}] {file}"
        if page:
            header += f", page {page}"
        if section:
            header += f", {section}"
        parts.append(f"{header}\n{content}")
    return "\n\n".join(parts)


class MockModelClient:
    """Fallback model client that produces deterministic mock responses.

    Used when no real Azure OpenAI client is available (local dev, tests).
    """

    async def generate_query(self, system: str, user_message: str, history: list[dict]) -> str:
        """Generate an optimized search query from the user message."""
        return user_message

    async def stream_completion(
        self, system: str, messages: list[dict]
    ) -> AsyncGenerator[str, None]:
        """Stream completion tokens."""
        response = (
            "Based on the available sources, here is the information "
            "relevant to your question. The policy framework outlines "
            "the eligibility criteria and procedural requirements [1]. "
            "Additional details regarding timelines and exceptions can "
            "be found in the supplementary guidelines [2]."
        )
        # Simulate token-by-token streaming
        words = response.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")


class AgentOrchestrator:
    """ReAct orchestrator — plans tools, executes them, reflects, yields NDJSON events.

    The orchestrator drives the full chat pipeline:
    - Grounded mode: query rewrite -> search -> cite -> RAG answer
    - Ungrounded mode: direct completion without tool calls

    Every step emits NDJSON events for real-time UI rendering and full
    provenance tracking.
    """

    def __init__(
        self,
        tool_registry: ToolRegistry,
        model_client=None,
        trace_id: str | None = None,
        prompt_store: PromptStore | None = None,
        degradation_manager: DegradationManager | None = None,
        workspace_store: WorkspaceStore | None = None,
        model_registry_store=None,
    ) -> None:
        self.tool_registry = tool_registry
        self.model_client = model_client or MockModelClient()
        self.trace_id = trace_id or "local"
        self.prompt_store = prompt_store
        self.degradation_manager = degradation_manager
        self.workspace_store = workspace_store
        self.model_registry_store = model_registry_store

    # ------------------------------------------------------------------
    # Prompt resolution helpers
    # ------------------------------------------------------------------

    async def _snapshot_model(self, deployment_name: str) -> ModelSnapshot | None:
        """Capture point-in-time model config for provenance.

        Six months later, this snapshot tells you exactly which model version,
        with which parameters, enabled by whom, was used for this response.
        """
        if not self.model_registry_store:
            return None
        model = await aio(self.model_registry_store.get_model(deployment_name))
        if not model:
            return None
        history = model.change_history
        last_change = history[-1] if history else {}
        return ModelSnapshot(
            deployment_name=model.deployment_name or model.id,
            model_name=model.model_name,
            model_version=model.model_version,
            provider=model.provider,
            endpoint=model.endpoint,
            sku=model.sku,
            cost_model=model.cost_model,
            parameter_overrides=model.parameter_overrides,
            config_version=len(history),
            last_changed_by=last_change.get("author", "system-seed"),
            last_changed_at=last_change.get("timestamp", model.model_version),
        )

    async def _resolve_prompt(self, name: str, fallback: str) -> tuple[str, str]:
        """Return (content, version_label) from prompt_store or fallback."""
        if self.prompt_store:
            pv = await aio(self.prompt_store.get_active(name))
            if pv:
                return pv.content, f"{name}:v{pv.version}"
        return fallback, _PROMPT_VERSION

    async def run(
        self,
        user_message: str,
        conversation_history: list[dict],
        workspace_id: str | None = None,
        mode: str = "grounded",
        overrides: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        """Execute the agent loop, yielding NDJSON lines.

        Parameters
        ----------
        user_message : str
            The current user message.
        conversation_history : list[dict]
            Previous messages in ``{"role": ..., "content": ...}`` format.
        workspace_id : str | None
            Workspace to scope search to.
        mode : str
            ``"grounded"`` (RAG with citations) or ``"ungrounded"`` (direct GPT).
        overrides : dict | None
            Optional parameter overrides (top_k, temperature, etc.).

        Yields
        ------
        str
            NDJSON lines — each line is a JSON object followed by ``\\n``.
        """
        correlation_id = generate_correlation_id()
        conversation_id = str(uuid.uuid4())
        message_id = str(uuid.uuid4())
        tracker = ProvenanceTracker(
            correlation_id=correlation_id,
            agent_id="eva-rag-agent",
            trace_id=self.trace_id,
        )

        # Emit initial provenance (informational header — frontend ignores)
        yield (
            json.dumps(
                {
                    "provenance": {
                        "correlation_id": correlation_id,
                        "trace_id": self.trace_id,
                    },
                }
            )
            + "\n"
        )

        # Check circuit breakers before dispatching
        dm = self.degradation_manager
        openai_down = dm and dm.get_status("openai") == DependencyStatus.DOWN
        search_down = dm and dm.get_status("search") == DependencyStatus.DOWN

        if openai_down:
            # OpenAI breaker open — cannot generate any response
            yield (
                json.dumps(
                    {
                        "content": "Service temporarily unavailable. Please try again later. / "
                        "Service temporairement indisponible. Veuillez r\u00e9essayer plus tard.",
                    }
                )
                + "\n"
            )
            yield (
                json.dumps(
                    {
                        "degradation": {
                            "status": "unavailable",
                            "service": "openai",
                        },
                    }
                )
                + "\n"
            )
        elif mode == "ungrounded" or (mode == "grounded" and search_down):
            # Ungrounded mode, or grounded but search is down — fall back to ungrounded
            if search_down and mode == "grounded":
                yield (
                    json.dumps(
                        {
                            "degradation": {
                                "status": "partial",
                                "service": "search",
                                "notice_en": "Document search temporarily unavailable. Answering from general knowledge.",
                                "notice_fr": "Recherche de documents temporairement indisponible. R\u00e9ponse \u00e0 partir des connaissances g\u00e9n\u00e9rales.",
                            },
                        }
                    )
                    + "\n"
                )
            async for line in self._run_ungrounded(
                user_message,
                conversation_history,
                tracker,
                conversation_id,
                message_id,
                overrides,
            ):
                yield line
        else:
            async for line in self._run_grounded(
                user_message,
                conversation_history,
                workspace_id,
                tracker,
                conversation_id,
                message_id,
                overrides,
            ):
                yield line

        # Final provenance record
        provenance = tracker.build()
        yield (
            json.dumps(
                {
                    "provenance_complete": provenance.model_dump(),
                }
            )
            + "\n"
        )

        # Explainability record (separate event)
        if tracker.explainability:
            yield (
                json.dumps(
                    {
                        "explainability": tracker.explainability.model_dump(),
                    }
                )
                + "\n"
            )

    # ------------------------------------------------------------------
    # Grounded mode (RAG)
    # ------------------------------------------------------------------

    async def _run_grounded(
        self,
        user_message: str,
        history: list[dict],
        workspace_id: str | None,
        tracker: ProvenanceTracker,
        conversation_id: str,
        message_id: str,
        overrides: dict | None,
    ) -> AsyncGenerator[str, None]:
        """ReAct loop: query rewrite -> search -> cite -> answer."""

        top_k = (overrides or {}).get("top_k", 5)
        tracker.add_policy_applied("grounding-required")
        tracker.add_policy_applied("protected-b-boundary")

        # ---- Step 1: Query rewrite ----
        step_id = tracker.add_step(
            "query_rewrite",
            "Optimizing search query",
            "Optimisation de la requ\u00eate de recherche",
        )
        yield self._step_event(
            step_id,
            "query_rewrite",
            "running",
            "Optimizing search query",
            "Optimisation de la requ\u00eate de recherche",
        )

        query_rewrite_prompt, self._query_rewrite_version = await self._resolve_prompt(
            "query-rewrite",
            _QUERY_REWRITE_SYSTEM,
        )

        start = time.monotonic()
        optimized_query = await self.model_client.generate_query(
            query_rewrite_prompt,
            user_message,
            history,
        )
        # Fallback: if rewrite returned empty, use original message
        if not optimized_query or not optimized_query.strip():
            optimized_query = user_message
        rewrite_ms = int((time.monotonic() - start) * 1000)

        tracker.complete_step(
            step_id, duration_ms=rewrite_ms, metadata={"optimized_query": optimized_query}
        )
        yield self._step_event(
            step_id,
            "query_rewrite",
            "complete",
            "Optimizing search query",
            "Optimisation de la requ\u00eate de recherche",
            duration_ms=rewrite_ms,
            metadata={"optimized_query": optimized_query},
        )

        # ---- Step 2: Search ----
        step_id = tracker.add_step(
            "search",
            "Searching documents",
            "Recherche de documents",
        )
        yield self._step_event(
            step_id, "search", "running", "Searching documents", "Recherche de documents"
        )

        search_tool = self.tool_registry.get_tool("search")
        search_result = await search_tool.execute(
            query=optimized_query,
            workspace_id=workspace_id,
            top_k=top_k,
        )

        results = search_result.get("results", [])
        search_ms = search_result.get("duration_ms", 0)
        tracker.add_source_consulted(len(results))
        tracker.complete_step(
            step_id, duration_ms=search_ms, metadata={"sources_found": len(results)}
        )
        yield self._step_event(
            step_id,
            "search",
            "complete",
            "Searching documents",
            "Recherche de documents",
            duration_ms=search_ms,
            metadata={"sources_found": len(results)},
        )

        # ---- Step 3: Cite ----
        step_id = tracker.add_step(
            "cite",
            "Resolving citations",
            "R\u00e9solution des citations",
        )
        yield self._step_event(
            step_id, "cite", "running", "Resolving citations", "R\u00e9solution des citations"
        )

        cite_tool = self.tool_registry.get_tool("cite")
        cite_start = time.monotonic()
        cite_result = await cite_tool.execute(search_results=results)
        cite_ms = int((time.monotonic() - cite_start) * 1000)
        citations: list[Citation] = cite_result.get("citations", [])

        for citation in citations:
            tracker.add_source_cited(citation)

        tracker.complete_step(
            step_id, duration_ms=cite_ms, metadata={"citations_resolved": len(citations)}
        )
        yield self._step_event(
            step_id,
            "cite",
            "complete",
            "Resolving citations",
            "R\u00e9solution des citations",
            duration_ms=cite_ms,
            metadata={"citations_resolved": len(citations)},
        )

        # ---- Step 4: Generate answer ----
        step_id = tracker.add_step(
            "answer",
            "Generating answer",
            "G\u00e9n\u00e9ration de la r\u00e9ponse",
        )
        yield self._step_event(
            step_id,
            "answer",
            "running",
            "Generating answer",
            "G\u00e9n\u00e9ration de la r\u00e9ponse",
        )

        rag_prompt_content, self._rag_prompt_version = await self._resolve_prompt(
            "rag-system",
            _RAG_SYSTEM,
        )

        # Compose: base RAG prompt wraps workspace business prompt
        workspace = (
            await aio(self.workspace_store.get(workspace_id))
            if self.workspace_store and workspace_id
            else None
        )
        business_prompt = (
            workspace.business_prompt if workspace and workspace.business_prompt else ""
        )
        if business_prompt and workspace is not None:
            rag_prompt_content = (
                f"{rag_prompt_content}\n\n## Workspace Context\n\n{business_prompt}"
            )
            self._rag_prompt_version += f" + {workspace_id}:v{workspace.business_prompt_version}"

        source_block = _build_source_block(results)
        # If the store prompt doesn't contain {sources}, append them
        if "{sources}" in rag_prompt_content:
            rag_system = rag_prompt_content.format(sources=source_block)
        else:
            rag_system = rag_prompt_content + "\n\nSources:\n" + source_block

        messages = self._build_messages(history, user_message)
        answer_start = time.monotonic()
        full_answer = ""

        async for token in self.model_client.stream_completion(rag_system, messages):
            full_answer += token
            yield (
                json.dumps(
                    {
                        "content": token,
                    }
                )
                + "\n"
            )

        answer_ms = int((time.monotonic() - answer_start) * 1000)

        # Citations are included in the provenance_complete event — no separate emit needed

        tracker.complete_step(
            step_id, duration_ms=answer_ms, metadata={"answer_length": len(full_answer)}
        )
        yield self._step_event(
            step_id,
            "answer",
            "complete",
            "Generating answer",
            "G\u00e9n\u00e9ration de la r\u00e9ponse",
            duration_ms=answer_ms,
            metadata={"answer_length": len(full_answer)},
        )

        # ---- Confidence & provenance ----
        await self._compute_grounded_provenance(tracker, results, citations)

    # ------------------------------------------------------------------
    # Ungrounded mode
    # ------------------------------------------------------------------

    async def _run_ungrounded(
        self,
        user_message: str,
        history: list[dict],
        tracker: ProvenanceTracker,
        conversation_id: str,
        message_id: str,
        overrides: dict | None,
    ) -> AsyncGenerator[str, None]:
        """Direct GPT completion without tools."""

        tracker.add_policy_applied("ungrounded-mode")

        ungrounded_prompt, self._ungrounded_prompt_version = await self._resolve_prompt(
            "ungrounded-system",
            _UNGROUNDED_SYSTEM,
        )

        step_id = tracker.add_step(
            "answer",
            "Generating answer (ungrounded)",
            "G\u00e9n\u00e9ration de la r\u00e9ponse (non ancr\u00e9e)",
        )
        yield self._step_event(
            step_id,
            "answer",
            "running",
            "Generating answer (ungrounded)",
            "G\u00e9n\u00e9ration de la r\u00e9ponse (non ancr\u00e9e)",
        )

        messages = self._build_messages(history, user_message)
        answer_start = time.monotonic()
        full_answer = ""

        async for token in self.model_client.stream_completion(
            ungrounded_prompt,
            messages,
        ):
            full_answer += token
            yield (
                json.dumps(
                    {
                        "content": token,
                    }
                )
                + "\n"
            )

        answer_ms = int((time.monotonic() - answer_start) * 1000)

        tracker.complete_step(
            step_id, duration_ms=answer_ms, metadata={"answer_length": len(full_answer)}
        )
        yield self._step_event(
            step_id,
            "answer",
            "complete",
            "Generating answer (ungrounded)",
            "G\u00e9n\u00e9ration de la r\u00e9ponse (non ancr\u00e9e)",
            duration_ms=answer_ms,
            metadata={"answer_length": len(full_answer)},
        )

        # Ungrounded confidence is low by default
        await self._compute_ungrounded_provenance(tracker)

    # ------------------------------------------------------------------
    # Provenance helpers
    # ------------------------------------------------------------------

    async def _compute_grounded_provenance(
        self,
        tracker: ProvenanceTracker,
        search_results: list[dict],
        citations: list[Citation],
    ) -> None:
        """Compute confidence, freshness, explainability for grounded mode."""

        # Confidence from relevance scores
        scores = [r.get("relevance_score", 0.5) for r in search_results]
        avg_relevance = sum(scores) / len(scores) if scores else 0.0
        source_coverage = min(len(citations) / max(len(search_results), 1), 1.0)
        grounding_quality = 0.85 if citations else 0.2

        tracker.set_confidence(
            ConfidenceFactors(
                retrieval_relevance=round(avg_relevance, 4),
                source_coverage=round(source_coverage, 4),
                grounding_quality=grounding_quality,
            )
        )

        # Freshness from source dates
        dates: list[str] = [
            d for r in search_results if (d := r.get("last_modified")) is not None
        ]
        tracker.set_freshness(
            FreshnessInfo(
                oldest_source=min(dates) if dates else None,
                newest_source=max(dates) if dates else None,
                staleness_warning=False,
            )
        )

        # Behavioral fingerprint — snapshot model config + prompt version at query time
        prompt_ver = getattr(self, "_rag_prompt_version", _PROMPT_VERSION)
        deployment = getattr(self.model_client, "deployment", _MODEL_ID)
        model_snap = await self._snapshot_model(deployment)
        tracker.set_behavioral_fingerprint(
            BehavioralFingerprint(
                model=_MODEL_ID,
                model_snapshot=model_snap,
                prompt_version=prompt_ver,
                corpus_snapshot=_CORPUS_SNAPSHOT,
                policy_rules_version=_POLICY_RULES_VERSION,
            )
        )

        # Explainability
        consulted = len(search_results)
        cited = len(citations)
        excluded = consulted - cited
        tracker.set_explainability(
            ExplainabilityRecord(
                retrieval_summary=(
                    f"{consulted} sources retrieved; {cited} cited; {excluded} excluded"
                ),
                reasoning_summary=(
                    "Used hybrid search (vector + keyword) to find relevant documents, "
                    "resolved citations with SAS URLs, then generated a grounded answer "
                    "constrained to the retrieved sources."
                ),
                negative_evidence=[],
                cross_language=None,
            )
        )

    async def _compute_ungrounded_provenance(self, tracker: ProvenanceTracker) -> None:
        """Set provenance for ungrounded (no-RAG) mode."""

        tracker.set_confidence(
            ConfidenceFactors(
                retrieval_relevance=0.0,
                source_coverage=0.0,
                grounding_quality=_UNGROUNDED_DEFAULT_CONFIDENCE,
            )
        )
        tracker.set_freshness(
            FreshnessInfo(
                oldest_source=None,
                newest_source=None,
                staleness_warning=False,
            )
        )
        prompt_ver = getattr(self, "_ungrounded_prompt_version", _PROMPT_VERSION)
        deployment = getattr(self.model_client, "deployment", _MODEL_ID)
        model_snap = await self._snapshot_model(deployment)
        tracker.set_behavioral_fingerprint(
            BehavioralFingerprint(
                model=_MODEL_ID,
                model_snapshot=model_snap,
                prompt_version=prompt_ver,
                corpus_snapshot=_CORPUS_SNAPSHOT,
                policy_rules_version=_POLICY_RULES_VERSION,
            )
        )
        tracker.set_explainability(
            ExplainabilityRecord(
                retrieval_summary="0 sources retrieved; 0 cited; ungrounded mode",
                reasoning_summary=(
                    "Answered using general model knowledge without document retrieval. "
                    "Response is not grounded in official ESDC documents."
                ),
                negative_evidence=[
                    "No document search was performed (ungrounded mode).",
                ],
                cross_language=None,
            )
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_messages(history: list[dict], user_message: str) -> list[dict]:
        """Build the messages list for the model, appending the current user message."""
        messages = list(history)
        messages.append({"role": "user", "content": user_message})
        return messages

    @staticmethod
    def _step_event(
        step_id: int,
        tool: str,
        status: str,
        label_en: str,
        label_fr: str,
        duration_ms: int | None = None,
        metadata: dict | None = None,
    ) -> str:
        """Build an NDJSON line for an agent step event."""
        step = AgentStep(
            id=step_id,
            tool=tool,
            status=status,
            label_en=label_en,
            label_fr=label_fr,
            duration_ms=duration_ms,
            metadata=metadata,
        )
        return json.dumps({"agent_step": step.model_dump()}) + "\n"
