"""Entry/exit survey endpoints (Portal 1 - Self-Service)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from ..auth import UserContext, get_current_user
from ..models.workspace import EntrySurvey, ExitSurvey

router = APIRouter()


@router.post("/surveys/entry", status_code=201)
async def submit_entry_survey(
    payload: EntrySurvey,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Submit an entry survey before workspace provisioning."""
    return {
        "id": payload.id or str(uuid.uuid4()),
        "booking_id": payload.booking_id,
        "status": "submitted",
        "submitted_by": user.user_id,
    }


@router.post("/surveys/exit", status_code=201)
async def submit_exit_survey(
    payload: ExitSurvey,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Submit an exit survey when a booking ends."""
    return {
        "id": payload.id or str(uuid.uuid4()),
        "booking_id": payload.booking_id,
        "status": "submitted",
        "submitted_by": user.user_id,
    }
