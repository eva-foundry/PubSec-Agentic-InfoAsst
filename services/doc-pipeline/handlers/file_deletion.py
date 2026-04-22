"""Governed file deletion.

Deletes source blob, all chunk blobs, all search index entries,
updates Cosmos status to DELETED, and creates an audit record.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Protocol

from opentelemetry import trace
from shared.blob_helpers import delete_blobs
from shared.status import PipelineState, StatusTracker

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


# ---------------------------------------------------------------------------
# Protocols
# ---------------------------------------------------------------------------


class BlobContainerClient(Protocol):
    """Protocol for blob container operations."""

    async def delete_blob(self, blob: str) -> None: ...
    def list_blobs(self, name_starts_with: str | None = None) -> AsyncBlobIterator: ...


class AsyncBlobIterator(Protocol):
    def __aiter__(self) -> AsyncBlobIterator: ...
    async def __anext__(self) -> object: ...


class SearchIndexClient(Protocol):
    """Protocol for cleaning up search index entries."""

    async def delete_documents_by_source(
        self, index_name: str, source_path: str
    ) -> int: ...


class AuditLogger(Protocol):
    """Protocol for creating audit records."""

    async def log_deletion(
        self,
        file_path: str,
        workspace_id: str,
        deleted_by: str,
        details: dict,
    ) -> None: ...


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------


@tracer.start_as_current_span("delete_file")
async def delete_file(
    blob_name: str,
    workspace_id: str,
    *,
    source_container: BlobContainerClient,
    chunk_container: BlobContainerClient,
    search_client: SearchIndexClient,
    status_tracker: StatusTracker,
    audit_logger: AuditLogger | None = None,
    deleted_by: str = "system",
) -> dict:
    """Delete a file and all its derived artifacts.

    Steps:
        1. Delete source blob
        2. Delete all chunk blobs
        3. Delete all search index entries
        4. Update Cosmos status to DELETED
        5. Create audit record

    Args:
        blob_name: Name/path of the source blob.
        workspace_id: The workspace the document belongs to.
        source_container: Blob container for source files.
        chunk_container: Blob container for chunks.
        search_client: Search index client for cleanup.
        status_tracker: Cosmos status tracker.
        audit_logger: Optional audit logger for deletion records.
        deleted_by: Identity of the user/system performing deletion.

    Returns:
        Summary dict with counts of deleted artifacts.
    """
    span = trace.get_current_span()
    span.set_attribute("doc.blob_name", blob_name)
    span.set_attribute("doc.workspace_id", workspace_id)
    span.set_attribute("doc.deleted_by", deleted_by)

    summary: dict = {
        "blob_name": blob_name,
        "workspace_id": workspace_id,
        "deleted_by": deleted_by,
        "timestamp": datetime.now(UTC).isoformat(),
        "source_deleted": False,
        "chunks_deleted": 0,
        "index_entries_deleted": 0,
    }

    # 1. Delete source blob
    try:
        await source_container.delete_blob(blob_name)
        summary["source_deleted"] = True
        logger.info("Source blob deleted", extra={"blob_name": blob_name})
    except Exception:
        logger.warning(
            "Failed to delete source blob (may not exist)",
            extra={"blob_name": blob_name},
            exc_info=True,
        )

    # 2. Delete all chunk blobs
    chunk_prefix = f"{workspace_id}/{blob_name}/chunks/"
    try:
        deleted_count = await delete_blobs(chunk_container, chunk_prefix)  # type: ignore[arg-type]
        summary["chunks_deleted"] = deleted_count
        logger.info(
            "Chunk blobs deleted",
            extra={"blob_name": blob_name, "count": deleted_count},
        )
    except Exception:
        logger.warning(
            "Failed to delete chunk blobs",
            extra={"blob_name": blob_name},
            exc_info=True,
        )

    # 3. Delete search index entries
    index_name = f"eva-workspace-{workspace_id}-index"
    try:
        index_deleted = await search_client.delete_documents_by_source(
            index_name, blob_name
        )
        summary["index_entries_deleted"] = index_deleted
        logger.info(
            "Search index entries deleted",
            extra={
                "blob_name": blob_name,
                "index_name": index_name,
                "count": index_deleted,
            },
        )
    except Exception:
        logger.warning(
            "Failed to delete search index entries",
            extra={"blob_name": blob_name, "index_name": index_name},
            exc_info=True,
        )

    # 4. Update Cosmos status
    await status_tracker.update(
        blob_name,
        PipelineState.DELETED,
        f"File deleted by {deleted_by}",
    )

    # 5. Create audit record
    if audit_logger:
        try:
            await audit_logger.log_deletion(
                file_path=blob_name,
                workspace_id=workspace_id,
                deleted_by=deleted_by,
                details=summary,
            )
        except Exception:
            logger.error(
                "Failed to create audit record for deletion",
                extra={"blob_name": blob_name},
                exc_info=True,
            )

    span.set_attribute("doc.source_deleted", summary["source_deleted"])
    span.set_attribute("doc.chunks_deleted", summary["chunks_deleted"])
    span.set_attribute("doc.index_entries_deleted", summary["index_entries_deleted"])

    logger.info("File deletion complete", extra=summary)

    return summary
