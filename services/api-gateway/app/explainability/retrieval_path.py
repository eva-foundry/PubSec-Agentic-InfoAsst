"""Retrieval path tracking for explainability.

Tracks which sources were considered, used, and excluded during retrieval,
providing both human-readable summaries and auditor-level detail.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RetrievalStep:
    """A single source considered during retrieval."""

    source_file: str
    relevance_score: float
    status: str  # "used" | "excluded" | "considered"
    exclusion_reason: str | None = None
    page_numbers: list[int] = field(default_factory=list)
    section: str | None = None


class RetrievalPathTracker:
    """Tracks the full retrieval path for explainability.

    Usage:
        tracker = RetrievalPathTracker()
        tracker.add_considered("oas_act.pdf", 0.92, [1, 2, 3], section="Part I")
        tracker.add_considered("ei_act.pdf", 0.45, [10])
        tracker.mark_used("oas_act.pdf")
        tracker.mark_excluded("ei_act.pdf", "below relevance threshold")
    """

    def __init__(self) -> None:
        self._steps: list[RetrievalStep] = []

    def add_considered(
        self,
        source_file: str,
        relevance_score: float,
        page_numbers: list[int],
        section: str | None = None,
    ) -> None:
        """Register a source as considered during retrieval."""
        self._steps.append(
            RetrievalStep(
                source_file=source_file,
                relevance_score=relevance_score,
                status="considered",
                page_numbers=page_numbers,
                section=section,
            )
        )

    def mark_used(self, source_file: str) -> None:
        """Promote a considered source to 'used' status."""
        for step in self._steps:
            if step.source_file == source_file and step.status == "considered":
                step.status = "used"
                return
        raise ValueError(f"Source not found or not in 'considered' status: {source_file}")

    def mark_excluded(self, source_file: str, reason: str) -> None:
        """Mark a considered source as excluded with a reason."""
        for step in self._steps:
            if step.source_file == source_file and step.status == "considered":
                step.status = "excluded"
                step.exclusion_reason = reason
                return
        raise ValueError(f"Source not found or not in 'considered' status: {source_file}")

    @property
    def sources_considered(self) -> list[RetrievalStep]:
        """All sources that were considered (regardless of final status)."""
        return list(self._steps)

    @property
    def sources_used(self) -> list[RetrievalStep]:
        """Sources that were used in the final answer."""
        return [s for s in self._steps if s.status == "used"]

    @property
    def sources_excluded(self) -> list[RetrievalStep]:
        """Sources that were excluded from the final answer."""
        return [s for s in self._steps if s.status == "excluded"]

    def to_summary(self) -> str:
        """Human-readable retrieval path summary.

        Example output:
            "3 sources retrieved; 2 selected based on relevance;
             1 excluded (below relevance threshold)"
        """
        total = len(self._steps)
        used = len(self.sources_used)
        excluded = self.sources_excluded

        if total == 0:
            return "No sources retrieved"

        parts = [f"{total} sources retrieved"]
        if used > 0:
            parts.append(f"{used} selected based on relevance")

        for step in excluded:
            reason = step.exclusion_reason or "unspecified reason"
            parts.append(f"1 excluded ({reason})")

        return "; ".join(parts)

    def to_detail(self) -> list[dict]:
        """Auditor-level detail: full list of all steps with scores."""
        return [
            {
                "source_file": step.source_file,
                "relevance_score": step.relevance_score,
                "status": step.status,
                "exclusion_reason": step.exclusion_reason,
                "page_numbers": step.page_numbers,
                "section": step.section,
            }
            for step in self._steps
        ]
