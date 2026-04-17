"""Non-PDF document parsing.

Downloads files from blob, extracts text content using the appropriate
method for the file type, chunks the text, and writes chunks to blob.
The pluggable extraction engine abstraction comes in a later session.
"""

from __future__ import annotations

import logging
from typing import Protocol

from opentelemetry import trace
from shared.blob_helpers import download_blob, upload_chunk
from shared.status import PipelineState, StatusTracker

from handlers.file_uploaded import FileType

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


# ---------------------------------------------------------------------------
# Protocols
# ---------------------------------------------------------------------------


class BlobContainerClient(Protocol):
    """Protocol for blob container operations."""

    async def upload_blob(
        self, name: str, data: bytes, overwrite: bool = False
    ) -> None: ...
    async def download_blob(self, blob: str) -> BlobDownloader: ...


class BlobDownloader(Protocol):
    async def readall(self) -> bytes: ...


# ---------------------------------------------------------------------------
# Simple text extraction (pluggable engine comes later)
# ---------------------------------------------------------------------------


def _extract_text(content: bytes, file_type: FileType, blob_name: str) -> str:
    """Extract text content from raw file bytes.

    For now, implements simple text reading. Office/email formats
    will get dedicated extractors in a future session.
    """
    if file_type == FileType.TEXT:
        # Try UTF-8, fall back to latin-1
        try:
            return content.decode("utf-8")
        except UnicodeDecodeError:
            return content.decode("latin-1")

    if file_type == FileType.OFFICE:
        # Placeholder: future session will add python-docx, python-pptx, openpyxl
        logger.warning(
            "Office extraction not yet implemented, attempting raw text decode",
            extra={"blob_name": blob_name},
        )
        try:
            return content.decode("utf-8", errors="replace")
        except Exception:
            return ""

    if file_type == FileType.EMAIL:
        # Placeholder: future session will add email parser (eml/msg)
        logger.warning(
            "Email extraction not yet implemented, attempting raw text decode",
            extra={"blob_name": blob_name},
        )
        try:
            return content.decode("utf-8", errors="replace")
        except Exception:
            return ""

    return ""


def _chunk_text(
    text: str,
    blob_name: str,
    workspace_id: str,
    chunk_size: int = 1024,
    overlap: int = 128,
) -> list[dict]:
    """Split text into overlapping chunks."""
    if not text.strip():
        return []

    chunks: list[dict] = []
    start = 0
    chunk_index = 0

    while start < len(text):
        end = start + chunk_size
        chunk_content = text[start:end]

        if chunk_content.strip():
            chunks.append(
                {
                    "chunk_id": f"{blob_name}__chunk_{chunk_index}",
                    "source_file": blob_name,
                    "workspace_id": workspace_id,
                    "content": chunk_content.strip(),
                    "chunk_index": chunk_index,
                }
            )
            chunk_index += 1

        start = end - overlap if end < len(text) else end

    return chunks


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------


@tracer.start_as_current_span("layout_parse.parse_document")
async def parse_document(
    blob_name: str,
    blob_uri: str,
    file_type: FileType,
    workspace_id: str,
    *,
    source_container: BlobContainerClient,
    chunk_container: BlobContainerClient,
    status_tracker: StatusTracker,
    chunk_size: int = 1024,
    chunk_overlap: int = 128,
) -> list[dict]:
    """Download file, extract content, chunk, and write chunks to blob.

    Args:
        blob_name: Name/path of the source blob.
        blob_uri: Full URI of the source blob.
        file_type: Detected file type enum.
        workspace_id: The workspace this file belongs to.
        source_container: Blob container client for reading the source file.
        chunk_container: Blob container client for writing chunks.
        status_tracker: Cosmos status tracker.
        chunk_size: Target size of each text chunk in characters.
        chunk_overlap: Overlap between consecutive chunks in characters.

    Returns:
        List of chunk dicts that were written to blob.
    """
    span = trace.get_current_span()
    span.set_attribute("doc.blob_name", blob_name)
    span.set_attribute("doc.file_type", file_type.value)
    span.set_attribute("doc.workspace_id", workspace_id)

    await status_tracker.update(
        blob_name,
        PipelineState.EXTRACTING,
        f"Extracting content from {file_type.value} document",
    )

    # 1. Download file
    content = await download_blob(source_container, blob_name)
    span.set_attribute("doc.source_size_bytes", len(content))

    # 2. Extract text
    text = _extract_text(content, file_type, blob_name)
    if not text.strip():
        await status_tracker.update(
            blob_name,
            PipelineState.ERROR,
            "No text content could be extracted from file",
        )
        logger.warning("No text extracted", extra={"blob_name": blob_name})
        return []

    span.set_attribute("doc.extracted_length", len(text))

    # 3. Chunk
    await status_tracker.update(
        blob_name,
        PipelineState.CHUNKING,
        f"Chunking {len(text)} characters of extracted text",
    )

    chunks = _chunk_text(text, blob_name, workspace_id, chunk_size, chunk_overlap)
    span.set_attribute("doc.chunk_count", len(chunks))

    # 4. Write chunks to blob
    for chunk in chunks:
        chunk_path = (
            f"{workspace_id}/{blob_name}/chunks/{chunk['chunk_index']:04d}.json"
        )
        await upload_chunk(chunk_container, chunk_path, chunk)

    logger.info(
        "Document parsed and chunked",
        extra={
            "blob_name": blob_name,
            "file_type": file_type.value,
            "chunk_count": len(chunks),
        },
    )

    return chunks
