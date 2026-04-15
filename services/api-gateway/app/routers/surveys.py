"""Entry/exit survey endpoints (Portal 1 - Self-Service)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import UserContext, get_current_user
from ..models.workspace import EntrySurvey, ExitSurvey
from ..stores import booking_store, survey_store, workspace_store
from ..stores.compat import aio

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


class EntrySurveyCreate(BaseModel):
    booking_id: str
    use_case: str
    expected_users: int = Field(ge=0)
    expected_data_volume_gb: float = Field(ge=0)
    data_classification: str = Field(
        default="unclassified",
        description="'unclassified', 'protected_a', 'protected_b'",
    )
    business_justification: str


class ExitSurveyCreate(BaseModel):
    booking_id: str
    satisfaction_rating: int = Field(ge=1, le=5)
    objectives_met: bool
    data_disposition: str = Field(description="'keep', 'archive', 'delete'")
    feedback: str = ""
    would_recommend: bool = True


@router.post("/surveys/entry", status_code=201)
async def submit_entry_survey(
    payload: EntrySurveyCreate,
    user: UserContext = Depends(get_current_user),
) -> EntrySurvey:
    """Submit an entry survey before workspace provisioning."""
    bk = await aio(booking_store.get(payload.booking_id))
    if bk is None:
        raise HTTPException(status_code=404, detail=f"Booking '{payload.booking_id}' not found")
    if bk.requester_id != user.user_id and "all" not in user.workspace_grants:
        raise HTTPException(status_code=403, detail="You do not own this booking")

    existing = await aio(survey_store.get_entry_by_booking(payload.booking_id))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Entry survey already submitted for this booking")

    survey = EntrySurvey(
        id=f"es-{uuid.uuid4().hex[:8]}",
        booking_id=payload.booking_id,
        use_case=payload.use_case,
        expected_users=payload.expected_users,
        expected_data_volume_gb=payload.expected_data_volume_gb,
        data_classification=payload.data_classification,
        business_justification=payload.business_justification,
        completed_at=_now_iso(),
    )
    await aio(survey_store.create_entry(survey))

    await aio(booking_store.update(payload.booking_id, {
        "entry_survey_completed": True,
        "updated_at": _now_iso(),
    }))

    return survey


@router.post("/surveys/exit", status_code=201)
async def submit_exit_survey(
    payload: ExitSurveyCreate,
    user: UserContext = Depends(get_current_user),
) -> ExitSurvey:
    """Submit an exit survey when a booking ends."""
    bk = await aio(booking_store.get(payload.booking_id))
    if bk is None:
        raise HTTPException(status_code=404, detail=f"Booking '{payload.booking_id}' not found")
    if bk.requester_id != user.user_id and "all" not in user.workspace_grants:
        raise HTTPException(status_code=403, detail="You do not own this booking")

    existing = await aio(survey_store.get_exit_by_booking(payload.booking_id))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Exit survey already submitted for this booking")

    survey = ExitSurvey(
        id=f"xs-{uuid.uuid4().hex[:8]}",
        booking_id=payload.booking_id,
        satisfaction_rating=payload.satisfaction_rating,
        objectives_met=payload.objectives_met,
        data_disposition=payload.data_disposition,
        feedback=payload.feedback,
        would_recommend=payload.would_recommend,
        completed_at=_now_iso(),
    )
    await aio(survey_store.create_exit(survey))

    await aio(booking_store.update(payload.booking_id, {
        "exit_survey_completed": True,
        "status": "completed",
        "updated_at": _now_iso(),
    }))

    return survey
