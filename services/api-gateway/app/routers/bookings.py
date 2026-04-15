"""Booking lifecycle endpoints (Portal 1 - Self-Service)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import UserContext, get_current_user
from ..models.workspace import Booking

router = APIRouter()


class BookingCreate(BaseModel):
    workspace_id: str
    start_date: str = Field(description="ISO date")
    end_date: str = Field(description="ISO date")


class BookingUpdate(BaseModel):
    status: str | None = None
    end_date: str | None = None


_MOCK_BOOKINGS: list[Booking] = [
    Booking(
        id="bk-001",
        workspace_id="ws-oas-act",
        requester_id="demo-alice",
        status="active",
        start_date="2026-03-01",
        end_date="2026-06-30",
        entry_survey_completed=True,
        exit_survey_completed=False,
        created_at="2026-02-15T10:00:00Z",
        updated_at="2026-03-01T00:00:00Z",
    ),
    Booking(
        id="bk-002",
        workspace_id="ws-ei-juris",
        requester_id="demo-alice",
        status="pending",
        start_date="2026-05-01",
        end_date="2026-08-31",
        created_at="2026-04-10T14:00:00Z",
        updated_at="2026-04-10T14:00:00Z",
    ),
]


@router.post("/bookings", status_code=201)
async def create_booking(
    payload: BookingCreate,
    user: UserContext = Depends(get_current_user),
) -> Booking:
    """Create a new workspace booking request."""
    return Booking(
        id=f"bk-{uuid.uuid4().hex[:8]}",
        workspace_id=payload.workspace_id,
        requester_id=user.user_id,
        status="pending",
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_at="2026-04-14T12:00:00Z",
        updated_at="2026-04-14T12:00:00Z",
    )


@router.get("/bookings")
async def list_bookings(
    user: UserContext = Depends(get_current_user),
) -> list[Booking]:
    """List current user's bookings."""
    return [b for b in _MOCK_BOOKINGS if b.requester_id == user.user_id]


@router.patch("/bookings/{booking_id}")
async def update_booking(
    booking_id: str,
    payload: BookingUpdate,
    user: UserContext = Depends(get_current_user),
) -> Booking:
    """Update a booking's status or end date."""
    for bk in _MOCK_BOOKINGS:
        if bk.id == booking_id:
            data = bk.model_dump()
            if payload.status:
                data["status"] = payload.status
            if payload.end_date:
                data["end_date"] = payload.end_date
            data["updated_at"] = "2026-04-14T12:00:00Z"
            return Booking(**data)
    raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found")


@router.delete("/bookings/{booking_id}", status_code=204)
async def cancel_booking(
    booking_id: str,
    user: UserContext = Depends(get_current_user),
) -> None:
    """Cancel a booking."""
    return None
