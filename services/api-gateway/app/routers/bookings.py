"""Booking lifecycle endpoints (Portal 1 - Self-Service)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from math import ceil

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import UserContext, get_current_user
from ..models.workspace import Booking
from ..stores import booking_store, workspace_store
from ..stores.compat import aio

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(tz=UTC).isoformat()


def _weeks_between(start: str, end: str) -> int:
    """Calculate the number of weeks between two ISO date strings (rounded up)."""
    s = datetime.fromisoformat(start)
    e = datetime.fromisoformat(end)
    days = (e - s).days
    return max(1, ceil(days / 7))


# --- Request/response schemas ---


class BookingCreate(BaseModel):
    workspace_id: str
    start_date: str = Field(description="ISO date")
    end_date: str = Field(description="ISO date")


class BookingUpdate(BaseModel):
    status: str | None = None
    end_date: str | None = None


class BookingResponse(Booking):
    """Booking with computed cost fields."""

    weekly_cost: float = 0.0
    total_cost: float = 0.0
    search_index_id: str | None = None


# Valid status transitions
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"active", "cancelled"},
    "active": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


@router.post("/bookings", status_code=201)
async def create_booking(
    payload: BookingCreate,
    user: UserContext = Depends(get_current_user),
) -> BookingResponse:
    """Create a new workspace booking request."""
    ws = await aio(workspace_store.get(payload.workspace_id))
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{payload.workspace_id}' not found")

    if "all" not in user.workspace_grants and payload.workspace_id not in user.workspace_grants:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")

    weeks = _weeks_between(payload.start_date, payload.end_date)
    weekly_cost = ws.monthly_cost / 4
    total_cost = round(weekly_cost * weeks, 2)

    now = _now_iso()
    booking = Booking(
        id=f"bk-{uuid.uuid4().hex[:8]}",
        workspace_id=payload.workspace_id,
        requester_id=user.user_id,
        status="pending",
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_at=now,
        updated_at=now,
    )
    await aio(booking_store.create(booking))

    return BookingResponse(
        **booking.model_dump(),
        weekly_cost=round(weekly_cost, 2),
        total_cost=total_cost,
    )


@router.get("/bookings")
async def list_bookings(
    user: UserContext = Depends(get_current_user),
) -> list[Booking]:
    """List current user's bookings."""
    return await aio(booking_store.list_by_user(user.user_id))


@router.patch("/bookings/{booking_id}")
async def update_booking(
    booking_id: str,
    payload: BookingUpdate,
    user: UserContext = Depends(get_current_user),
) -> BookingResponse:
    """Update a booking's status or end date."""
    bk = await aio(booking_store.get(booking_id))
    if bk is None:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found")

    if bk.requester_id != user.user_id and "all" not in user.workspace_grants:
        raise HTTPException(status_code=403, detail="You do not own this booking")

    updates: dict = {"updated_at": _now_iso()}
    search_index_id: str | None = None

    if payload.status:
        allowed = _VALID_TRANSITIONS.get(bk.status, set())
        if payload.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{bk.status}' to '{payload.status}'",
            )
        updates["status"] = payload.status
        if payload.status == "active":
            search_index_id = f"idx-{bk.workspace_id}-{booking_id}"

    if payload.end_date:
        updates["end_date"] = payload.end_date

    updated = await aio(booking_store.update(booking_id, updates))
    if updated is None:
        raise HTTPException(status_code=500, detail="Failed to update booking")

    ws = await aio(workspace_store.get(updated.workspace_id))
    weekly_cost = (ws.monthly_cost / 4) if ws else 0.0
    weeks = _weeks_between(updated.start_date, updated.end_date)

    return BookingResponse(
        **updated.model_dump(),
        weekly_cost=round(weekly_cost, 2),
        total_cost=round(weekly_cost * weeks, 2),
        search_index_id=search_index_id,
    )


@router.delete("/bookings/{booking_id}", status_code=204)
async def cancel_booking(
    booking_id: str,
    user: UserContext = Depends(get_current_user),
) -> None:
    """Cancel a booking (sets status to cancelled)."""
    bk = await aio(booking_store.get(booking_id))
    if bk is None:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found")

    if bk.requester_id != user.user_id and "all" not in user.workspace_grants:
        raise HTTPException(status_code=403, detail="You do not own this booking")

    await aio(booking_store.update(booking_id, {"status": "cancelled", "updated_at": _now_iso()}))
