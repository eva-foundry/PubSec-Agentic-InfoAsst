"""Explainability record builder.

Assembles the complete ExplainabilityRecord from retrieval path tracking,
reasoning summaries, and negative evidence detection.
"""

from __future__ import annotations

from ..provenance.models import ExplainabilityRecord
from .negative_evidence import NegativeEvidenceDetector
from .reasoning import ReasoningSummarizer
from .retrieval_path import RetrievalPathTracker


class ExplainabilityBuilder:
    """Assembles ExplainabilityRecord from retrieval path, reasoning, and negative evidence."""

    def __init__(self) -> None:
        self.retrieval_tracker = RetrievalPathTracker()
        self.reasoning_summarizer = ReasoningSummarizer()
        self.negative_detector = NegativeEvidenceDetector()

    def build(
        self,
        user_query: str,
        search_query: str,
        search_results: list[dict],
        answer_text: str,
        answer_approach: str,
        source_language: str | None = None,
        query_language: str | None = None,
    ) -> ExplainabilityRecord:
        """Assemble the full explainability record.

        Combines:
        - retrieval_summary from RetrievalPathTracker
        - reasoning_summary from ReasoningSummarizer
        - negative_evidence from NegativeEvidenceDetector
        - cross_language disclosure when source and query languages differ

        Args:
            user_query: The user's original question.
            search_query: The search query derived from the user question.
            search_results: List of search result dicts.
            answer_text: The generated answer text.
            answer_approach: "grounded" or "ungrounded".
            source_language: Language of the retrieved sources (e.g. "en", "fr").
            query_language: Language of the user's query (e.g. "en", "fr").

        Returns:
            Complete ExplainabilityRecord ready for provenance attachment.
        """
        # Retrieval summary from the tracker
        retrieval_summary = self.retrieval_tracker.to_summary()

        # Reasoning summary from the summarizer
        excluded = self.retrieval_tracker.sources_excluded
        exclusion_reasons = [s.exclusion_reason or "unspecified reason" for s in excluded]
        reasoning_summary = self.reasoning_summarizer.summarize(
            search_query=search_query,
            sources_consulted=len(self.retrieval_tracker.sources_considered),
            sources_used=len(self.retrieval_tracker.sources_used),
            sources_excluded=len(excluded),
            exclusion_reasons=exclusion_reasons,
            answer_approach=answer_approach,
        )

        # Negative evidence
        negative_evidence = self.negative_detector.detect(
            user_query=user_query,
            search_results=search_results,
            answer_text=answer_text,
        )

        # Cross-language disclosure
        cross_language: str | None = None
        if source_language and query_language and source_language.lower() != query_language.lower():
            cross_language = (
                f"Query in {query_language}; "
                f"sources in {source_language}; "
                f"cross-language retrieval applied"
            )

        return ExplainabilityRecord(
            retrieval_summary=retrieval_summary,
            reasoning_summary=reasoning_summary,
            negative_evidence=negative_evidence,
            cross_language=cross_language,
        )
