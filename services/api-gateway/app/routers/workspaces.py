"""Workspace catalog endpoints (Portal 1 - Self-Service)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from ..auth import UserContext, get_current_user
from ..models.workspace import CreateWorkspaceRequest, Workspace
from ..stores import archetype_store, audit_store, workspace_store
from ..stores.compat import aio

router = APIRouter()


_VALID_CLASSIFICATIONS = {"unclassified", "protected_a", "protected_b"}


@router.get("/workspaces")
async def list_workspaces(
    user: UserContext = Depends(get_current_user),
) -> list[Workspace]:
    """List workspaces the current user has access to."""
    return await aio(workspace_store.list(user.workspace_grants))


@router.post("/workspaces", status_code=201, response_model=Workspace)
async def create_workspace(
    body: CreateWorkspaceRequest,
    user: UserContext = Depends(get_current_user),
) -> Workspace:
    """Provision a new workspace from an archetype template.

    The caller's role must be admin or contributor. Archetype key must exist in
    ArchetypeStore. Classification ceiling cannot exceed the caller's clearance.
    """
    if user.role not in ("admin", "contributor"):
        raise HTTPException(
            status_code=403,
            detail="Workspace creation requires contributor or admin role",
        )
    if body.data_classification not in _VALID_CLASSIFICATIONS:
        raise HTTPException(
            status_code=422,
            detail=f"data_classification must be one of {sorted(_VALID_CLASSIFICATIONS)}",
        )

    # Enforce clearance — user can't create workspaces above their own level.
    order = {"unclassified": 0, "protected_a": 1, "protected_b": 2}
    if order[body.data_classification] > order[user.data_classification_level]:
        raise HTTPException(
            status_code=403,
            detail="Requested classification exceeds your clearance level",
        )

    archetype = await aio(archetype_store.get(body.archetype))
    if archetype is None:
        raise HTTPException(
            status_code=422, detail=f"Unknown archetype '{body.archetype}'"
        )

    now = datetime.now(UTC).isoformat()
    new_id = f"ws-{uuid.uuid4().hex[:10]}"
    ws = Workspace(
        id=new_id,
        name=body.name,
        name_fr=body.name_fr or body.name,
        description=body.description,
        description_fr=body.description_fr or body.description,
        type=body.archetype,
        status="draft",
        owner_id=user.user_id,
        data_classification=body.data_classification,
        document_capacity=archetype.default_capacity,
        document_count=0,
        monthly_cost=0.0,
        cost_centre="",
        created_at=now,
        updated_at=now,
        infrastructure={},
        business_prompt="",
        business_prompt_version=1,
        business_prompt_history=[],
        archetype=body.archetype,
    )
    created = await aio(workspace_store.create(ws))

    audit_store.record(
        actor=user.user_id,
        action="workspace.create",
        target=new_id,
        subject=body.name,
        decision="allow",
        policy="workspace-catalog",
        rationale=f"Provisioned '{body.name}' from archetype '{body.archetype}'",
        correlation_id=None,
    )
    return created


@router.get("/workspaces/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    user: UserContext = Depends(get_current_user),
) -> Workspace:
    """Return detail for a single workspace."""
    ws = await aio(workspace_store.get(workspace_id))
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{workspace_id}' not found")
    if "all" not in user.workspace_grants and workspace_id not in user.workspace_grants:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")
    return ws
