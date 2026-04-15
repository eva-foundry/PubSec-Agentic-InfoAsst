"""In-memory document record store — tracks upload and processing status.

Replaced by Cosmos DB adapter in production.
"""

from __future__ import annotations

from pydantic import BaseModel


class DocumentRecord(BaseModel):
    """Tracks a document through the ingestion pipeline."""

    id: str
    workspace_id: str
    file_name: str
    file_size: int
    status: str  # "uploaded" | "processing" | "chunking" | "embedding" | "indexed" | "error"
    chunk_count: int = 0
    error_message: str | None = None
    uploaded_by: str
    uploaded_at: str
    indexed_at: str | None = None


class DocumentStore:
    """In-memory store for document processing records."""

    def __init__(self) -> None:
        self._documents: dict[str, DocumentRecord] = {}

    def add(self, doc: DocumentRecord) -> None:
        """Add a document record."""
        self._documents[doc.id] = doc

    def get(self, doc_id: str) -> DocumentRecord | None:
        """Get a document record by ID."""
        return self._documents.get(doc_id)

    def list_by_workspace(self, workspace_id: str) -> list[DocumentRecord]:
        """List all document records for a workspace."""
        return [
            d for d in self._documents.values()
            if d.workspace_id == workspace_id
        ]

    def update_status(self, doc_id: str, status: str, **kwargs) -> None:
        """Update the status of a document record plus any extra fields."""
        doc = self._documents.get(doc_id)
        if doc is None:
            return
        data = doc.model_dump()
        data["status"] = status
        data.update(kwargs)
        self._documents[doc_id] = DocumentRecord(**data)

    def list_all(self) -> list[DocumentRecord]:
        """List all documents across all workspaces."""
        return list(self._documents.values())

    def delete(self, doc_id: str) -> bool:
        """Delete a document record. Returns True if it existed."""
        if doc_id in self._documents:
            del self._documents[doc_id]
            return True
        return False
