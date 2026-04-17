"""Hierarchical chunking strategy for legislation documents.

Respects the legislative hierarchy (Part, Division, Section, Subsection,
paragraph) and never splits mid-section.  Cross-references to other
sections are extracted as metadata.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .base import Chunk, ChunkingStrategy, ChunkMetadata

# ---------------------------------------------------------------------------
# Legislative structure detection
# ---------------------------------------------------------------------------

# Patterns ordered from broadest to most specific structural unit.
_PART_RE = re.compile(
    r"^(?:PART|PARTIE)\s+([IVXLCDM\d]+)",
    re.IGNORECASE | re.MULTILINE,
)
_DIVISION_RE = re.compile(
    r"^(?:DIVISION|SECTION)\s+([IVXLCDM\d]+)",
    re.IGNORECASE | re.MULTILINE,
)
_SECTION_RE = re.compile(
    r"^(\d+)\.\s",
    re.MULTILINE,
)
_SUBSECTION_RE = re.compile(
    r"^\((\d+)\)\s",
    re.MULTILINE,
)
_PARAGRAPH_RE = re.compile(
    r"^\s*\(([a-z])\)\s",
    re.MULTILINE,
)

# Cross-reference patterns.
_XREF_RE = re.compile(
    r"(?:section|article|subsection|paragraph|alin[eé]a|paragraphe)\s+"
    r"(\d+(?:\(\d+\))?(?:\([a-z]\))?)",
    re.IGNORECASE,
)


@dataclass
class _LegislativeNode:
    """Intermediate representation of a legislative structural unit."""

    part: str = ""
    division: str = ""
    section: str = ""
    subsection: str = ""
    paragraphs: list[dict] = field(default_factory=list)
    text: str = ""
    pages: list[int] = field(default_factory=list)
    title: str = ""
    subtitle: str = ""
    section_heading: str = ""
    cross_references: list[str] = field(default_factory=list)


def _detect_hierarchy(text: str) -> dict[str, str]:
    """Return the deepest hierarchy markers found in *text*."""
    hierarchy: dict[str, str] = {}
    m = _PART_RE.search(text)
    if m:
        hierarchy["part"] = m.group(1)
    m = _DIVISION_RE.search(text)
    if m:
        hierarchy["division"] = m.group(1)
    m = _SECTION_RE.search(text)
    if m:
        hierarchy["section"] = m.group(1)
    m = _SUBSECTION_RE.search(text)
    if m:
        hierarchy["subsection"] = m.group(1)
    return hierarchy


def _extract_cross_references(text: str) -> list[str]:
    """Extract cross-reference targets from *text*."""
    return list({m.group(1) for m in _XREF_RE.finditer(text)})


class LegislationChunkingStrategy(ChunkingStrategy):
    """Chunks legislation by structural boundaries.

    Each legislative section becomes one chunk.  If a section exceeds
    ``target_size`` it is emitted as an oversized chunk — splitting
    mid-section would break legal meaning.

    Chunk metadata includes ``part``, ``division``, ``section``,
    ``subsection``, and a list of cross-referenced sections.
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
        return self._nodes_to_chunks(nodes, file_name, file_uri)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_nodes(self, document_map: list[dict]) -> list[_LegislativeNode]:
        """Walk the document map and group paragraphs into legislative nodes."""
        nodes: list[_LegislativeNode] = []
        current = _LegislativeNode()

        # Running hierarchy state.
        cur_part = ""
        cur_division = ""
        cur_section = ""
        cur_subsection = ""

        for para in document_map:
            text: str = para.get("text", "")
            page: int = para.get("page_number", 0)

            hierarchy = _detect_hierarchy(text)

            # A new section-level (or higher) marker means we flush the
            # current node and start a new one.
            new_section = False

            if "part" in hierarchy:
                cur_part = hierarchy["part"]
                cur_division = ""
                cur_section = ""
                cur_subsection = ""
                new_section = True
            if "division" in hierarchy:
                cur_division = hierarchy["division"]
                cur_section = ""
                cur_subsection = ""
                new_section = True
            if "section" in hierarchy:
                cur_section = hierarchy["section"]
                cur_subsection = ""
                new_section = True
            if "subsection" in hierarchy:
                cur_subsection = hierarchy["subsection"]
                # Subsection change within same section does NOT force a
                # new node — subsections stay grouped with their section.

            if new_section and current.text.strip():
                nodes.append(current)
                current = _LegislativeNode()

            current.part = cur_part
            current.division = cur_division
            current.section = cur_section
            current.subsection = cur_subsection
            current.title = para.get("title", "")
            current.subtitle = para.get("subtitle", "")
            current.section_heading = para.get("section", "")

            current.text = (current.text + "\n" + text) if current.text else text
            if page and page not in current.pages:
                current.pages.append(page)

            xrefs = _extract_cross_references(text)
            for xr in xrefs:
                if xr not in current.cross_references:
                    current.cross_references.append(xr)

        # Final node.
        if current.text.strip():
            nodes.append(current)

        return nodes

    def _nodes_to_chunks(
        self,
        nodes: list[_LegislativeNode],
        file_name: str,
        file_uri: str,
    ) -> list[Chunk]:
        """Convert legislative nodes to ``Chunk`` objects.

        Adjacent small nodes are merged up to ``target_size`` as long as
        they share the same part and division — this avoids emitting
        many tiny chunks for short sections while still respecting
        structural boundaries.
        """
        chunks: list[Chunk] = []
        chunk_index = 0

        accum_text = ""
        accum_pages: list[int] = []
        accum_xrefs: list[str] = []
        accum_node: _LegislativeNode | None = None

        def _flush(
            node: _LegislativeNode, text: str, pages: list[int], xrefs: list[str]
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
                section=node.section_heading,
                pages=list(pages),
                token_count=tc,
                chunk_index=chunk_index,
            )
            # Attach legislative hierarchy and cross-references as extra
            # attributes on the metadata object.
            meta.part = node.part  # type: ignore[attr-defined]
            meta.division = node.division  # type: ignore[attr-defined]
            meta.leg_section = node.section  # type: ignore[attr-defined]
            meta.subsection = node.subsection  # type: ignore[attr-defined]
            meta.cross_references = list(xrefs)  # type: ignore[attr-defined]

            chunks.append(Chunk(content=text, metadata=meta))
            chunk_index += 1

        for node in nodes:
            node_size = self.token_count(node.text)

            # If node alone exceeds target, emit it as oversized.
            if node_size >= self.target_size:
                # Flush any accumulator first.
                if accum_text.strip() and accum_node is not None:
                    _flush(accum_node, accum_text, accum_pages, accum_xrefs)
                    accum_text = ""
                    accum_pages = []
                    accum_xrefs = []
                    accum_node = None
                _flush(node, node.text, node.pages, node.cross_references)
                continue

            # Try to merge with accumulator.
            same_group = (
                accum_node is not None
                and accum_node.part == node.part
                and accum_node.division == node.division
            )
            if same_group:
                candidate = accum_text + "\n" + node.text
                if self.token_count(candidate) < self.target_size:
                    accum_text = candidate
                    for p in node.pages:
                        if p not in accum_pages:
                            accum_pages.append(p)
                    for xr in node.cross_references:
                        if xr not in accum_xrefs:
                            accum_xrefs.append(xr)
                    continue
                else:
                    # Flush accumulator and start fresh with this node.
                    _flush(accum_node, accum_text, accum_pages, accum_xrefs)

            # Start new accumulator.
            accum_text = node.text
            accum_pages = list(node.pages)
            accum_xrefs = list(node.cross_references)
            accum_node = node

        # Final flush.
        if accum_text.strip() and accum_node is not None:
            _flush(accum_node, accum_text, accum_pages, accum_xrefs)

        return chunks
