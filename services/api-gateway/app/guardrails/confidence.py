from __future__ import annotations

from ..provenance.models import ConfidenceFactors


class ConfidenceScorer:
    """Computes confidence score for an agent response."""

    def score(
        self,
        retrieval_scores: list[float],
        sources_consulted: int,
        sources_cited: int,
        grounding_ratio: float,
    ) -> ConfidenceFactors:
        """Weighted formula producing a ConfidenceFactors breakdown.

        - retrieval_relevance = avg of retrieval scores (0-1), 0 if empty
        - source_coverage = min(sources_cited / max(sources_consulted, 1), 1.0)
        - grounding_quality = grounding_ratio clamped to [0, 1]
        """
        retrieval_relevance = (
            sum(retrieval_scores) / len(retrieval_scores) if retrieval_scores else 0.0
        )
        retrieval_relevance = max(0.0, min(1.0, retrieval_relevance))

        source_coverage = min(sources_cited / max(sources_consulted, 1), 1.0)

        grounding_quality = max(0.0, min(1.0, grounding_ratio))

        return ConfidenceFactors(
            retrieval_relevance=retrieval_relevance,
            source_coverage=source_coverage,
            grounding_quality=grounding_quality,
        )

    def overall(self, factors: ConfidenceFactors) -> float:
        """Overall confidence = 0.4 * retrieval + 0.3 * coverage + 0.3 * grounding."""
        return (
            0.4 * factors.retrieval_relevance
            + 0.3 * factors.source_coverage
            + 0.3 * factors.grounding_quality
        )
