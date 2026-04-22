from __future__ import annotations

import time

from .models import (
    AgentStep,
    BehavioralFingerprint,
    Citation,
    ConfidenceFactors,
    ExplainabilityRecord,
    FreshnessInfo,
    ProvenanceRecord,
)


class ProvenanceTracker:
    """Assembles provenance for a single request.

    Created per-request, accumulates data from each tool invocation,
    and builds the final ProvenanceRecord when the response is ready.
    """

    def __init__(self, correlation_id: str, agent_id: str, trace_id: str) -> None:
        self._correlation_id = correlation_id
        self._agent_id = agent_id
        self._trace_id = trace_id

        self._delegation_chain: list[str] = []
        self._sources_consulted: int = 0
        self._citations: list[Citation] = []
        self._exclusion_reasons: list[str] = []
        self._policies_applied: list[str] = []
        self._confidence_factors: ConfidenceFactors | None = None
        self._freshness: FreshnessInfo | None = None
        self._explainability: ExplainabilityRecord | None = None
        self._escalation_tier: str = "auto-resolve"
        self._behavioral_fingerprint: BehavioralFingerprint | None = None

        self._steps: list[AgentStep] = []
        self._step_start_times: dict[int, float] = {}
        self._next_step_id: int = 1

    # -- Steps -----------------------------------------------------------------

    def add_step(self, tool: str, label_en: str, label_fr: str) -> int:
        """Register a new agent step and return its ID."""
        step_id = self._next_step_id
        self._next_step_id += 1

        step = AgentStep(
            id=step_id,
            tool=tool,
            status="running",
            label_en=label_en,
            label_fr=label_fr,
            duration_ms=None,
            metadata=None,
        )
        self._steps.append(step)
        self._step_start_times[step_id] = time.monotonic()
        self._delegation_chain.append(tool)
        return step_id

    def complete_step(self, step_id: int, duration_ms: int, metadata: dict | None = None) -> None:
        """Mark a step as complete with its duration and optional metadata."""
        for step in self._steps:
            if step.id == step_id:
                step.status = "complete"
                step.duration_ms = duration_ms
                step.metadata = metadata
                self._step_start_times.pop(step_id, None)
                return
        raise ValueError(f"Step {step_id} not found")

    def fail_step(self, step_id: int, duration_ms: int, metadata: dict | None = None) -> None:
        """Mark a step as errored."""
        for step in self._steps:
            if step.id == step_id:
                step.status = "error"
                step.duration_ms = duration_ms
                step.metadata = metadata
                self._step_start_times.pop(step_id, None)
                return
        raise ValueError(f"Step {step_id} not found")

    # -- Source tracking -------------------------------------------------------

    def add_source_consulted(self, count: int) -> None:
        """Increment the number of sources retrieved before filtering."""
        self._sources_consulted += count

    def add_source_cited(self, citation: Citation) -> None:
        """Record a citation that will appear in the answer."""
        self._citations.append(citation)

    def add_source_excluded(self, reason: str) -> None:
        """Record why a source was excluded from the answer."""
        self._exclusion_reasons.append(reason)

    # -- Policy & governance ---------------------------------------------------

    def add_policy_applied(self, policy: str) -> None:
        """Record a guardrail policy that was enforced."""
        if policy not in self._policies_applied:
            self._policies_applied.append(policy)

    def set_escalation_tier(self, tier: str) -> None:
        """Set the escalation classification for this response."""
        self._escalation_tier = tier

    # -- Confidence & freshness ------------------------------------------------

    def set_confidence(self, factors: ConfidenceFactors) -> None:
        """Set the confidence breakdown for this response."""
        self._confidence_factors = factors

    def set_freshness(self, info: FreshnessInfo) -> None:
        """Set the temporal validity metadata."""
        self._freshness = info

    # -- Explainability --------------------------------------------------------

    def set_explainability(self, record: ExplainabilityRecord) -> None:
        """Set the human-readable explanation record."""
        self._explainability = record

    # -- Behavioral fingerprint ------------------------------------------------

    def set_behavioral_fingerprint(self, fingerprint: BehavioralFingerprint) -> None:
        """Set the software version snapshot that produced this answer."""
        self._behavioral_fingerprint = fingerprint

    # -- Build -----------------------------------------------------------------

    def build(self) -> ProvenanceRecord:
        """Assemble the final ProvenanceRecord from accumulated data."""
        if self._confidence_factors is None:
            raise ValueError("confidence_factors must be set before building provenance")
        if self._freshness is None:
            raise ValueError("freshness must be set before building provenance")
        if self._behavioral_fingerprint is None:
            raise ValueError("behavioral_fingerprint must be set before building provenance")

        confidence = (
            self._confidence_factors.retrieval_relevance * 0.4
            + self._confidence_factors.source_coverage * 0.3
            + self._confidence_factors.grounding_quality * 0.3
        )

        return ProvenanceRecord(
            correlation_id=self._correlation_id,
            agent_id=self._agent_id,
            delegation_chain=self._delegation_chain,
            sources_consulted=self._sources_consulted,
            sources_cited=len(self._citations),
            sources_excluded=len(self._exclusion_reasons),
            exclusion_reasons=self._exclusion_reasons,
            policies_applied=self._policies_applied,
            confidence=round(confidence, 4),
            confidence_factors=self._confidence_factors,
            escalation_tier=self._escalation_tier,
            freshness=self._freshness,
            behavioral_fingerprint=self._behavioral_fingerprint,
            trace_id=self._trace_id,
        )

    @property
    def steps(self) -> list[AgentStep]:
        """Return a copy of the current steps list."""
        return list(self._steps)

    @property
    def citations(self) -> list[Citation]:
        """Return a copy of accumulated citations."""
        return list(self._citations)

    @property
    def explainability(self) -> ExplainabilityRecord | None:
        """Return the explainability record, if set."""
        return self._explainability
