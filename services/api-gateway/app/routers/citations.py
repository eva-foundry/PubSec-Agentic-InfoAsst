"""Citation handling endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from ..auth import UserContext, get_current_user

router = APIRouter()

_MOCK_CITATIONS = {
    "cit-001": {
        "id": "cit-001",
        "file": "oas-act-2024.pdf",
        "page": 12,
        "section": "Section 4.1 - Eligibility",
        "workspace_id": "ws-oas-act",
        "sas_url": "https://placeholder.blob.core.windows.net/docs/oas-act-2024.pdf?sv=stub",
        "last_verified": "2026-04-10",
        "source_quality_score": 0.95,
        "provenance": {
            "correlation_id": "corr-abc123",
            "retrieved_at": "2026-04-14T11:30:00Z",
            "relevance_score": 0.92,
            "chunk_id": "chunk-oas-act-2024-p12-s4.1",
        },
    },
    "cit-002": {
        "id": "cit-002",
        "file": "ei-case-2024-0412.pdf",
        "page": 3,
        "section": "Decision Summary",
        "workspace_id": "ws-ei-juris",
        "sas_url": "https://placeholder.blob.core.windows.net/docs/ei-case-2024-0412.pdf?sv=stub",
        "last_verified": "2026-04-12",
        "source_quality_score": 0.88,
        "provenance": {
            "correlation_id": "corr-def456",
            "retrieved_at": "2026-04-14T11:32:00Z",
            "relevance_score": 0.85,
            "chunk_id": "chunk-ei-case-2024-0412-p3-ds",
        },
    },
}


@router.get("/citations/{citation_id}")
async def get_citation(
    citation_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Return citation metadata and provenance."""
    citation = _MOCK_CITATIONS.get(citation_id)
    if citation is None:
        raise HTTPException(status_code=404, detail=f"Citation '{citation_id}' not found")
    return citation


@router.get("/citations/{citation_id}/file")
async def get_citation_file(
    citation_id: str,
    user: UserContext = Depends(get_current_user),
) -> RedirectResponse:
    """Redirect to the SAS-signed URL for the cited source file."""
    citation = _MOCK_CITATIONS.get(citation_id)
    if citation is None:
        raise HTTPException(status_code=404, detail=f"Citation '{citation_id}' not found")
    return RedirectResponse(url=citation["sas_url"], status_code=302)
