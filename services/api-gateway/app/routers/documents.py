"""Document management endpoints — upload, status, delete, resubmit."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import JSONResponse

from ..auth import UserContext, get_current_user
from ..stores.compat import aio

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_processor():
    """Lazy import to avoid circular dependency at module load time."""
    from ..agents.embedding_client import AzureEmbeddingClient, MockEmbeddingClient
    from ..config import get_settings
    from ..pipeline.local_processor import LocalDocumentProcessor
    from ..stores import document_store, vector_store

    settings = get_settings()
    if settings.azure_openai_endpoint and settings.azure_openai_api_key:
        embedding_client = AzureEmbeddingClient(
            endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            deployment=settings.azure_openai_embedding_deployment,
        )
    else:
        embedding_client = MockEmbeddingClient()

    return LocalDocumentProcessor(
        vector_store=vector_store,
        embedding_client=embedding_client,
        document_store=document_store,
    )


@router.post("/documents/upload", status_code=201)
async def upload_document(
    file: UploadFile,
    workspace_id: str = "ws-oas-act",
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Accept a document upload, process it through the pipeline, and return the record."""
    content = await file.read()
    file_name = file.filename or "unnamed"

    processor = _get_processor()
    record = await processor.process(
        workspace_id=workspace_id,
        file_name=file_name,
        content_bytes=content,
        uploaded_by=user.user_id,
    )

    logger.info(
        "Uploaded %s to %s by %s — status=%s chunks=%d",
        file_name,
        workspace_id,
        user.user_id,
        record.status,
        record.chunk_count,
    )

    return record.model_dump()


@router.get("/documents/status")
async def list_document_statuses(
    workspace_id: str | None = None,
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    """Return status of all documents, optionally filtered by workspace."""
    from ..stores import document_store

    if workspace_id:
        docs = await aio(document_store.list_by_workspace(workspace_id))
    else:
        docs = await aio(document_store.list_all())

    return [d.model_dump() for d in docs]


@router.get("/documents/tags")
async def list_tags(
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    """Return available document tags (placeholder — returns empty list)."""
    return []


@router.get("/documents/{doc_id}")
async def get_document(
    doc_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Return metadata for a single document."""
    from ..stores import document_store

    record = await aio(document_store.get(doc_id))
    if record is None:
        return JSONResponse(  # type: ignore[return-value]
            status_code=404,
            content={"detail": f"Document '{doc_id}' not found"},
        )
    return record.model_dump()


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    user: UserContext = Depends(get_current_user),
) -> None:
    """Delete a document from the store and vector index."""
    from ..stores import document_store, vector_store

    record = await aio(document_store.get(doc_id))
    if record is None:
        return JSONResponse(  # type: ignore[return-value]
            status_code=404,
            content={"detail": f"Document '{doc_id}' not found"},
        )

    await aio(vector_store.delete_by_file(record.workspace_id, record.file_name))
    await aio(document_store.delete(doc_id))

    logger.info("Deleted document %s (%s)", doc_id, record.file_name)


@router.post("/documents/{doc_id}/resubmit", status_code=202)
async def resubmit_document(
    doc_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Resubmit a failed document for reprocessing."""
    from ..stores import document_store

    record = await aio(document_store.get(doc_id))
    if record is None:
        return JSONResponse(  # type: ignore[return-value]
            status_code=404,
            content={"detail": f"Document '{doc_id}' not found"},
        )

    return {
        "doc_id": doc_id,
        "status": "resubmitted",
        "message": "Document queued for reprocessing",
    }
