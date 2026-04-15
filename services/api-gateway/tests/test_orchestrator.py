"""Tests for the ReAct agent orchestrator, tool registry, and tools."""

from __future__ import annotations

import json

import pytest

from app.agents.orchestrator import AgentOrchestrator, MockModelClient
from app.provenance.models import Citation
from app.tools.cite import CitationTool
from app.tools.registry import Tool, ToolMetadata, ToolRegistry
from app.tools.search import SearchTool
from app.tools.translate import TranslationTool


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def registry() -> ToolRegistry:
    """Create a populated tool registry."""
    reg = ToolRegistry()
    reg.register(SearchTool())
    reg.register(CitationTool())
    reg.register(TranslationTool())
    return reg


@pytest.fixture()
def orchestrator(registry: ToolRegistry) -> AgentOrchestrator:
    """Create an orchestrator with mock model client."""
    return AgentOrchestrator(
        tool_registry=registry,
        model_client=MockModelClient(),
        trace_id="test-trace-001",
    )


async def _collect_events(orchestrator: AgentOrchestrator, **kwargs) -> list[dict]:
    """Run the orchestrator and collect all NDJSON events as dicts."""
    events: list[dict] = []
    async for line in orchestrator.run(**kwargs):
        event = json.loads(line.strip())
        events.append(event)
    return events


# ---------------------------------------------------------------------------
# Tool Registry tests
# ---------------------------------------------------------------------------


class TestToolRegistry:
    def test_register_and_get(self, registry: ToolRegistry) -> None:
        tool = registry.get_tool("search")
        assert tool.metadata.name == "search"

    def test_get_nonexistent_raises(self, registry: ToolRegistry) -> None:
        with pytest.raises(KeyError, match="not registered"):
            registry.get_tool("nonexistent")

    def test_duplicate_registration_raises(self) -> None:
        reg = ToolRegistry()
        reg.register(SearchTool())
        with pytest.raises(ValueError, match="already registered"):
            reg.register(SearchTool())

    def test_list_tools(self, registry: ToolRegistry) -> None:
        metas = registry.list_tools()
        names = {m.name for m in metas}
        assert names == {"search", "cite", "translate"}

    def test_has_tool(self, registry: ToolRegistry) -> None:
        assert registry.has_tool("search")
        assert not registry.has_tool("nonexistent")

    def test_len(self, registry: ToolRegistry) -> None:
        assert len(registry) == 3


# ---------------------------------------------------------------------------
# Individual tool tests
# ---------------------------------------------------------------------------


class TestSearchTool:
    @pytest.mark.asyncio
    async def test_returns_results(self) -> None:
        tool = SearchTool()
        result = await tool.execute(query="OAS benefits", workspace_id="ws1", top_k=3)
        assert "results" in result
        assert len(result["results"]) == 3
        assert "duration_ms" in result

    @pytest.mark.asyncio
    async def test_results_have_required_fields(self) -> None:
        tool = SearchTool()
        result = await tool.execute(query="test", workspace_id="ws1")
        for doc in result["results"]:
            assert "file" in doc
            assert "content" in doc
            assert "relevance_score" in doc
            assert 0 <= doc["relevance_score"] <= 1


class TestCitationTool:
    @pytest.mark.asyncio
    async def test_resolves_citations(self) -> None:
        tool = CitationTool()
        search_results = [
            {"file": "doc.pdf", "page": 1, "section": "S1",
             "relevance_score": 0.9, "last_modified": "2026-04-10T00:00:00Z"},
            {"file": "doc2.pdf", "page": 5, "section": "S2",
             "relevance_score": 0.8, "last_modified": "2026-04-09T00:00:00Z"},
        ]
        result = await tool.execute(search_results=search_results)
        citations = result["citations"]
        assert len(citations) == 2
        assert all(isinstance(c, Citation) for c in citations)
        assert all("evastorage.blob.core.windows.net" in c.sas_url for c in citations)

    @pytest.mark.asyncio
    async def test_empty_results(self) -> None:
        tool = CitationTool()
        result = await tool.execute(search_results=[])
        assert result["citations"] == []


class TestTranslationTool:
    @pytest.mark.asyncio
    async def test_translate(self) -> None:
        tool = TranslationTool()
        result = await tool.execute(text="Hello", source_lang="en", target_lang="fr")
        assert "translated_text" in result
        assert result["source_lang"] == "en"
        assert result["target_lang"] == "fr"

    @pytest.mark.asyncio
    async def test_same_lang_passthrough(self) -> None:
        tool = TranslationTool()
        result = await tool.execute(text="Hello", source_lang="en", target_lang="en")
        assert result["translated_text"] == "Hello"


# ---------------------------------------------------------------------------
# Orchestrator tests — grounded mode
# ---------------------------------------------------------------------------


class TestOrchestratorGrounded:
    @pytest.mark.asyncio
    async def test_yields_valid_ndjson(self, orchestrator: AgentOrchestrator) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="What are OAS benefits?",
            conversation_history=[],
            workspace_id="ws-test",
            mode="grounded",
        )
        assert len(events) > 0
        # Every event must be valid JSON (already parsed, so this passed)

    @pytest.mark.asyncio
    async def test_grounded_produces_expected_steps(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="What are OAS benefits?",
            conversation_history=[],
            workspace_id="ws-test",
            mode="grounded",
        )

        step_events = [e for e in events if e.get("type") == "agent_step"]
        tools_used = [e["tool"] for e in step_events if e.get("status") == "complete"]

        assert "query_rewrite" in tools_used
        assert "search" in tools_used
        assert "cite" in tools_used
        assert "answer" in tools_used

    @pytest.mark.asyncio
    async def test_grounded_streams_content(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="What are OAS benefits?",
            conversation_history=[],
            workspace_id="ws-test",
            mode="grounded",
        )

        content_events = [e for e in events if e.get("type") == "content"]
        assert len(content_events) > 0
        # Content events should have delta text
        for ce in content_events:
            assert "delta" in ce
            assert "conversation_id" in ce
            assert "message_id" in ce

    @pytest.mark.asyncio
    async def test_grounded_emits_citations(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="What are OAS benefits?",
            conversation_history=[],
            workspace_id="ws-test",
            mode="grounded",
        )

        citation_events = [e for e in events if e.get("type") == "citations"]
        assert len(citation_events) == 1
        assert len(citation_events[0]["citations"]) > 0

    @pytest.mark.asyncio
    async def test_provenance_complete_is_last(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="What are OAS benefits?",
            conversation_history=[],
            workspace_id="ws-test",
            mode="grounded",
        )

        last_event = events[-1]
        assert last_event.get("type") == "provenance_complete"
        assert "provenance" in last_event
        prov = last_event["provenance"]
        assert prov["correlation_id"]
        assert prov["confidence"] > 0
        assert prov["sources_consulted"] > 0
        assert prov["sources_cited"] > 0

    @pytest.mark.asyncio
    async def test_provenance_has_fingerprint(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="test",
            conversation_history=[],
            workspace_id="ws-test",
            mode="grounded",
        )
        prov = events[-1]["provenance"]
        fp = prov["behavioral_fingerprint"]
        assert fp["model"] == "gpt-5.1-2026-04"
        assert fp["prompt_version"] == "v3.2"

    @pytest.mark.asyncio
    async def test_provenance_has_explainability(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="test",
            conversation_history=[],
            workspace_id="ws-test",
            mode="grounded",
        )
        last = events[-1]
        assert last.get("explainability") is not None
        assert "retrieval_summary" in last["explainability"]


# ---------------------------------------------------------------------------
# Orchestrator tests — ungrounded mode
# ---------------------------------------------------------------------------


class TestOrchestratorUngrounded:
    @pytest.mark.asyncio
    async def test_ungrounded_no_search_step(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="What is the capital of Canada?",
            conversation_history=[],
            mode="ungrounded",
        )

        step_events = [e for e in events if e.get("type") == "agent_step"]
        tools_used = {e["tool"] for e in step_events}
        assert "search" not in tools_used
        assert "cite" not in tools_used
        assert "answer" in tools_used

    @pytest.mark.asyncio
    async def test_ungrounded_streams_content(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="Hello",
            conversation_history=[],
            mode="ungrounded",
        )
        content_events = [e for e in events if e.get("type") == "content"]
        assert len(content_events) > 0

    @pytest.mark.asyncio
    async def test_ungrounded_low_confidence(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="Hello",
            conversation_history=[],
            mode="ungrounded",
        )
        prov = events[-1]["provenance"]
        assert prov["sources_consulted"] == 0
        assert prov["sources_cited"] == 0
        # Ungrounded confidence should be low
        assert prov["confidence"] <= 0.5

    @pytest.mark.asyncio
    async def test_ungrounded_provenance_complete_last(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="Hello",
            conversation_history=[],
            mode="ungrounded",
        )
        assert events[-1].get("type") == "provenance_complete"

    @pytest.mark.asyncio
    async def test_ungrounded_policies(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="Hello",
            conversation_history=[],
            mode="ungrounded",
        )
        prov = events[-1]["provenance"]
        assert "ungrounded-mode" in prov["policies_applied"]


# ---------------------------------------------------------------------------
# Orchestrator — first event is provenance
# ---------------------------------------------------------------------------


class TestOrchestratorProvenance:
    @pytest.mark.asyncio
    async def test_first_event_is_provenance(
        self, orchestrator: AgentOrchestrator
    ) -> None:
        events = await _collect_events(
            orchestrator,
            user_message="test",
            conversation_history=[],
            mode="grounded",
            workspace_id="ws-test",
        )
        first = events[0]
        assert first.get("type") == "provenance"
        assert "correlation_id" in first
        assert "trace_id" in first
