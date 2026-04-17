"""Shared table handling utilities for chunking strategies.

Converts Azure Document Intelligence table JSON to HTML and splits
oversized HTML tables into smaller chunks while preserving header rows.
"""

from __future__ import annotations

import html as html_mod
from typing import Any

from .base import ChunkingStrategy


def table_to_html(table: dict[str, Any]) -> str:
    """Convert a Document Intelligence table JSON structure to an HTML string.

    Handles ``rowSpan`` / ``colSpan`` and distinguishes header rows
    (``columnHeader`` / ``rowHeader``) from data rows.
    """

    table_html = "<table>"
    row_count: int = table.get("rowCount", 0)
    cells: list[dict] = table.get("cells", [])

    # Group cells by row, sorted by column within each row.
    rows: list[list[dict]] = [
        sorted(
            [c for c in cells if c["rowIndex"] == i],
            key=lambda c: c["columnIndex"],
        )
        for i in range(row_count)
    ]

    thead_opened = False
    thead_closed = False

    for i, row_cells in enumerate(rows):
        is_header_row = False
        row_html = "<tr>"

        for cell in row_cells:
            tag = "td"
            kind = cell.get("kind", "")
            if kind in ("columnHeader", "rowHeader"):
                tag = "th"
            if kind == "columnHeader":
                is_header_row = True

            spans = ""
            col_span = cell.get("columnSpan", 1)
            if col_span > 1:
                spans += f" colSpan={col_span}"
            row_span = cell.get("rowSpan", 1)
            if row_span > 1:
                spans += f" rowSpan={row_span}"

            content = html_mod.escape(cell.get("content", ""))
            row_html += f"<{tag}{spans}>{content}</{tag}>"

        row_html += "</tr>"

        # Wrap header rows in <thead>.
        if is_header_row and i == 0 and not thead_opened:
            row_html = "<thead>" + row_html
            thead_opened = True

        if not is_header_row and thead_opened and not thead_closed:
            row_html = "</thead>" + row_html
            thead_closed = True

        table_html += row_html

    # Close thead if the entire table was headers (edge case).
    if thead_opened and not thead_closed:
        table_html += "</thead>"

    table_html += "</table>"
    return table_html


def chunk_table_with_headers(
    table_html: str,
    target_size: int,
    prefix_text: str = "",
) -> list[str]:
    """Split a large HTML table into chunks, preserving header rows.

    Each chunk is a self-contained ``<table>`` element that includes the
    original ``<thead>`` (if any) so downstream consumers can interpret
    column semantics.

    Parameters
    ----------
    table_html:
        Full HTML table string.
    target_size:
        Maximum token count per chunk.
    prefix_text:
        Optional text to prepend to the *first* chunk (e.g. accumulated
        text from prior paragraphs).
    """
    try:
        from bs4 import BeautifulSoup  # type: ignore[import-untyped]
    except ImportError:
        # If BeautifulSoup is unavailable, return the table as-is.
        return [prefix_text + table_html] if prefix_text else [table_html]

    soup = BeautifulSoup(table_html, "html.parser")
    thead_tag = soup.find("thead")
    thead_html = str(thead_tag) if thead_tag else ""

    rows = soup.find_all("tr")
    # Filter out rows already inside <thead>.
    body_rows = [r for r in rows if r.parent.name != "thead"]

    if not body_rows:
        combined = prefix_text + table_html
        return [combined] if combined.strip() else []

    chunks: list[str] = []
    current_chunk = prefix_text

    # First chunk's budget is reduced by the prefix.
    budget = target_size - ChunkingStrategy.token_count(prefix_text) if prefix_text else target_size

    for row in body_rows:
        row_html = str(row)
        candidate = current_chunk + row_html
        if ChunkingStrategy.token_count(candidate) > budget and current_chunk.strip():
            # Flush current chunk.
            wrapped = "<table>" + current_chunk + "</table>"
            chunks.append(wrapped)
            current_chunk = thead_html
            budget = target_size
        current_chunk += row_html

    # Final chunk.
    if current_chunk.strip():
        wrapped = "<table>" + current_chunk + "</table>"
        chunks.append(wrapped)

    return chunks
