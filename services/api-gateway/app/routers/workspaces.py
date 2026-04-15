"""Workspace catalog endpoints (Portal 1 - Self-Service)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..auth import UserContext, get_current_user
from ..models.workspace import Workspace
from ..stores import workspace_store

router = APIRouter()


@router.get("/workspaces")
async def list_workspaces(
    user: UserContext = Depends(get_current_user),
) -> list[Workspace]:
    """List workspaces the current user has access to."""
    return workspace_store.list(user.workspace_grants)


@router.get("/workspaces/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    user: UserContext = Depends(get_current_user),
) -> Workspace:
    """Return detail for a single workspace."""
    ws = workspace_store.get(workspace_id)
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{workspace_id}' not found")
    if "all" not in user.workspace_grants and workspace_id not in user.workspace_grants:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")
    return ws
