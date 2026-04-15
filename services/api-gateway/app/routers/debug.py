"""Debug endpoints for circuit breaker demo — gated by EVA_DEBUG=true."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..auth import UserContext, get_current_user
from ..config import get_settings
from ..guardrails.degradation import DependencyStatus
from ..stores import degradation_manager

router = APIRouter()

VALID_SERVICES = {"search", "openai", "cosmos"}


def _require_debug_mode() -> None:
    """Raise 404 if EVA_DEBUG is not enabled — hides debug routes entirely."""
    settings = get_settings()
    if not settings.debug:
        raise HTTPException(status_code=404, detail="Not found")


@router.post("/debug/trip-breaker/{service}")
async def trip_breaker(
    service: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Trip circuit breaker for a service. Services: search, openai, cosmos."""
    _require_debug_mode()

    if service not in VALID_SERVICES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown service '{service}'. Valid: {', '.join(sorted(VALID_SERVICES))}",
        )

    breaker = degradation_manager.breakers.get(service)
    if not breaker:
        raise HTTPException(status_code=400, detail=f"No breaker registered for '{service}'")

    # Force-trip: record enough failures to open the breaker
    for _ in range(breaker.failure_threshold):
        degradation_manager.record_failure(service)

    return {
        "service": service,
        "status": degradation_manager.get_status(service).value,
        "message": f"Circuit breaker for '{service}' tripped (forced {breaker.failure_threshold} failures)",
    }


@router.post("/debug/reset-breaker/{service}")
async def reset_breaker(
    service: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Reset circuit breaker for a service."""
    _require_debug_mode()

    if service not in VALID_SERVICES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown service '{service}'. Valid: {', '.join(sorted(VALID_SERVICES))}",
        )

    degradation_manager.record_success(service)
    return {
        "service": service,
        "status": degradation_manager.get_status(service).value,
        "message": f"Circuit breaker for '{service}' reset",
    }


@router.get("/debug/breakers")
async def list_breakers(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Current state of all circuit breakers."""
    _require_debug_mode()

    statuses = degradation_manager.get_all_statuses()
    breaker_details = {}
    for name, status in statuses.items():
        breaker = degradation_manager.breakers[name]
        breaker_details[name] = {
            "status": status.value,
            "failure_count": breaker._failure_count,
            "failure_threshold": breaker.failure_threshold,
            "is_open": breaker.is_open,
        }

    return {
        "breakers": breaker_details,
        "fallback_tier": degradation_manager.get_fallback_tier(),
        "notice": degradation_manager.get_degradation_notice(),
    }
