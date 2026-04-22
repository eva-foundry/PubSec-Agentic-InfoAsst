"""Citation-graph-aware chunking strategy for court and tribunal decisions.

Preserves case structure (header, facts, issues, analysis, decision) and
extracts citations to other cases as metadata for downstream graph
construction.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum, auto

from .base import Chunk, ChunkingStrategy, ChunkMetadata

# ---------------------------------------------------------------------------
# Case structure detection
# ---------------------------------------------------------------------------


class _CaseSection(Enum):
    HEADER = auto()
    FACTS = auto()
    ISSUES = auto()
    ANALYSIS = auto()
    DECISION = auto()
    UNKNOWN = auto()


# Heading patterns that signal a structural section of a court decision.
_SECTION_PATTERNS: list[tuple[re.Pattern[str], _CaseSection]] = [
    # English
    (
        re.compile(r"^\s*(?:I+\.?\s+)?(?:INTRODUCTION|OVERVIEW)", re.I | re.M),
        _CaseSection.HEADER,
    ),
    (
        re.compile(
            r"^\s*(?:I+\.?\s+)?(?:BACKGROUND|FACTS|FACTUAL\s+BACKGROUND|STATEMENT\s+OF\s+FACTS)",
            re.I | re.M,
        ),
        _CaseSection.FACTS,
    ),
    (
        re.compile(
            r"^\s*(?:I+\.?\s+)?(?:ISSUES?|QUESTIONS?\s+(?:IN\s+ISSUE|PRESENTED|TO\s+BE\s+DETERMINED))",
            re.I | re.M,
        ),
        _CaseSection.ISSUES,
    ),
    (
        re.compile(
            r"^\s*(?:I+\.?\s+)?(?:ANALYSIS|REASONING|DISCUSSION|LAW\s+AND\s+ANALYSIS|APPLICABLE\s+LAW)",
            re.I | re.M,
        ),
        _CaseSection.ANALYSIS,
    ),
    (
        re.compile(
            r"^\s*(?:I+\.?\s+)?(?:DECISION|ORDER|CONCLUSION|DISPOSITION|JUDGMENT|REMEDY|RELIEF)",
            re.I | re.M,
        ),
        _CaseSection.DECISION,
    ),
    # French
    (
        re.compile(r"^\s*(?:I+\.?\s+)?(?:CONTEXTE|FAITS)", re.I | re.M),
        _CaseSection.FACTS,
    ),
    (
        re.compile(r"^\s*(?:I+\.?\s+)?(?:QUESTIONS?\s+EN\s+LITIGE)", re.I | re.M),
        _CaseSection.ISSUES,
    ),
    (
        re.compile(r"^\s*(?:I+\.?\s+)?(?:ANALYSE|RAISONNEMENT|MOTIFS)", re.I | re.M),
        _CaseSection.ANALYSIS,
    ),
    (
        re.compile(
            r"^\s*(?:I+\.?\s+)?(?:D[ÉE]CISION|ORDONNANCE|DISPOSITIF|JUGEMENT)",
            re.I | re.M,
        ),
        _CaseSection.DECISION,
    ),
]

# ---------------------------------------------------------------------------
# Citation extraction
# ---------------------------------------------------------------------------

# Neutral citation: [2024] FCA 123, [2023] SCC 45, 2024 ONCA 789
_NEUTRAL_CITE_RE = re.compile(
    r"\[?\d{4}\]?\s+[A-Z]{2,10}\s+\d+",
)

# Traditional reporter: (2024), 456 D.L.R. (4th) 123
_REPORTER_CITE_RE = re.compile(
    r"\(\d{4}\),?\s+\d+\s+[A-Z][A-Za-z.]+(?:\s+\([A-Za-z0-9]+\))?\s+\d+",
)

# Statute style: Act, 1985, c. C-46, s. 12
_RSC_CITE_RE = re.compile(
    r"R\.S\.C\.?,?\s*\d{4},?\s*c\.\s*[A-Z]-?\d+",
    re.IGNORECASE,
)

# Docket numbers: T-1234-22, A-567-21, IMM-1234-23
_DOCKET_RE = re.compile(
    r"\b[A-Z]{1,4}-\d{2,6}-\d{2,4}\b",
)

# Court + year from neutral citation header line.
_COURT_YEAR_RE = re.compile(
    r"\[?(\d{4})\]?\s+([A-Z]{2,10})\s+(\d+)",
)


def _extract_citations(text: str) -> list[str]:
    """Extract all case citations from *text*."""
    cites: set[str] = set()
    for m in _NEUTRAL_CITE_RE.finditer(text):
        cites.add(m.group(0).strip())
    for m in _REPORTER_CITE_RE.finditer(text):
        cites.add(m.group(0).strip())
    for m in _RSC_CITE_RE.finditer(text):
        cites.add(m.group(0).strip())
    return sorted(cites)


def _extract_court_metadata(text: str) -> dict[str, str]:
    """Try to extract court, year, and docket from the first few paragraphs."""
    meta: dict[str, str] = {}
    m = _COURT_YEAR_RE.search(text[:2000])
    if m:
        meta["year"] = m.group(1)
        meta["court"] = m.group(2)
        meta["docket_number"] = m.group(3)

    # Try docket pattern if not found.
    if "docket_number" not in meta:
        dm = _DOCKET_RE.search(text[:2000])
        if dm:
            meta["docket_number"] = dm.group(0)

    return meta


@dataclass
class _CaseNode:
    """Intermediate grouping of paragraphs by case section."""

    case_section: _CaseSection = _CaseSection.UNKNOWN
    text: str = ""
    pages: list[int] = field(default_factory=list)
    title: str = ""
    subtitle: str = ""
    section: str = ""
    cited_cases: list[str] = field(default_factory=list)


class CaseLawChunkingStrategy(ChunkingStrategy):
    """Chunks court/tribunal decisions respecting case structure.

    Paragraphs are grouped by detected case section (header, facts,
    issues, analysis, decision).  Within each section, paragraphs are
    accumulated up to ``target_size``, but a chunk boundary is never
    placed mid-paragraph inside the analysis section — analysis
    paragraphs are kept whole even if slightly oversized.

    Citations to other cases are extracted via regex and stored on each
    chunk's metadata as ``cited_cases``.
    """

    def chunk(
        self,
        document_map: list[dict],
        file_name: str,
        file_uri: str,
    ) -> list[Chunk]:
        if not document_map:
            return []

        nodes = self._build_nodes(document_map)
        court_meta = _extract_court_metadata(
            "\n".join(p.get("text", "") for p in document_map[:10])
        )
        return self._nodes_to_chunks(nodes, file_name, file_uri, court_meta)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_section(text: str) -> _CaseSection | None:
        """Return the case section if *text* is a section heading."""
        for pattern, section in _SECTION_PATTERNS:
            if pattern.search(text):
                return section
        return None

    def _build_nodes(self, document_map: list[dict]) -> list[_CaseNode]:
        """Group document-map paragraphs into case-section nodes."""
        nodes: list[_CaseNode] = []
        current = _CaseNode(case_section=_CaseSection.HEADER)
        active_section = _CaseSection.HEADER

        for para in document_map:
            text: str = para.get("text", "")
            page: int = para.get("page_number", 0)

            detected = self._detect_section(text)
            if detected is not None and detected != active_section:
                if current.text.strip():
                    nodes.append(current)
                active_section = detected
                current = _CaseNode(case_section=active_section)

            current.title = para.get("title", "")
            current.subtitle = para.get("subtitle", "")
            current.section = para.get("section", "")
            current.text = (current.text + "\n" + text) if current.text else text
            if page and page not in current.pages:
                current.pages.append(page)

            cites = _extract_citations(text)
            for c in cites:
                if c not in current.cited_cases:
                    current.cited_cases.append(c)

        if current.text.strip():
            nodes.append(current)

        return nodes

    def _nodes_to_chunks(
        self,
        nodes: list[_CaseNode],
        file_name: str,
        file_uri: str,
        court_meta: dict[str, str],
    ) -> list[Chunk]:
        """Convert case-section nodes into sized chunks.

        Within the analysis section, paragraphs are never split — they
        may produce slightly oversized chunks to preserve reasoning
        integrity.
        """
        chunks: list[Chunk] = []
        chunk_index = 0

        def _make_chunk(
            node: _CaseNode, text: str, pages: list[int], cites: list[str]
        ) -> None:
            nonlocal chunk_index
            if not text.strip():
                return
            tc = self.token_count(text)
            meta = ChunkMetadata(
                file_name=file_name,
                file_uri=file_uri,
                file_class="text",
                title=node.title,
                subtitle=node.subtitle,
                section=node.section,
                pages=list(pages),
                token_count=tc,
                chunk_index=chunk_index,
            )
            # Extra case-law metadata.
            meta.case_section = node.case_section.name.lower()  # type: ignore[attr-defined]
            meta.cited_cases = list(cites)  # type: ignore[attr-defined]
            meta.court = court_meta.get("court", "")  # type: ignore[attr-defined]
            meta.year = court_meta.get("year", "")  # type: ignore[attr-defined]
            meta.docket_number = court_meta.get("docket_number", "")  # type: ignore[attr-defined]

            chunks.append(Chunk(content=text, metadata=meta))
            chunk_index += 1

        for node in nodes:
            # For analysis sections, split on paragraph boundaries only,
            # never mid-paragraph.
            if node.case_section == _CaseSection.ANALYSIS:
                self._chunk_analysis(node, _make_chunk)
            else:
                # Other sections use straightforward size-based splitting.
                self._chunk_generic(node, _make_chunk)

        return chunks

    def _chunk_analysis(
        self,
        node: _CaseNode,
        emit: callable,  # type: ignore[valid-type]
    ) -> None:
        """Chunk an analysis node respecting paragraph boundaries."""
        paragraphs = [p for p in node.text.split("\n") if p.strip()]
        accum = ""
        accum_cites: list[str] = []

        for para_text in paragraphs:
            cites = _extract_citations(para_text)
            candidate = (accum + "\n" + para_text) if accum else para_text
            if self.token_count(candidate) > self.target_size and accum.strip():
                emit(node, accum, node.pages, accum_cites)
                accum = para_text
                accum_cites = list(cites)
            else:
                accum = candidate
                for c in cites:
                    if c not in accum_cites:
                        accum_cites.append(c)

        if accum.strip():
            emit(node, accum, node.pages, accum_cites)

    def _chunk_generic(
        self,
        node: _CaseNode,
        emit: callable,  # type: ignore[valid-type]
    ) -> None:
        """Chunk a non-analysis node by token budget."""
        text = node.text
        if self.token_count(text) <= self.target_size:
            emit(node, text, node.pages, node.cited_cases)
            return

        # Split by line and accumulate.
        lines = text.split("\n")
        accum = ""
        accum_cites: list[str] = []

        for line in lines:
            cites = _extract_citations(line)
            candidate = (accum + "\n" + line) if accum else line
            if self.token_count(candidate) > self.target_size and accum.strip():
                emit(node, accum, node.pages, accum_cites)
                accum = line
                accum_cites = list(cites)
            else:
                accum = candidate
                for c in cites:
                    if c not in accum_cites:
                        accum_cites.append(c)

        if accum.strip():
            emit(node, accum, node.pages, accum_cites)
