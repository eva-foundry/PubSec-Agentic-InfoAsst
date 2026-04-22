"""Blob trigger equivalent -- routes uploaded files by type to processing queues.

Detects file type from extension, logs status to Cosmos, cleans up any
previous chunks, and routes a message to the appropriate processing queue.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

from opentelemetry import trace
from shared.blob_helpers import delete_blobs
from shared.status import PipelineState, StatusTracker

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


# ---------------------------------------------------------------------------
# File type classification
# ---------------------------------------------------------------------------


class FileType(Enum):
    PDF = "pdf"
    OFFICE = "office"  # docx, pptx, xlsx
    TEXT = "text"  # txt, md, html, htm, csv, json, xml
    IMAGE = "image"  # jpg, jpeg, png, gif, bmp, tif, tiff
    EMAIL = "email"  # eml, msg
    UNSUPPORTED = "unsupported"


EXTENSION_MAP: dict[str, FileType] = {
    ".pdf": FileType.PDF,
    ".docx": FileType.OFFICE,
    ".pptx": FileType.OFFICE,
    ".xlsx": FileType.OFFICE,
    ".txt": FileType.TEXT,
    ".md": FileType.TEXT,
    ".html": FileType.TEXT,
    ".htm": FileType.TEXT,
    ".csv": FileType.TEXT,
    ".json": FileType.TEXT,
    ".xml": FileType.TEXT,
    ".jpg": FileType.IMAGE,
    ".jpeg": FileType.IMAGE,
    ".png": FileType.IMAGE,
    ".gif": FileType.IMAGE,
    ".bmp": FileType.IMAGE,
    ".tif": FileType.IMAGE,
    ".tiff": FileType.IMAGE,
    ".eml": FileType.EMAIL,
    ".msg": FileType.EMAIL,
}

QUEUE_MAP: dict[FileType, str] = {
    FileType.PDF: "eva-pdf-submit",
    FileType.OFFICE: "eva-non-pdf-submit",
    FileType.TEXT: "eva-non-pdf-submit",
    FileType.IMAGE: "eva-image-enrichment",
    FileType.EMAIL: "eva-non-pdf-submit",
}


def detect_file_type(filename: str) -> FileType:
    """Detect file type from extension (case-insensitive)."""
    _, ext = os.path.splitext(filename)
    return EXTENSION_MAP.get(ext.lower(), FileType.UNSUPPORTED)


# ---------------------------------------------------------------------------
# Protocols for external dependencies (mockable in tests)
# ---------------------------------------------------------------------------


class QueueSender(Protocol):
    """Protocol for sending messages to a queue."""

    async def send_message(self, content: str, visibility_timeout: int = 0) -> None: ...


class SearchIndexCleaner(Protocol):
    """Protocol for cleaning up search index entries for a document."""

    async def delete_documents_by_source(
        self, index_name: str, source_path: str
    ) -> int: ...


# ---------------------------------------------------------------------------
# Processing metadata
# ---------------------------------------------------------------------------


@dataclass
class UploadResult:
    """Metadata returned after routing an uploaded file."""

    blob_name: str
    file_type: FileType
    queue_name: str | None
    workspace_id: str
    uploaded_by: str


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------


@tracer.start_as_current_span("handle_file_uploaded")
async def handle_file_uploaded(
    blob_name: str,
    blob_uri: str,
    workspace_id: str,
    uploaded_by: str,
    *,
    status_tracker: StatusTracker,
    queue_clients: dict[str, QueueSender],
    chunk_container_client: object,
    search_cleaner: SearchIndexCleaner | None = None,
) -> UploadResult:
    """Route an uploaded file to the appropriate processing queue.

    Steps:
        1. Detect file type from extension
        2. Log status to Cosmos (state: PROCESSING)
        3. Clean up any previous chunks for this file
        4. Route message to appropriate queue
        5. Return processing metadata
    """
    span = trace.get_current_span()

    # 1. Detect file type
    file_type = detect_file_type(blob_name)
    queue_name = QUEUE_MAP.get(file_type)

    span.set_attribute("doc.file_type", file_type.value)
    span.set_attribute("doc.workspace_id", workspace_id)
    span.set_attribute("doc.blob_name", blob_name)

    if file_type == FileType.UNSUPPORTED:
        span.set_attribute("doc.queue_name", "none")
        await status_tracker.update(
            blob_name,
            PipelineState.ERROR,
            f"Unsupported file type for {blob_name}",
        )
        logger.warning("Unsupported file type", extra={"blob_name": blob_name})
        return UploadResult(
            blob_name=blob_name,
            file_type=file_type,
            queue_name=None,
            workspace_id=workspace_id,
            uploaded_by=uploaded_by,
        )

    span.set_attribute("doc.queue_name", queue_name or "none")

    # 2. Log status: PROCESSING
    current_trace_id = format(span.get_span_context().trace_id, "032x")
    await status_tracker.update(
        blob_name,
        PipelineState.PROCESSING,
        f"File uploaded by {uploaded_by}, routing to {queue_name}",
        trace_id=current_trace_id,
    )

    # 3. Clean up previous chunks (blob + search index)
    chunk_prefix = f"{workspace_id}/{blob_name}/chunks/"
    try:
        deleted_count = await delete_blobs(chunk_container_client, chunk_prefix)  # type: ignore[arg-type]
        logger.info(
            "Previous chunks cleaned up",
            extra={"blob_name": blob_name, "deleted_count": deleted_count},
        )
    except Exception:
        logger.warning(
            "Failed to clean up previous chunks (may not exist)",
            extra={"blob_name": blob_name},
            exc_info=True,
        )

    if search_cleaner:
        index_name = f"eva-workspace-{workspace_id}-index"
        try:
            await search_cleaner.delete_documents_by_source(index_name, blob_name)
        except Exception:
            logger.warning(
                "Failed to clean up search index entries",
                extra={"blob_name": blob_name, "index_name": index_name},
                exc_info=True,
            )

    # 4. Route to queue
    message = json.dumps(
        {
            "blob_name": blob_name,
            "blob_uri": blob_uri,
            "workspace_id": workspace_id,
            "uploaded_by": uploaded_by,
            "file_type": file_type.value,
        },
        ensure_ascii=False,
    )

    if queue_name and queue_name in queue_clients:
        await queue_clients[queue_name].send_message(message)
        logger.info(
            "Message routed to queue",
            extra={"blob_name": blob_name, "queue_name": queue_name},
        )
    else:
        logger.error(
            "No queue client available for queue",
            extra={"blob_name": blob_name, "queue_name": queue_name},
        )

    # 5. Return metadata
    return UploadResult(
        blob_name=blob_name,
        file_type=file_type,
        queue_name=queue_name,
        workspace_id=workspace_id,
        uploaded_by=uploaded_by,
    )
