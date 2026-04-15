"""Team management endpoints (Portal 1 - Self-Service)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import UserContext, get_current_user
from ..models.workspace import TeamMember
from ..stores import booking_store, team_store
from ..stores.compat import aio

router = APIRouter()

_VALID_ROLES = {"reader", "contributor", "admin"}


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


class AddMemberPayload(BaseModel):
    email: str
    name: str
    user_id: str = ""
    role: str = Field(default="reader", description="'reader', 'contributor', 'admin'")


class UpdateRolePayload(BaseModel):
    role: str = Field(description="'reader', 'contributor', 'admin'")


async def _verify_booking_access(booking_id: str, user: UserContext):
    """Verify the booking exists and the user has access to it."""
    bk = await aio(booking_store.get(booking_id))
    if bk is None:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found")
    if bk.requester_id != user.user_id and "all" not in user.workspace_grants:
        member = await aio(team_store.get(booking_id, user.user_id))
        if member is None:
            raise HTTPException(status_code=403, detail="Access denied to this booking")
    return bk


async def _verify_admin(booking_id: str, user: UserContext):
    """Verify the user is an admin on this booking's team or the booking owner."""
    bk = await aio(booking_store.get(booking_id))
    if bk is None:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found")
    if "all" in user.workspace_grants:
        return bk
    if bk.requester_id == user.user_id:
        return bk
    if await aio(team_store.is_admin(booking_id, user.user_id)):
        return bk
    raise HTTPException(status_code=403, detail="Only admins can manage team members")


@router.get("/teams/{booking_id}/members")
async def list_members(
    booking_id: str,
    user: UserContext = Depends(get_current_user),
) -> list[TeamMember]:
    """List team members for a booking."""
    await _verify_booking_access(booking_id, user)
    return await aio(team_store.list_by_booking(booking_id))


@router.post("/teams/{booking_id}/members", status_code=201)
async def add_member(
    booking_id: str,
    payload: AddMemberPayload,
    user: UserContext = Depends(get_current_user),
) -> TeamMember:
    """Add a team member to a booking's workspace."""
    bk = await _verify_admin(booking_id, user)

    if payload.role not in _VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{payload.role}'. Must be one of: {', '.join(sorted(_VALID_ROLES))}",
        )

    member_user_id = payload.user_id or f"user-{uuid.uuid4().hex[:8]}"

    member = TeamMember(
        id=f"tm-{uuid.uuid4().hex[:8]}",
        workspace_id=bk.workspace_id,
        user_id=member_user_id,
        email=payload.email,
        name=payload.name,
        role=payload.role,
        added_at=_now_iso(),
        added_by=user.user_id,
    )
    await aio(team_store.add(booking_id, member))
    return member


@router.patch("/teams/{booking_id}/members/{user_id}")
async def update_member_role(
    booking_id: str,
    user_id: str,
    payload: UpdateRolePayload,
    user: UserContext = Depends(get_current_user),
) -> TeamMember:
    """Change a member's role."""
    await _verify_admin(booking_id, user)

    if payload.role not in _VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{payload.role}'. Must be one of: {', '.join(sorted(_VALID_ROLES))}",
        )

    updated = await aio(team_store.update_role(booking_id, user_id, payload.role))
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Member '{user_id}' not found in booking '{booking_id}'")
    return updated


@router.delete("/teams/{booking_id}/members/{user_id}", status_code=204)
async def remove_member(
    booking_id: str,
    user_id: str,
    user: UserContext = Depends(get_current_user),
) -> None:
    """Remove a member from a booking's workspace."""
    await _verify_admin(booking_id, user)

    removed = await aio(team_store.remove(booking_id, user_id))
    if not removed:
        raise HTTPException(status_code=404, detail=f"Member '{user_id}' not found in booking '{booking_id}'")
