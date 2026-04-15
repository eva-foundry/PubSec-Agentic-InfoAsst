from fastapi import HTTPException, Request

from ..config import settings
from .demo_provider import get_demo_user
from .entra_provider import validate_token
from .models import UserContext


async def get_current_user(request: Request) -> UserContext:
    """FastAPI dependency that resolves the current user from request context.

    In demo mode: reads the ``x-demo-user-email`` header and looks up the
    corresponding demo persona.

    In production mode: extracts the Bearer token from the ``Authorization``
    header and validates it against Entra ID.
    """
    auth_mode = settings.auth_mode

    if auth_mode == "demo":
        email = request.headers.get("x-demo-user-email")
        if not email:
            raise HTTPException(
                status_code=401,
                detail="Missing x-demo-user-email header (demo auth mode)",
            )
        user = get_demo_user(email)
        if user is None:
            raise HTTPException(
                status_code=401,
                detail=f"Unknown demo user: {email}",
            )
        return user

    # Production mode — Entra ID JWT validation
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or malformed Authorization header",
        )
    token = auth_header.removeprefix("Bearer ")
    return await validate_token(token)
