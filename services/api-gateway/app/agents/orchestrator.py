"""ReAct agent orchestrator — the core of EVA Agentic's chat pipeline.

Replaces MSIA's hardcoded linear approach with an observable, tool-calling
agent loop.  Every step is streamed as NDJSON for real-time UI transparency.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import AsyncGenerator

from ..provenance.correlation import generate_correlation_id
from ..provenance.models import (
    AgentStep,
    BehavioralFingerprint,
    Citation,
    ConfidenceFactors,
    ExplainabilityRecord,
    FreshnessInfo,
)
from ..provenance.tracker import ProvenanceTracker
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

    async def generate_query(
        self, system: str, user_message: str, history: list[dict]
    ) -> str:
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
    ) -> None:
        self.tool_registry = tool_registry
        self.model_client = model_client or MockModelClient()
        self.trace_id = trace_id or "local"

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

        # Emit initial provenance
        yield json.dumps({
            "type": "provenance",
            "correlation_id": correlation_id,
            "trace_id": self.trace_id,
            "conversation_id": conversation_id,
            "message_id": message_id,
        }) + "\n"

        if mode == "ungrounded":
            async for line in self._run_ungrounded(
                user_message, conversation_history, tracker,
                conversation_id, message_id, overrides,
            ):
                yield line
        else:
            async for line in self._run_grounded(
                user_message, conversation_history, workspace_id, tracker,
                conversation_id, message_id, overrides,
            ):
                yield line

        # Final provenance record
        provenance = tracker.build()
        yield json.dumps({
            "type": "provenance_complete",
            "provenance": provenance.model_dump(),
            "explainability": (
                tracker.explainability.model_dump()
                if tracker.explainability
                else None
            ),
        }) + "\n"

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
        yield self._step_event(step_id, "query_rewrite", "running",
                               "Optimizing search query",
                               "Optimisation de la requ\u00eate de recherche")

        start = time.monotonic()
        optimized_query = await self.model_client.generate_query(
            _QUERY_REWRITE_SYSTEM, user_message, history,
        )
        rewrite_ms = int((time.monotonic() - start) * 1000)

        tracker.complete_step(step_id, duration_ms=rewrite_ms,
                              metadata={"optimized_query": optimized_query})
        yield self._step_event(step_id, "query_rewrite", "complete",
                               "Optimizing search query",
                               "Optimisation de la requ\u00eate de recherche",
                               duration_ms=rewrite_ms,
                               metadata={"optimized_query": optimized_query})

        # ---- Step 2: Search ----
        step_id = tracker.add_step(
            "search", "Searching documents", "Recherche de documents",
        )
        yield self._step_event(step_id, "search", "running",
                               "Searching documents",
                               "Recherche de documents")

        search_tool = self.tool_registry.get_tool("search")
        search_result = await search_tool.execute(
            query=optimized_query, workspace_id=workspace_id, top_k=top_k,
        )

        results = search_result.get("results", [])
        search_ms = search_result.get("duration_ms", 0)
        tracker.add_source_consulted(len(results))
        tracker.complete_step(step_id, duration_ms=search_ms,
                              metadata={"sources_found": len(results)})
        yield self._step_event(step_id, "search", "complete",
                               "Searching documents",
                               "Recherche de documents",
                               duration_ms=search_ms,
                               metadata={"sources_found": len(results)})

        # ---- Step 3: Cite ----
        step_id = tracker.add_step(
            "cite", "Resolving citations", "R\u00e9solution des citations",
        )
        yield self._step_event(step_id, "cite", "running",
                               "Resolving citations",
                               "R\u00e9solution des citations")

        cite_tool = self.tool_registry.get_tool("cite")
        cite_start = time.monotonic()
        cite_result = await cite_tool.execute(search_results=results)
        cite_ms = int((time.monotonic() - cite_start) * 1000)
        citations: list[Citation] = cite_result.get("citations", [])

        for citation in citations:
            tracker.add_source_cited(citation)

        tracker.complete_step(step_id, duration_ms=cite_ms,
                              metadata={"citations_resolved": len(citations)})
        yield self._step_event(step_id, "cite", "complete",
                               "Resolving citations",
                               "R\u00e9solution des citations",
                               duration_ms=cite_ms,
                               metadata={"citations_resolved": len(citations)})

        # ---- Step 4: Generate answer ----
        step_id = tracker.add_step(
            "answer", "Generating answer", "G\u00e9n\u00e9ration de la r\u00e9ponse",
        )
        yield self._step_event(step_id, "answer", "running",
                               "Generating answer",
                               "G\u00e9n\u00e9ration de la r\u00e9ponse")

        source_block = _build_source_block(results)
        rag_system = _RAG_SYSTEM.format(sources=source_block)

        messages = self._build_messages(history, user_message)
        answer_start = time.monotonic()
        full_answer = ""

        async for token in self.model_client.stream_completion(rag_system, messages):
            full_answer += token
            yield json.dumps({
                "type": "content",
                "conversation_id": conversation_id,
                "message_id": message_id,
                "delta": token,
            }) + "\n"

        answer_ms = int((time.monotonic() - answer_start) * 1000)

        # Emit citations alongside the final content
        yield json.dumps({
            "type": "citations",
            "conversation_id": conversation_id,
            "message_id": message_id,
            "citations": [c.model_dump() for c in citations],
        }) + "\n"

        tracker.complete_step(step_id, duration_ms=answer_ms,
                              metadata={"answer_length": len(full_answer)})
        yield self._step_event(step_id, "answer", "complete",
                               "Generating answer",
                               "G\u00e9n\u00e9ration de la r\u00e9ponse",
                               duration_ms=answer_ms,
                               metadata={"answer_length": len(full_answer)})

        # ---- Confidence & provenance ----
        self._compute_grounded_provenance(tracker, results, citations)

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

        step_id = tracker.add_step(
            "answer", "Generating answer (ungrounded)",
            "G\u00e9n\u00e9ration de la r\u00e9ponse (non ancr\u00e9e)",
        )
        yield self._step_event(step_id, "answer", "running",
                               "Generating answer (ungrounded)",
                               "G\u00e9n\u00e9ration de la r\u00e9ponse (non ancr\u00e9e)")

        messages = self._build_messages(history, user_message)
        answer_start = time.monotonic()
        full_answer = ""

        async for token in self.model_client.stream_completion(
            _UNGROUNDED_SYSTEM, messages,
        ):
            full_answer += token
            yield json.dumps({
                "type": "content",
                "conversation_id": conversation_id,
                "message_id": message_id,
                "delta": token,
            }) + "\n"

        answer_ms = int((time.monotonic() - answer_start) * 1000)

        tracker.complete_step(step_id, duration_ms=answer_ms,
                              metadata={"answer_length": len(full_answer)})
        yield self._step_event(step_id, "answer", "complete",
                               "Generating answer (ungrounded)",
                               "G\u00e9n\u00e9ration de la r\u00e9ponse (non ancr\u00e9e)",
                               duration_ms=answer_ms,
                               metadata={"answer_length": len(full_answer)})

        # Ungrounded confidence is low by default
        self._compute_ungrounded_provenance(tracker)

    # ------------------------------------------------------------------
    # Provenance helpers
    # ------------------------------------------------------------------

    def _compute_grounded_provenance(
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

        tracker.set_confidence(ConfidenceFactors(
            retrieval_relevance=round(avg_relevance, 4),
            source_coverage=round(source_coverage, 4),
            grounding_quality=grounding_quality,
        ))

        # Freshness from source dates
        dates = [r.get("last_modified") for r in search_results if r.get("last_modified")]
        tracker.set_freshness(FreshnessInfo(
            oldest_source=min(dates) if dates else None,
            newest_source=max(dates) if dates else None,
            staleness_warning=False,
        ))

        # Behavioral fingerprint
        tracker.set_behavioral_fingerprint(BehavioralFingerprint(
            model=_MODEL_ID,
            prompt_version=_PROMPT_VERSION,
            corpus_snapshot=_CORPUS_SNAPSHOT,
            policy_rules_version=_POLICY_RULES_VERSION,
        ))

        # Explainability
        consulted = len(search_results)
        cited = len(citations)
        excluded = consulted - cited
        tracker.set_explainability(ExplainabilityRecord(
            retrieval_summary=(
                f"{consulted} sources retrieved; {cited} cited; "
                f"{excluded} excluded"
            ),
            reasoning_summary=(
                "Used hybrid search (vector + keyword) to find relevant documents, "
                "resolved citations with SAS URLs, then generated a grounded answer "
                "constrained to the retrieved sources."
            ),
            negative_evidence=[],
            cross_language=None,
        ))

    def _compute_ungrounded_provenance(self, tracker: ProvenanceTracker) -> None:
        """Set provenance for ungrounded (no-RAG) mode."""

        tracker.set_confidence(ConfidenceFactors(
            retrieval_relevance=0.0,
            source_coverage=0.0,
            grounding_quality=_UNGROUNDED_DEFAULT_CONFIDENCE,
        ))
        tracker.set_freshness(FreshnessInfo(
            oldest_source=None,
            newest_source=None,
            staleness_warning=False,
        ))
        tracker.set_behavioral_fingerprint(BehavioralFingerprint(
            model=_MODEL_ID,
            prompt_version=_PROMPT_VERSION,
            corpus_snapshot=_CORPUS_SNAPSHOT,
            policy_rules_version=_POLICY_RULES_VERSION,
        ))
        tracker.set_explainability(ExplainabilityRecord(
            retrieval_summary="0 sources retrieved; 0 cited; ungrounded mode",
            reasoning_summary=(
                "Answered using general model knowledge without document retrieval. "
                "Response is not grounded in official ESDC documents."
            ),
            negative_evidence=[
                "No document search was performed (ungrounded mode).",
            ],
            cross_language=None,
        ))

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
        return json.dumps({"type": "agent_step", **step.model_dump()}) + "\n"
