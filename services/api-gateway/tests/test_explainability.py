"""Tests for the EVA explainability engine."""

from __future__ import annotations

import pytest

from app.explainability.builder import ExplainabilityBuilder
from app.explainability.negative_evidence import NegativeEvidenceDetector
from app.explainability.reasoning import ReasoningSummarizer
from app.explainability.retrieval_path import RetrievalPathTracker

# ---------------------------------------------------------------------------
# Reasoning summarizer
# ---------------------------------------------------------------------------

class TestReasoningSummarizer:
    def setup_method(self):
        self.summarizer = ReasoningSummarizer()

    def test_all_sources_used(self):
        result = self.summarizer.summarize(
            search_query="OAS eligibility",
            sources_consulted=3,
            sources_used=3,
            sources_excluded=0,
            exclusion_reasons=[],
            answer_approach="grounded",
        )
        assert "3 sources retrieved" in result
        assert "3 selected" in result
        assert "grounded" in result
        assert "excluded" not in result

    def test_some_excluded(self):
        result = self.summarizer.summarize(
            search_query="pension benefits",
            sources_consulted=5,
            sources_used=3,
            sources_excluded=2,
            exclusion_reasons=["superseded by newer version", "below relevance threshold"],
            answer_approach="grounded",
        )
        assert "5 sources retrieved" in result
        assert "3 selected" in result
        assert "superseded by newer version" in result
        assert "below relevance threshold" in result

    def test_no_sources_found(self):
        result = self.summarizer.summarize(
            search_query="nonexistent topic",
            sources_consulted=0,
            sources_used=0,
            sources_excluded=0,
            exclusion_reasons=[],
            answer_approach="ungrounded",
        )
        assert "No sources were retrieved" in result
        assert "not grounded" in result

    def test_ungrounded_approach(self):
        result = self.summarizer.summarize(
            search_query="vague question",
            sources_consulted=2,
            sources_used=1,
            sources_excluded=1,
            exclusion_reasons=["irrelevant"],
            answer_approach="ungrounded",
        )
        assert "could not be fully grounded" in result

    def test_query_appears_in_summary(self):
        result = self.summarizer.summarize(
            search_query="OAS Act section 5",
            sources_consulted=1,
            sources_used=1,
            sources_excluded=0,
            exclusion_reasons=[],
            answer_approach="grounded",
        )
        assert "OAS Act section 5" in result


# ---------------------------------------------------------------------------
# Retrieval path tracker
# ---------------------------------------------------------------------------

class TestRetrievalPathTracker:
    def setup_method(self):
        self.tracker = RetrievalPathTracker()

    def test_add_and_list_considered(self):
        self.tracker.add_considered("doc1.pdf", 0.95, [1, 2], section="Part I")
        self.tracker.add_considered("doc2.pdf", 0.60, [5])
        assert len(self.tracker.sources_considered) == 2

    def test_mark_used(self):
        self.tracker.add_considered("doc1.pdf", 0.95, [1])
        self.tracker.mark_used("doc1.pdf")
        assert len(self.tracker.sources_used) == 1
        assert self.tracker.sources_used[0].status == "used"

    def test_mark_excluded(self):
        self.tracker.add_considered("doc2.pdf", 0.40, [3])
        self.tracker.mark_excluded("doc2.pdf", "below relevance threshold")
        excluded = self.tracker.sources_excluded
        assert len(excluded) == 1
        assert excluded[0].exclusion_reason == "below relevance threshold"

    def test_mark_used_unknown_source_raises(self):
        with pytest.raises(ValueError, match="not found"):
            self.tracker.mark_used("nonexistent.pdf")

    def test_mark_excluded_unknown_source_raises(self):
        with pytest.raises(ValueError, match="not found"):
            self.tracker.mark_excluded("nonexistent.pdf", "reason")

    def test_to_summary_no_sources(self):
        assert self.tracker.to_summary() == "No sources retrieved"

    def test_to_summary_with_exclusions(self):
        self.tracker.add_considered("a.pdf", 0.9, [1])
        self.tracker.add_considered("b.pdf", 0.3, [2])
        self.tracker.mark_used("a.pdf")
        self.tracker.mark_excluded("b.pdf", "outdated")
        summary = self.tracker.to_summary()
        assert "2 sources retrieved" in summary
        assert "1 selected" in summary
        assert "1 excluded (outdated)" in summary

    def test_to_detail_returns_all_fields(self):
        self.tracker.add_considered("doc.pdf", 0.85, [1, 2], section="S3")
        self.tracker.mark_used("doc.pdf")
        detail = self.tracker.to_detail()
        assert len(detail) == 1
        assert detail[0]["source_file"] == "doc.pdf"
        assert detail[0]["relevance_score"] == 0.85
        assert detail[0]["status"] == "used"
        assert detail[0]["page_numbers"] == [1, 2]
        assert detail[0]["section"] == "S3"

    def test_mixed_statuses(self):
        self.tracker.add_considered("a.pdf", 0.9, [1])
        self.tracker.add_considered("b.pdf", 0.5, [2])
        self.tracker.add_considered("c.pdf", 0.3, [3])
        self.tracker.mark_used("a.pdf")
        self.tracker.mark_excluded("c.pdf", "superseded")
        # b.pdf remains "considered"
        assert len(self.tracker.sources_used) == 1
        assert len(self.tracker.sources_excluded) == 1
        assert len(self.tracker.sources_considered) == 3


# ---------------------------------------------------------------------------
# Negative evidence detection
# ---------------------------------------------------------------------------

class TestNegativeEvidenceDetector:
    def setup_method(self):
        self.detector = NegativeEvidenceDetector()

    def test_no_results(self):
        negatives = self.detector.detect(
            user_query="What is the leave policy?",
            search_results=[],
            answer_text="I could not find relevant information.",
        )
        assert len(negatives) == 1
        assert "No relevant sources found" in negatives[0]

    def test_no_results_returns_early(self):
        """When there are no results, only the 'no sources' message is returned."""
        negatives = self.detector.detect(
            user_query="What does the Employment Insurance Act say about 2025?",
            search_results=[],
            answer_text="This may apply.",
        )
        # Should only have the one "no relevant sources" message
        assert len(negatives) == 1
        assert "No relevant sources found" in negatives[0]

    def test_hedging_language_detected(self):
        negatives = self.detector.detect(
            user_query="What is the policy?",
            search_results=[{"content": "Some policy text", "file": "policy.pdf"}],
            answer_text="The employee may be eligible for benefits, but it is unclear whether this applies.",
        )
        assert any("hedging" in n.lower() for n in negatives)

    def test_no_hedging_when_definitive(self):
        negatives = self.detector.detect(
            user_query="What is the policy?",
            search_results=[{"content": "Policy details here", "file": "policy.pdf"}],
            answer_text="The policy requires annual review of all benefits.",
        )
        assert not any("hedging" in n.lower() for n in negatives)

    def test_missing_date_range(self):
        negatives = self.detector.detect(
            user_query="What amendments were made in 2024?",
            search_results=[{"content": "Amendment from 2023", "file": "amend.pdf"}],
            answer_text="The following amendments were found.",
        )
        assert any("2024" in n for n in negatives)

    def test_date_range_covered(self):
        negatives = self.detector.detect(
            user_query="What amendments were made in 2024?",
            search_results=[{"content": "Amendment from 2024-03-15", "file": "amend.pdf"}],
            answer_text="The 2024 amendment updated section 5.",
        )
        assert not any("2024" in n for n in negatives)

    def test_missing_act_reference(self):
        negatives = self.detector.detect(
            user_query="What does the Employment Insurance Act say about parental leave?",
            search_results=[{"content": "Parental leave info", "file": "leave.pdf"}],
            answer_text="Parental leave is available for eligible employees.",
        )
        assert any("Employment Insurance Act" in n for n in negatives)

    def test_act_reference_found(self):
        negatives = self.detector.detect(
            user_query="What does the Employment Insurance Act say?",
            search_results=[
                {"content": "Under the Employment Insurance Act, section 12...", "file": "ei.pdf"}
            ],
            answer_text="The Employment Insurance Act provides benefits.",
        )
        assert not any("Employment Insurance Act" in n for n in negatives)

    def test_french_act_detection(self):
        negatives = self.detector.detect(
            user_query="Que dit la Loi sur l'assurance-emploi concernant le congé?",
            search_results=[{"content": "Information sur le congé", "file": "conge.pdf"}],
            answer_text="Le congé est disponible.",
        )
        assert any("assurance-emploi" in n.lower() for n in negatives)

    def test_multiple_negatives(self):
        negatives = self.detector.detect(
            user_query="What does the Canada Labour Code say about 2025 amendments?",
            search_results=[{"content": "General labour info from 2023", "file": "labour.pdf"}],
            answer_text="The rules may apply to certain employees.",
        )
        # Should detect: hedging ("may"), missing date (2025), missing Act (Canada Labour Code)
        assert len(negatives) >= 2


# ---------------------------------------------------------------------------
# Explainability builder
# ---------------------------------------------------------------------------

class TestExplainabilityBuilder:
    def test_builds_complete_record(self):
        builder = ExplainabilityBuilder()
        builder.retrieval_tracker.add_considered("doc1.pdf", 0.9, [1, 2], section="Part I")
        builder.retrieval_tracker.add_considered("doc2.pdf", 0.3, [5])
        builder.retrieval_tracker.mark_used("doc1.pdf")
        builder.retrieval_tracker.mark_excluded("doc2.pdf", "below relevance threshold")

        record = builder.build(
            user_query="What is the OAS eligibility?",
            search_query="OAS eligibility criteria",
            search_results=[{"content": "OAS eligibility...", "file": "doc1.pdf"}],
            answer_text="Eligibility requires 10 years of residence.",
            answer_approach="grounded",
        )

        assert "2 sources retrieved" in record.retrieval_summary
        assert "1 selected" in record.retrieval_summary
        assert "excluded" in record.retrieval_summary

        assert "OAS eligibility criteria" in record.reasoning_summary
        assert "grounded" in record.reasoning_summary

        assert record.cross_language is None

    def test_cross_language_disclosure(self):
        builder = ExplainabilityBuilder()
        builder.retrieval_tracker.add_considered("loi.pdf", 0.8, [1])
        builder.retrieval_tracker.mark_used("loi.pdf")

        record = builder.build(
            user_query="What does the law say?",
            search_query="law provisions",
            search_results=[{"content": "Texte de loi", "file": "loi.pdf"}],
            answer_text="The law provides...",
            answer_approach="grounded",
            source_language="fr",
            query_language="en",
        )

        assert record.cross_language is not None
        assert "en" in record.cross_language
        assert "fr" in record.cross_language
        assert "cross-language" in record.cross_language

    def test_no_cross_language_when_same(self):
        builder = ExplainabilityBuilder()
        builder.retrieval_tracker.add_considered("doc.pdf", 0.9, [1])
        builder.retrieval_tracker.mark_used("doc.pdf")

        record = builder.build(
            user_query="Test query",
            search_query="test",
            search_results=[{"content": "test", "file": "doc.pdf"}],
            answer_text="Test answer.",
            answer_approach="grounded",
            source_language="en",
            query_language="en",
        )

        assert record.cross_language is None

    def test_negative_evidence_included(self):
        builder = ExplainabilityBuilder()

        record = builder.build(
            user_query="What does the Employment Insurance Act say?",
            search_query="employment insurance",
            search_results=[{"content": "General info", "file": "general.pdf"}],
            answer_text="Benefits may be available.",
            answer_approach="ungrounded",
        )

        # Should have negative evidence (hedging and missing Act)
        assert len(record.negative_evidence) >= 1

    def test_empty_retrieval(self):
        builder = ExplainabilityBuilder()

        record = builder.build(
            user_query="Something obscure",
            search_query="obscure topic",
            search_results=[],
            answer_text="No information available.",
            answer_approach="ungrounded",
        )

        assert "No sources retrieved" in record.retrieval_summary
        assert "No sources were retrieved" in record.reasoning_summary
        assert any("No relevant sources" in n for n in record.negative_evidence)

    def test_record_is_explainability_record_type(self):
        from app.provenance.models import ExplainabilityRecord

        builder = ExplainabilityBuilder()
        record = builder.build(
            user_query="test",
            search_query="test",
            search_results=[],
            answer_text="No data.",
            answer_approach="ungrounded",
        )
        assert isinstance(record, ExplainabilityRecord)
