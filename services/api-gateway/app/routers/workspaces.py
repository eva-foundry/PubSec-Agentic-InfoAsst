"""Workspace catalog endpoints (Portal 1 - Self-Service)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..auth import UserContext, get_current_user
from ..models.workspace import Workspace

router = APIRouter()

_MOCK_WORKSPACES: list[Workspace] = [
    Workspace(
        id="ws-oas-act",
        name="OAS Act",
        name_fr="Loi sur la SV",
        description="Old Age Security Act legislation, regulations, and policy guidance.",
        description_fr="Loi sur la securite de la vieillesse, reglements et orientations politiques.",
        type="standard",
        status="active",
        owner_id="demo-carol",
        data_classification="protected_a",
        document_capacity=500,
        document_count=87,
        monthly_cost=1250.00,
        cost_centre="CC-1234",
        created_at="2025-09-01T00:00:00Z",
        updated_at="2026-04-10T14:20:00Z",
    ),
    Workspace(
        id="ws-ei-juris",
        name="EI Jurisprudence",
        name_fr="Jurisprudence de l'AE",
        description="Employment Insurance case law, tribunal decisions, and court rulings.",
        description_fr="Jurisprudence de l'assurance-emploi, decisions du tribunal et jugements.",
        type="premium",
        status="active",
        owner_id="demo-carol",
        data_classification="protected_b",
        document_capacity=2000,
        document_count=1423,
        monthly_cost=3500.00,
        cost_centre="CC-5678",
        created_at="2025-06-15T00:00:00Z",
        updated_at="2026-04-12T09:00:00Z",
    ),
    Workspace(
        id="ws-general-faq",
        name="General FAQ",
        name_fr="FAQ generale",
        description="Frequently asked questions and general guidance documents.",
        description_fr="Questions frequemment posees et documents d'orientation generaux.",
        type="shared",
        status="active",
        owner_id="demo-carol",
        data_classification="unclassified",
        document_capacity=200,
        document_count=45,
        monthly_cost=400.00,
        cost_centre="CC-0001",
        created_at="2025-03-01T00:00:00Z",
        updated_at="2026-03-20T16:00:00Z",
    ),
]

_WORKSPACES_BY_ID = {ws.id: ws for ws in _MOCK_WORKSPACES}


@router.get("/workspaces")
async def list_workspaces(
    user: UserContext = Depends(get_current_user),
) -> list[Workspace]:
    """List workspaces the current user has access to."""
    if "all" in user.workspace_grants:
        return _MOCK_WORKSPACES
    return [ws for ws in _MOCK_WORKSPACES if ws.id in user.workspace_grants]


@router.get("/workspaces/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    user: UserContext = Depends(get_current_user),
) -> Workspace:
    """Return detail for a single workspace."""
    ws = _WORKSPACES_BY_ID.get(workspace_id)
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{workspace_id}' not found")
    if "all" not in user.workspace_grants and workspace_id not in user.workspace_grants:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")
    return ws
