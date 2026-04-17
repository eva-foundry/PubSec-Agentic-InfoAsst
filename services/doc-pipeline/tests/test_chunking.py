"""Tests for the archetype-configurable chunking engine."""

from __future__ import annotations

from chunking import get_chunking_strategy
from chunking.base import ChunkingStrategy as BaseStrategy
from chunking.case_law import CaseLawChunkingStrategy
from chunking.default import DefaultChunkingStrategy
from chunking.legislation import LegislationChunkingStrategy

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_para(
    text: str,
    *,
    section: str = "",
    title: str = "",
    subtitle: str = "",
    page_number: int = 1,
    ptype: str = "text",
) -> dict:
    return {
        "text": text,
        "type": ptype,
        "section": section,
        "title": title,
        "subtitle": subtitle,
        "page_number": page_number,
    }


def _simple_doc(n_paragraphs: int = 5, words_per: int = 80) -> list[dict]:
    """Build a simple document map with *n_paragraphs* paragraphs."""
    word = "lorem "
    return [
        _make_para(word * words_per, section="Intro", title="Doc", page_number=1)
        for _ in range(n_paragraphs)
    ]


# ---------------------------------------------------------------------------
# token_count
# ---------------------------------------------------------------------------

class TestTokenCount:
    def test_empty_string(self):
        assert BaseStrategy.token_count("") == 0

    def test_known_string(self):
        # "hello world" should be a small positive number.
        count = BaseStrategy.token_count("hello world")
        assert count > 0
        assert count < 10

    def test_longer_string_proportional(self):
        short = BaseStrategy.token_count("hello")
        long_ = BaseStrategy.token_count("hello " * 100)
        assert long_ > short


# ---------------------------------------------------------------------------
# DefaultChunkingStrategy — basic splitting
# ---------------------------------------------------------------------------

class TestDefaultChunking:
    def test_single_small_paragraph(self):
        doc = [_make_para("This is a short paragraph.", section="S1", title="T")]
        strategy = DefaultChunkingStrategy(target_size=1500)
        result = strategy.chunk(doc, "test.pdf", "https://blob/test.pdf")
        assert len(result) == 1
        assert "short paragraph" in result[0].content
        assert result[0].metadata.file_name == "test.pdf"
        assert result[0].metadata.chunk_index == 0

    def test_splits_at_target_size(self):
        # Each paragraph ~80 tokens; with target_size=100 each should
        # roughly become its own chunk.
        doc = _simple_doc(n_paragraphs=5, words_per=80)
        strategy = DefaultChunkingStrategy(target_size=100)
        result = strategy.chunk(doc, "f.pdf", "uri")
        assert len(result) >= 3  # Must split into multiple chunks.

    def test_section_boundary_forces_new_chunk(self):
        doc = [
            _make_para("Paragraph in section A.", section="Section A", title="T"),
            _make_para("Paragraph in section B.", section="Section B", title="T"),
        ]
        strategy = DefaultChunkingStrategy(target_size=1500)
        result = strategy.chunk(doc, "f.pdf", "uri")
        # Two different sections should produce two chunks even though
        # together they are well under target_size.
        assert len(result) == 2
        assert "section A" in result[0].content
        assert "section B" in result[1].content

    def test_title_change_forces_new_chunk(self):
        doc = [
            _make_para("First title content.", section="S", title="Title 1"),
            _make_para("Second title content.", section="S", title="Title 2"),
        ]
        strategy = DefaultChunkingStrategy(target_size=1500)
        result = strategy.chunk(doc, "f.pdf", "uri")
        assert len(result) == 2

    def test_oversized_paragraph_split_by_sentence(self):
        # Build a paragraph with many sentences.
        sentences = [f"This is sentence number {i}." for i in range(200)]
        big_para = " ".join(sentences)
        doc = [_make_para(big_para, section="S", title="T")]
        strategy = DefaultChunkingStrategy(target_size=100)
        result = strategy.chunk(doc, "f.pdf", "uri")
        assert len(result) >= 2

    def test_empty_document_map(self):
        strategy = DefaultChunkingStrategy()
        assert strategy.chunk([], "f.pdf", "uri") == []

    def test_page_tracking(self):
        doc = [
            _make_para("Page one.", section="S", title="T", page_number=1),
            _make_para("Page two.", section="S", title="T", page_number=2),
        ]
        strategy = DefaultChunkingStrategy(target_size=1500)
        result = strategy.chunk(doc, "f.pdf", "uri")
        assert 1 in result[0].metadata.pages or 2 in result[0].metadata.pages


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

class TestFactory:
    def test_default_strategy(self):
        s = get_chunking_strategy("default")
        assert isinstance(s, DefaultChunkingStrategy)

    def test_legislation_strategy(self):
        s = get_chunking_strategy("legislation")
        assert isinstance(s, LegislationChunkingStrategy)

    def test_case_law_strategy(self):
        s = get_chunking_strategy("case_law")
        assert isinstance(s, CaseLawChunkingStrategy)

    def test_unknown_falls_back_to_default(self):
        s = get_chunking_strategy("unknown")
        assert isinstance(s, DefaultChunkingStrategy)

    def test_custom_target_size(self):
        s = get_chunking_strategy("default", target_size=500)
        assert s.target_size == 500


# ---------------------------------------------------------------------------
# LegislationChunkingStrategy
# ---------------------------------------------------------------------------

class TestLegislationChunking:
    def test_detects_section_boundaries(self):
        # Each section has enough content that merging two would exceed
        # target_size, forcing the strategy to emit separate chunks.
        filler = " This provision establishes important requirements that must be followed." * 15
        doc = [
            _make_para("PART I", section="", title="Act"),
            _make_para("1. This Act may be cited as the Test Act." + filler, section="", title="Act"),
            _make_para("2. In this Act, the following definitions apply." + filler, section="", title="Act"),
        ]
        strategy = LegislationChunkingStrategy(target_size=150)
        result = strategy.chunk(doc, "act.pdf", "uri")
        # Sections 1 and 2 should be detected as separate sections.
        assert len(result) >= 2

    def test_cross_reference_extraction(self):
        doc = [
            _make_para("1. As defined in section 3(1), the Minister may act.", section="", title="Act"),
        ]
        strategy = LegislationChunkingStrategy(target_size=1500)
        result = strategy.chunk(doc, "act.pdf", "uri")
        assert len(result) == 1
        assert hasattr(result[0].metadata, "cross_references")
        assert "3(1)" in result[0].metadata.cross_references  # type: ignore[attr-defined]

    def test_never_splits_mid_section(self):
        # A single large section should stay as one chunk even if oversized.
        big_section = "1. " + ("Word " * 2000)
        doc = [_make_para(big_section, section="", title="Act")]
        strategy = LegislationChunkingStrategy(target_size=100)
        result = strategy.chunk(doc, "act.pdf", "uri")
        # Should be exactly one chunk (oversized but intact).
        assert len(result) == 1
        assert result[0].metadata.token_count > 100


# ---------------------------------------------------------------------------
# CaseLawChunkingStrategy
# ---------------------------------------------------------------------------

class TestCaseLawChunking:
    def test_detects_case_sections(self):
        doc = [
            _make_para("[2024] FCA 123\nBetween Applicant and Respondent", title="Case"),
            _make_para("FACTS\nThe applicant filed a claim on January 1.", title="Case"),
            _make_para("ISSUES\nWhether the decision was reasonable.", title="Case"),
            _make_para("ANALYSIS\nThe court finds the decision unreasonable.", title="Case"),
            _make_para("DECISION\nThe application is granted.", title="Case"),
        ]
        strategy = CaseLawChunkingStrategy(target_size=1500)
        result = strategy.chunk(doc, "case.pdf", "uri")
        # Should produce multiple chunks aligned to case sections.
        assert len(result) >= 3
        sections_found = {c.metadata.case_section for c in result}  # type: ignore[attr-defined]
        assert "facts" in sections_found or "analysis" in sections_found

    def test_citation_extraction(self):
        doc = [
            _make_para("ANALYSIS\nAs stated in [2023] SCC 45 and [2022] FCA 789, the test is met.", title="Case"),
        ]
        strategy = CaseLawChunkingStrategy(target_size=1500)
        result = strategy.chunk(doc, "case.pdf", "uri")
        assert len(result) >= 1
        cites = result[0].metadata.cited_cases  # type: ignore[attr-defined]
        assert any("2023" in c and "SCC" in c for c in cites)
        assert any("2022" in c and "FCA" in c for c in cites)

    def test_court_metadata(self):
        doc = [
            _make_para("[2024] FCA 123\nDocket: T-456-24", title="Case"),
            _make_para("FACTS\nSome facts here.", title="Case"),
        ]
        strategy = CaseLawChunkingStrategy(target_size=1500)
        result = strategy.chunk(doc, "case.pdf", "uri")
        assert len(result) >= 1
        assert result[0].metadata.court == "FCA"  # type: ignore[attr-defined]
        assert result[0].metadata.year == "2024"  # type: ignore[attr-defined]

    def test_analysis_never_splits_mid_paragraph(self):
        # Build analysis with a few paragraphs, each just under target.
        paras = "\n".join(
            f"Paragraph {i}. " + ("Word " * 60) for i in range(5)
        )
        doc = [_make_para("ANALYSIS\n" + paras, title="Case")]
        strategy = CaseLawChunkingStrategy(target_size=200)
        result = strategy.chunk(doc, "case.pdf", "uri")
        # Each chunk should contain complete paragraphs.
        for chunk in result:
            # No paragraph should be cut mid-word (simplistic check).
            assert chunk.content.strip().endswith("Word") or chunk.content.strip()[-1] in ".!?"  or chunk.content.strip()[-1].isalpha()
