"""Default token-based chunking strategy with section awareness and table handling.

Reimplements the functional behaviour of MSIA's ``build_chunks()`` with a
clean interface that returns ``Chunk`` objects instead of writing blobs.
"""

from __future__ import annotations

from nltk.tokenize import sent_tokenize

from .base import Chunk, ChunkMetadata, ChunkingStrategy
from .table_parser import chunk_table_with_headers


class DefaultChunkingStrategy(ChunkingStrategy):
    """Token-based chunking with section awareness and table handling.

    Accumulates paragraphs while the running token count stays below
    ``target_size``.  A new chunk is flushed whenever:

    * The next paragraph would push the total past ``target_size``.
    * The section, title, or subtitle changes.

    Oversized paragraphs are handled specially:

    * **Tables** are split by rows with headers preserved via
      ``chunk_table_with_headers``.
    * **Text** is split on sentence boundaries using NLTK
      ``sent_tokenize``.
    """

    def chunk(
        self,
        document_map: list[dict],
        file_name: str,
        file_uri: str,
    ) -> list[Chunk]:
        if not document_map:
            return []

        chunks: list[Chunk] = []
        chunk_index = 0

        chunk_text = ""
        chunk_size = 0
        page_list: list[int] = []
        current_page = 0

        prev_section = document_map[0].get("section", "")
        prev_title = document_map[0].get("title", "")
        prev_subtitle = document_map[0].get("subtitle", "")

        def _flush(
            text: str,
            pages: list[int],
            section: str,
            title: str,
            subtitle: str,
        ) -> None:
            nonlocal chunk_index
            if not text.strip():
                return
            tc = self.token_count(text)
            chunks.append(
                Chunk(
                    content=text,
                    metadata=ChunkMetadata(
                        file_name=file_name,
                        file_uri=file_uri,
                        file_class="text",
                        title=title,
                        subtitle=subtitle,
                        section=section,
                        pages=list(pages),
                        token_count=tc,
                        chunk_index=chunk_index,
                    ),
                )
            )
            chunk_index += 1

        for idx, para in enumerate(document_map):
            para_text: str = para.get("text", "")
            para_type: str = para.get("type", "text")
            section = para.get("section", "")
            title = para.get("title", "")
            subtitle = para.get("subtitle", "")
            page_number: int = para.get("page_number", 0)

            para_size = self.token_count(para_text)

            # Detect boundary: size overflow or structural change.
            boundary = (
                (chunk_size + para_size >= self.target_size)
                or section != prev_section
                or title != prev_title
                or subtitle != prev_subtitle
            )

            if boundary:
                if para_size >= self.target_size:
                    # --- Oversized paragraph ---
                    if para_type == "table":
                        table_chunks = chunk_table_with_headers(
                            para_text,
                            self.target_size,
                            prefix_text=chunk_text,
                        )
                        # Emit all but the last as full chunks; carry the
                        # last forward as the new accumulator.
                        for i, tc_text in enumerate(table_chunks):
                            if i < len(table_chunks) - 1:
                                _flush(tc_text, page_list, prev_section, prev_title, prev_subtitle)
                            else:
                                para_text = tc_text
                                para_size = self.token_count(tc_text)
                        chunk_text = ""
                        chunk_size = 0
                        page_list = []
                    else:
                        # Split text on sentence boundaries.
                        sentences = sent_tokenize(chunk_text + para_text)
                        sub_chunks: list[str] = []
                        current = ""
                        for sentence in sentences:
                            candidate = (current + " " + sentence) if current else sentence
                            if self.token_count(candidate) <= self.target_size:
                                current = candidate
                            else:
                                if current:
                                    sub_chunks.append(current)
                                current = sentence
                        if current:
                            sub_chunks.append(current)

                        for i, sc_text in enumerate(sub_chunks):
                            if i < len(sub_chunks) - 1:
                                _flush(sc_text, page_list, prev_section, prev_title, prev_subtitle)
                            else:
                                para_text = sc_text
                                para_size = self.token_count(sc_text)
                        chunk_text = ""
                        chunk_size = 0
                        page_list = []
                else:
                    # Normal flush — paragraph fits on its own but the
                    # accumulator is full or a boundary was crossed.
                    _flush(chunk_text, page_list, prev_section, prev_title, prev_subtitle)
                    chunk_text = ""
                    chunk_size = 0
                    page_list = []

            # Track pages.
            if current_page != page_number:
                page_list.append(page_number)
                current_page = page_number

            # Accumulate.
            chunk_size += para_size
            chunk_text = (chunk_text + "\n" + para_text) if chunk_text else para_text

            prev_section = section
            prev_title = title
            prev_subtitle = subtitle

            # Final paragraph — flush remaining.
            if idx == len(document_map) - 1:
                _flush(chunk_text, page_list, section, title, subtitle)

        return chunks
