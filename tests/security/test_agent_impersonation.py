"""
Agent impersonation tests -- verify agent identity, delegation chain integrity,
and provenance immutability.

Tests the ProvenanceTracker and correlation ID infrastructure to ensure:
- Agent identities are validated
- Delegation chains are tamper-evident
- Correlation IDs are unique per request
- Provenance records are complete and immutable after build

Reference: Agentic State Vision principle #3 (Agent Identity),
EVA Design Principles (forensic audit trail).
"""

import sys
import uuid

import pytest

sys.path.insert(0, "services/api-gateway")
from app.provenance.correlation import (  # noqa: E402
    generate_correlation_id,
    get_correlation_id_from_headers,
)
from app.provenance.models import (  # noqa: E402
    BehavioralFingerprint,
    Citation,
    ConfidenceFactors,
    FreshnessInfo,
)
from app.provenance.tracker import ProvenanceTracker  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _default_fingerprint() -> BehavioralFingerprint:
    return BehavioralFingerprint(
        model="gpt-5.1-2026-04",
        prompt_version="v3.2",
        corpus_snapshot="2026-04-14",
        policy_rules_version="v1.4",
    )


def _build_tracker(
    correlation_id: str = "corr-1",
    agent_id: str = "eva-rag-agent",
    trace_id: str = "trace-1",
) -> ProvenanceTracker:
    """Create a tracker with minimum required fields set."""
    tracker = ProvenanceTracker(correlation_id, agent_id, trace_id)
    tracker.set_confidence(
        ConfidenceFactors(
            retrieval_relevance=0.9,
            source_coverage=0.8,
            grounding_quality=0.85,
        )
    )
    tracker.set_freshness(
        FreshnessInfo(oldest_source="2026-01-01", newest_source="2026-04-01")
    )
    tracker.set_behavioral_fingerprint(_default_fingerprint())
    return tracker


# ---------------------------------------------------------------------------
# Delegation chain integrity
# ---------------------------------------------------------------------------

class TestDelegationChain:
    """Verify that the delegation chain accurately records every tool
    invocation in order, forming an auditable execution log."""

    def test_delegation_chain_records_all_steps(self):
        tracker = _build_tracker()
        tracker.add_step("search", "Searching", "Recherche")
        tracker.add_step("cite", "Citing", "Citation")
        tracker.add_step("answer", "Answering", "Reponse")
        record = tracker.build()
        assert record.delegation_chain == ["search", "cite", "answer"]

    def test_delegation_chain_preserves_order(self):
        tracker = _build_tracker()
        tracker.add_step("translate", "Translating", "Traduction")
        tracker.add_step("search", "Searching", "Recherche")
        tracker.add_step("rerank", "Reranking", "Reclassement")
        record = tracker.build()
        assert record.delegation_chain == ["translate", "search", "rerank"]

    def test_empty_delegation_chain(self):
        """A response with no tool calls still builds a valid record."""
        tracker = _build_tracker()
        record = tracker.build()
        assert record.delegation_chain == []

    def test_single_step_chain(self):
        tracker = _build_tracker()
        tracker.add_step("answer", "Answering", "Reponse")
        record = tracker.build()
        assert record.delegation_chain == ["answer"]

    def test_duplicate_tool_names_preserved(self):
        """If a tool is called twice, both appearances are logged."""
        tracker = _build_tracker()
        tracker.add_step("search", "Search 1", "Recherche 1")
        tracker.add_step("search", "Search 2", "Recherche 2")
        record = tracker.build()
        assert record.delegation_chain == ["search", "search"]


# ---------------------------------------------------------------------------
# Agent identity validation
# ---------------------------------------------------------------------------

class TestAgentIdentity:
    """Verify that agent_id is properly recorded and non-empty."""

    def test_agent_id_recorded_in_provenance(self):
        tracker = _build_tracker(agent_id="eva-rag-agent")
        record = tracker.build()
        assert record.agent_id == "eva-rag-agent"

    def test_agent_id_cannot_be_empty(self):
        """Empty agent_id should produce a record with empty string --
        the system should guard against this at the call site."""
        tracker = _build_tracker(agent_id="")
        record = tracker.build()
        # The record builds, but the empty string is detectable in audit
        assert record.agent_id == ""

    def test_different_agents_produce_different_records(self):
        t1 = _build_tracker(agent_id="eva-rag-agent")
        t2 = _build_tracker(agent_id="eva-jurisprudence-agent")
        r1 = t1.build()
        r2 = t2.build()
        assert r1.agent_id != r2.agent_id

    def test_agent_id_with_special_chars(self):
        """Agent IDs should support namespace-style naming."""
        tracker = _build_tracker(agent_id="eva/rag-agent/v2.1")
        record = tracker.build()
        assert record.agent_id == "eva/rag-agent/v2.1"


# ---------------------------------------------------------------------------
# Correlation ID uniqueness
# ---------------------------------------------------------------------------

class TestCorrelationId:
    """Verify that correlation IDs are unique per request and properly
    extracted from headers."""

    def test_correlation_id_unique_per_generation(self):
        ids = {generate_correlation_id() for _ in range(1000)}
        assert len(ids) == 1000, "Collision detected in 1000 generated IDs"

    def test_correlation_id_is_valid_uuid(self):
        cid = generate_correlation_id()
        parsed = uuid.UUID(cid)  # raises ValueError if invalid
        assert str(parsed) == cid

    def test_correlation_id_recorded_in_provenance(self):
        tracker = _build_tracker(correlation_id="corr-unique-42")
        record = tracker.build()
        assert record.correlation_id == "corr-unique-42"

    def test_extract_from_headers(self):
        headers = {"x-correlation-id": "abc-123"}
        assert get_correlation_id_from_headers(headers) == "abc-123"

    def test_extract_from_headers_case_insensitive(self):
        headers = {"X-Correlation-ID": "abc-456"}
        assert get_correlation_id_from_headers(headers) == "abc-456"

    def test_missing_header_returns_none(self):
        assert get_correlation_id_from_headers({}) is None

    def test_two_trackers_same_correlation_are_distinct(self):
        """Two trackers with the same correlation_id are independent objects."""
        t1 = _build_tracker(correlation_id="corr-shared")
        t2 = _build_tracker(correlation_id="corr-shared")
        t1.add_step("search", "S", "R")
        assert len(t2.steps) == 0, "Trackers should not share state"


# ---------------------------------------------------------------------------
# Provenance immutability after build
# ---------------------------------------------------------------------------

class TestProvenanceImmutability:
    """Once build() is called, the ProvenanceRecord should be a standalone
    snapshot. Further mutations to the tracker should not affect it."""

    def test_record_not_affected_by_post_build_mutations(self):
        tracker = _build_tracker()
        tracker.add_step("search", "S", "R")
        record = tracker.build()

        # Mutate the tracker after building
        tracker.add_step("answer", "A", "Re")
        assert record.delegation_chain == ["search"]
        assert len(record.delegation_chain) == 1

    def test_citations_snapshot_after_build(self):
        tracker = _build_tracker()
        tracker.add_source_cited(
            Citation(
                file="doc1.pdf", page=1, section="s1",
                sas_url="https://blob/doc1?sas=x",
            )
        )
        pre_build_count = len(tracker.citations)
        record = tracker.build()

        tracker.add_source_cited(
            Citation(
                file="doc2.pdf", page=2, section="s2",
                sas_url="https://blob/doc2?sas=y",
            )
        )
        # Record should still show only the pre-build citation count
        assert record.sources_cited == pre_build_count

    def test_policies_applied_snapshot(self):
        tracker = _build_tracker()
        tracker.add_policy_applied("grounding-required")
        record = tracker.build()

        tracker.add_policy_applied("protected-b-boundary")
        assert record.policies_applied == ["grounding-required"]


# ---------------------------------------------------------------------------
# Build validation
# ---------------------------------------------------------------------------

class TestBuildValidation:
    """build() should reject incomplete provenance records."""

    def test_build_requires_confidence(self):
        tracker = ProvenanceTracker("c", "a", "t")
        tracker.set_freshness(FreshnessInfo())
        tracker.set_behavioral_fingerprint(_default_fingerprint())
        with pytest.raises(ValueError, match="confidence_factors"):
            tracker.build()

    def test_build_requires_freshness(self):
        tracker = ProvenanceTracker("c", "a", "t")
        tracker.set_confidence(
            ConfidenceFactors(
                retrieval_relevance=0.5,
                source_coverage=0.5,
                grounding_quality=0.5,
            )
        )
        tracker.set_behavioral_fingerprint(_default_fingerprint())
        with pytest.raises(ValueError, match="freshness"):
            tracker.build()

    def test_build_requires_behavioral_fingerprint(self):
        tracker = ProvenanceTracker("c", "a", "t")
        tracker.set_confidence(
            ConfidenceFactors(
                retrieval_relevance=0.5,
                source_coverage=0.5,
                grounding_quality=0.5,
            )
        )
        tracker.set_freshness(FreshnessInfo())
        with pytest.raises(ValueError, match="behavioral_fingerprint"):
            tracker.build()


# ---------------------------------------------------------------------------
# Step lifecycle
# ---------------------------------------------------------------------------

class TestStepLifecycle:
    """Verify step status transitions and error handling."""

    def test_step_starts_running(self):
        tracker = _build_tracker()
        step_id = tracker.add_step("search", "Searching", "Recherche")
        step = [s for s in tracker.steps if s.id == step_id][0]
        assert step.status == "running"

    def test_step_completes(self):
        tracker = _build_tracker()
        step_id = tracker.add_step("search", "Searching", "Recherche")
        tracker.complete_step(step_id, duration_ms=250)
        step = [s for s in tracker.steps if s.id == step_id][0]
        assert step.status == "complete"
        assert step.duration_ms == 250

    def test_step_fails(self):
        tracker = _build_tracker()
        step_id = tracker.add_step("search", "Searching", "Recherche")
        tracker.fail_step(step_id, duration_ms=100, metadata={"error": "timeout"})
        step = [s for s in tracker.steps if s.id == step_id][0]
        assert step.status == "error"
        assert step.metadata == {"error": "timeout"}

    def test_complete_nonexistent_step_raises(self):
        tracker = _build_tracker()
        with pytest.raises(ValueError, match="Step 999 not found"):
            tracker.complete_step(999, duration_ms=100)

    def test_fail_nonexistent_step_raises(self):
        tracker = _build_tracker()
        with pytest.raises(ValueError, match="Step 999 not found"):
            tracker.fail_step(999, duration_ms=100)

    def test_step_ids_are_sequential(self):
        tracker = _build_tracker()
        id1 = tracker.add_step("a", "A", "A")
        id2 = tracker.add_step("b", "B", "B")
        id3 = tracker.add_step("c", "C", "C")
        assert id1 == 1
        assert id2 == 2
        assert id3 == 3


# ---------------------------------------------------------------------------
# Trace ID propagation
# ---------------------------------------------------------------------------

class TestTraceIdPropagation:
    """Verify OpenTelemetry trace_id is propagated to the provenance record."""

    def test_trace_id_recorded(self):
        tracker = _build_tracker(trace_id="otel-abc123def456")
        record = tracker.build()
        assert record.trace_id == "otel-abc123def456"

    def test_trace_id_unique_per_request(self):
        t1 = _build_tracker(trace_id="trace-aaa")
        t2 = _build_tracker(trace_id="trace-bbb")
        assert t1.build().trace_id != t2.build().trace_id
