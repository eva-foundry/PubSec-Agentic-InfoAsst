"""Team management endpoints (Portal 1 - Self-Service)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import UserContext, get_current_user
from ..models.workspace import TeamMember

router = APIRouter()


class AddMemberPayload(BaseModel):
    email: str
    name: str
    role: str = Field(default="reader", description="'reader', 'contributor', 'admin'")


class UpdateRolePayload(BaseModel):
    role: str = Field(description="'reader', 'contributor', 'admin'")


_MOCK_MEMBERS: dict[str, list[TeamMember]] = {
    "bk-001": [
        TeamMember(
            id="tm-001",
            workspace_id="ws-oas-act",
            user_id="demo-alice",
            email="alice@demo.gc.ca",
            name="Alice Chen",
            role="contributor",
            added_at="2026-03-01T00:00:00Z",
            added_by="demo-carol",
        ),
        TeamMember(
            id="tm-002",
            workspace_id="ws-oas-act",
            user_id="demo-bob",
            email="bob@demo.gc.ca",
            name="Bob Wilson",
            role="reader",
            added_at="2026-03-05T10:00:00Z",
            added_by="demo-alice",
        ),
    ],
}


@router.get("/teams/{booking_id}/members")
async def list_members(
    booking_id: str,
    user: UserContext = Depends(get_current_user),
) -> list[TeamMember]:
    """List team members for a booking."""
    return _MOCK_MEMBERS.get(booking_id, [])


@router.post("/teams/{booking_id}/members", status_code=201)
async def add_member(
    booking_id: str,
    payload: AddMemberPayload,
    user: UserContext = Depends(get_current_user),
) -> TeamMember:
    """Add a team member to a booking's workspace."""
    return TeamMember(
        id=f"tm-{uuid.uuid4().hex[:8]}",
        workspace_id=f"ws-from-{booking_id}",
        user_id=str(uuid.uuid4()),
        email=payload.email,
        name=payload.name,
        role=payload.role,
        added_at="2026-04-14T12:00:00Z",
        added_by=user.user_id,
    )


@router.patch("/teams/{booking_id}/members/{user_id}")
async def update_member_role(
    booking_id: str,
    user_id: str,
    payload: UpdateRolePayload,
    user: UserContext = Depends(get_current_user),
) -> TeamMember:
    """Change a member's role."""
    members = _MOCK_MEMBERS.get(booking_id, [])
    for m in members:
        if m.user_id == user_id:
            data = m.model_dump()
            data["role"] = payload.role
            return TeamMember(**data)
    raise HTTPException(status_code=404, detail=f"Member '{user_id}' not found in booking '{booking_id}'")


@router.delete("/teams/{booking_id}/members/{user_id}", status_code=204)
async def remove_member(
    booking_id: str,
    user_id: str,
    user: UserContext = Depends(get_current_user),
) -> None:
    """Remove a member from a booking's workspace."""
    return None
