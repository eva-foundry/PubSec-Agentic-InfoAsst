"""Document management endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import JSONResponse

from ..auth import UserContext, get_current_user
from ..models.workspace import Document

router = APIRouter()

_MOCK_DOCS: list[Document] = [
    Document(
        id="doc-001",
        workspace_id="ws-oas-act",
        filename="oas-act-2024.pdf",
        content_type="application/pdf",
        size_bytes=2_450_000,
        status="indexed",
        chunk_count=87,
        data_classification="protected_a",
        uploaded_by="demo-alice",
        uploaded_at="2026-03-15T10:30:00Z",
        processed_at="2026-03-15T10:35:22Z",
    ),
    Document(
        id="doc-002",
        workspace_id="ws-oas-act",
        filename="oas-regulations-2025.docx",
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size_bytes=890_000,
        status="processing",
        chunk_count=0,
        data_classification="protected_a",
        uploaded_by="demo-alice",
        uploaded_at="2026-04-10T14:20:00Z",
    ),
    Document(
        id="doc-003",
        workspace_id="ws-ei-juris",
        filename="ei-case-2024-0412.pdf",
        content_type="application/pdf",
        size_bytes=1_200_000,
        status="failed",
        chunk_count=0,
        data_classification="protected_b",
        uploaded_by="demo-eve",
        uploaded_at="2026-04-12T09:00:00Z",
        error_message="Form Recognizer timeout after 120s",
    ),
]

_MOCK_TAGS = [
    {"tag": "legislation", "count": 24},
    {"tag": "regulation", "count": 18},
    {"tag": "case-law", "count": 42},
    {"tag": "policy", "count": 11},
    {"tag": "guidance", "count": 7},
]


@router.post("/documents/upload", status_code=201)
async def upload_document(
    file: UploadFile,
    workspace_id: str = "ws-oas-act",
    user: UserContext = Depends(get_current_user),
) -> Document:
    """Accept a document upload for ingestion."""
    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    return Document(
        id=doc_id,
        workspace_id=workspace_id,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        size_bytes=0,
        status="uploading",
        data_classification="unclassified",
        uploaded_by=user.user_id,
        uploaded_at="2026-04-14T12:00:00Z",
    )


@router.get("/documents/status")
async def list_document_statuses(
    workspace_id: str | None = None,
    user: UserContext = Depends(get_current_user),
) -> list[Document]:
    """Return status of all documents, optionally filtered by workspace."""
    docs = _MOCK_DOCS
    if workspace_id:
        docs = [d for d in docs if d.workspace_id == workspace_id]
    return docs


@router.get("/documents/tags")
async def list_tags(
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    """Return available document tags."""
    return _MOCK_TAGS


@router.get("/documents/{doc_id}")
async def get_document(
    doc_id: str,
    user: UserContext = Depends(get_current_user),
) -> Document:
    """Return metadata for a single document."""
    for doc in _MOCK_DOCS:
        if doc.id == doc_id:
            return doc
    return JSONResponse(status_code=404, content={"detail": f"Document '{doc_id}' not found"})  # type: ignore[return-value]


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    user: UserContext = Depends(get_current_user),
) -> None:
    """Delete a document and remove from index."""
    return None


@router.post("/documents/{doc_id}/resubmit", status_code=202)
async def resubmit_document(
    doc_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Resubmit a failed document for reprocessing."""
    return {"doc_id": doc_id, "status": "resubmitted", "message": "Document queued for reprocessing"}
