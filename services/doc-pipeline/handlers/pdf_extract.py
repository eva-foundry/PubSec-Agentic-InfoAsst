"""PDF extraction via Azure Document Intelligence.

Submits PDFs to Document Intelligence for analysis, polls for results
with exponential backoff, then parses the analyzeResult into chunks
and writes them to blob storage.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Protocol

from opentelemetry import trace
from shared.blob_helpers import upload_chunk
from shared.status import PipelineState, StatusTracker

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

# ---------------------------------------------------------------------------
# Protocols for external dependencies
# ---------------------------------------------------------------------------


class DocumentIntelligenceClient(Protocol):
    """Protocol for Azure Document Intelligence async operations."""

    async def begin_analyze_document_from_url(
        self, model_id: str, document_url: str
    ) -> AnalyzePoller: ...


class AnalyzePoller(Protocol):
    """Protocol for a long-running Document Intelligence operation."""

    @property
    def operation_id(self) -> str: ...

    async def result(self) -> object: ...

    def done(self) -> bool: ...


class DocumentIntelligencePoller(Protocol):
    """Protocol for polling a specific operation."""

    async def get_analyze_result(self, operation_id: str) -> dict: ...


class BlobContainerForChunks(Protocol):
    """Protocol for the blob container client used to write chunks."""

    async def upload_blob(self, name: str, data: bytes, overwrite: bool = False) -> None: ...


# ---------------------------------------------------------------------------
# Submit
# ---------------------------------------------------------------------------


@tracer.start_as_current_span("pdf.submit")
async def submit_pdf(
    blob_name: str,
    blob_uri: str,
    workspace_id: str,
    *,
    doc_intel_client: DocumentIntelligenceClient,
    status_tracker: StatusTracker,
) -> str:
    """Submit a PDF to Document Intelligence for analysis.

    Returns the operation ID for polling.
    """
    span = trace.get_current_span()
    span.set_attribute("doc.blob_name", blob_name)
    span.set_attribute("doc.workspace_id", workspace_id)

    await status_tracker.update(
        blob_name,
        PipelineState.EXTRACTING,
        "Submitting PDF to Document Intelligence",
    )

    poller = await doc_intel_client.begin_analyze_document_from_url(
        model_id="prebuilt-layout",
        document_url=blob_uri,
    )

    operation_id = poller.operation_id
    span.set_attribute("doc.operation_id", operation_id)

    logger.info(
        "PDF submitted to Document Intelligence",
        extra={"blob_name": blob_name, "operation_id": operation_id},
    )
    return operation_id


# ---------------------------------------------------------------------------
# Poll
# ---------------------------------------------------------------------------


@tracer.start_as_current_span("pdf.poll")
async def poll_pdf(
    blob_name: str,
    operation_id: str,
    workspace_id: str,
    *,
    doc_intel_client: DocumentIntelligenceClient,
    status_tracker: StatusTracker,
    max_attempts: int = 10,
    base_delay: float = 2.0,
) -> dict:
    """Poll Document Intelligence for analysis results with exponential backoff.

    Args:
        max_attempts: Maximum number of polling attempts (default 10).
        base_delay: Initial delay in seconds, doubled each attempt.

    Returns:
        The analyzeResult dict from Document Intelligence.
    """
    span = trace.get_current_span()
    span.set_attribute("doc.blob_name", blob_name)
    span.set_attribute("doc.operation_id", operation_id)

    # Re-submit to get a poller we can check
    # In practice, the poller from submit_pdf would be reused or
    # the operation is polled via a separate HTTP call.
    # Here we use the client to get the result by re-submitting the poller.
    delay = base_delay

    for attempt in range(1, max_attempts + 1):
        span.add_event(f"poll_attempt_{attempt}", {"delay_seconds": delay})
        logger.info(
            "Polling Document Intelligence",
            extra={
                "blob_name": blob_name,
                "operation_id": operation_id,
                "attempt": attempt,
            },
        )

        try:
            result = await doc_intel_client.get_analyze_result(operation_id)  # type: ignore[attr-defined]

            status = result.get("status", "")
            if status == "succeeded":
                logger.info(
                    "Document Intelligence analysis succeeded",
                    extra={"blob_name": blob_name, "attempt": attempt},
                )
                return result.get("analyzeResult", result)
            elif status == "failed":
                error_msg = result.get("error", {}).get("message", "Unknown error")
                await status_tracker.update(
                    blob_name,
                    PipelineState.ERROR,
                    f"Document Intelligence analysis failed: {error_msg}",
                )
                raise RuntimeError(f"Document Intelligence analysis failed: {error_msg}")
        except AttributeError:
            # Client may not have get_analyze_result; fall through to retry
            pass

        if attempt < max_attempts:
            await asyncio.sleep(delay)
            delay = min(delay * 2, 60.0)

    await status_tracker.update(
        blob_name,
        PipelineState.ERROR,
        f"Document Intelligence polling timed out after {max_attempts} attempts",
    )
    raise TimeoutError(
        f"Document Intelligence polling timed out after {max_attempts} attempts"
    )


# ---------------------------------------------------------------------------
# Process result
# ---------------------------------------------------------------------------


def _build_chunks_from_result(
    blob_name: str,
    analyze_result: dict,
    workspace_id: str,
    chunk_size: int = 1024,
) -> list[dict]:
    """Parse analyzeResult into document chunks.

    Extracts content from pages, respects paragraph/section boundaries,
    and builds chunk metadata including page numbers and bounding regions.
    """
    chunks: list[dict] = []
    pages = analyze_result.get("pages", [])
    paragraphs = analyze_result.get("paragraphs", [])

    # If paragraphs are available, chunk by paragraph groupings
    if paragraphs:
        current_text = ""
        current_pages: set[int] = set()
        chunk_index = 0

        for para in paragraphs:
            para_content = para.get("content", "")
            para_page = para.get("boundingRegions", [{}])[0].get("pageNumber", 1)

            if len(current_text) + len(para_content) > chunk_size and current_text:
                chunks.append(
                    {
                        "chunk_id": f"{blob_name}__chunk_{chunk_index}",
                        "source_file": blob_name,
                        "workspace_id": workspace_id,
                        "content": current_text.strip(),
                        "pages": sorted(current_pages),
                        "chunk_index": chunk_index,
                    }
                )
                chunk_index += 1
                current_text = ""
                current_pages = set()

            current_text += para_content + "\n"
            current_pages.add(para_page)

        if current_text.strip():
            chunks.append(
                {
                    "chunk_id": f"{blob_name}__chunk_{chunk_index}",
                    "source_file": blob_name,
                    "workspace_id": workspace_id,
                    "content": current_text.strip(),
                    "pages": sorted(current_pages),
                    "chunk_index": chunk_index,
                }
            )
    elif pages:
        # Fallback: chunk by page content
        chunk_index = 0
        for page in pages:
            page_number = page.get("pageNumber", 1)
            lines = page.get("lines", [])
            page_text = "\n".join(line.get("content", "") for line in lines)

            if page_text.strip():
                chunks.append(
                    {
                        "chunk_id": f"{blob_name}__chunk_{chunk_index}",
                        "source_file": blob_name,
                        "workspace_id": workspace_id,
                        "content": page_text.strip(),
                        "pages": [page_number],
                        "chunk_index": chunk_index,
                    }
                )
                chunk_index += 1

    return chunks


@tracer.start_as_current_span("pdf.process_result")
async def process_pdf_result(
    blob_name: str,
    result: dict,
    workspace_id: str,
    *,
    chunk_container: BlobContainerForChunks,
    status_tracker: StatusTracker,
    chunk_size: int = 1024,
) -> list[dict]:
    """Parse analyzeResult, build chunks, and write them to blob storage.

    Returns the list of chunk dicts that were written.
    """
    span = trace.get_current_span()
    span.set_attribute("doc.blob_name", blob_name)
    span.set_attribute("doc.workspace_id", workspace_id)

    await status_tracker.update(
        blob_name,
        PipelineState.CHUNKING,
        "Building chunks from Document Intelligence result",
    )

    chunks = _build_chunks_from_result(blob_name, result, workspace_id, chunk_size)
    span.set_attribute("doc.chunk_count", len(chunks))

    for chunk in chunks:
        chunk_path = f"{workspace_id}/{blob_name}/chunks/{chunk['chunk_index']:04d}.json"
        await upload_chunk(chunk_container, chunk_path, chunk)

    logger.info(
        "PDF chunks written to blob",
        extra={"blob_name": blob_name, "chunk_count": len(chunks)},
    )

    return chunks
