"""Document processing status tracking via Cosmos DB.

Tracks each document through the ingestion pipeline states,
providing audit trail and observability for the doc-pipeline.
"""
from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Protocol

from opentelemetry import trace

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


class PipelineState(Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    EXTRACTING = "extracting"
    CHUNKING = "chunking"
    ENRICHING = "enriching"
    EMBEDDING = "embedding"
    INDEXING = "indexing"
    COMPLETE = "complete"
    ERROR = "error"
    DELETED = "deleted"


class CosmosContainerClient(Protocol):
    """Protocol for Cosmos DB container operations (async)."""

    async def upsert_item(self, body: dict) -> dict: ...
    async def read_item(self, item: str, partition_key: str) -> dict: ...
    async def query_items(
        self, query: str, parameters: list[dict] | None = None, partition_key: str | None = None
    ) -> list[dict]: ...


def _encode_id(file_path: str) -> str:
    """Encode a file path into a Cosmos-safe document ID."""
    return base64.urlsafe_b64encode(file_path.encode()).decode()


class StatusTracker:
    """Tracks document processing status in Cosmos DB."""

    def __init__(self, container: CosmosContainerClient) -> None:
        self._container = container

    @tracer.start_as_current_span("status_tracker.update")
    async def update(
        self,
        file_path: str,
        state: PipelineState,
        message: str,
        trace_id: str | None = None,
    ) -> None:
        """Update the processing status for a document."""
        doc_id = _encode_id(file_path)
        now = datetime.now(timezone.utc).isoformat()

        status_entry = {
            "timestamp": now,
            "state": state.value,
            "message": message,
        }
        if trace_id:
            status_entry["trace_id"] = trace_id

        span = trace.get_current_span()
        span.set_attribute("doc.file_path", file_path)
        span.set_attribute("doc.state", state.value)

        try:
            existing = await self._container.read_item(doc_id, partition_key=file_path)
            existing["state"] = state.value
            existing["updated_at"] = now
            existing["status_history"].append(status_entry)
            if trace_id:
                existing["trace_id"] = trace_id
            await self._container.upsert_item(existing)
        except Exception:
            # Document does not exist yet -- create it
            doc = {
                "id": doc_id,
                "file_path": file_path,
                "state": state.value,
                "created_at": now,
                "updated_at": now,
                "trace_id": trace_id or "",
                "status_history": [status_entry],
            }
            await self._container.upsert_item(doc)

        logger.info(
            "Status updated",
            extra={"file_path": file_path, "state": state.value, "message": message},
        )

    @tracer.start_as_current_span("status_tracker.get_status")
    async def get_status(self, file_path: str) -> dict:
        """Get the current processing status for a document."""
        doc_id = _encode_id(file_path)
        return await self._container.read_item(doc_id, partition_key=file_path)

    @tracer.start_as_current_span("status_tracker.get_statuses_by_workspace")
    async def get_statuses_by_workspace(
        self,
        workspace_id: str,
        state: PipelineState | None = None,
    ) -> list[dict]:
        """Get all document statuses for a workspace, optionally filtered by state."""
        if state:
            query = (
                "SELECT * FROM c WHERE STARTSWITH(c.file_path, @prefix) AND c.state = @state"
            )
            params = [
                {"name": "@prefix", "value": workspace_id},
                {"name": "@state", "value": state.value},
            ]
        else:
            query = "SELECT * FROM c WHERE STARTSWITH(c.file_path, @prefix)"
            params = [{"name": "@prefix", "value": workspace_id}]

        results = await self._container.query_items(query, parameters=params)
        # Handle both list and async-iterator returns
        if isinstance(results, list):
            return results
        return [item async for item in results]
