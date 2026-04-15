from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..auth.demo_provider import demo_login, get_demo_users
from ..auth.models import UserContext
from ..config import settings

router = APIRouter()


class DemoLoginRequest(BaseModel):
    email: str


def _require_demo_mode() -> None:
    if settings.auth_mode != "demo":
        raise HTTPException(status_code=404, detail="Demo auth disabled")


@router.get("/demo/users", response_model=list[UserContext])
async def list_demo_users() -> list[UserContext]:
    """Return all available demo personas."""
    _require_demo_mode()
    return get_demo_users()


@router.post("/demo/login", response_model=UserContext)
async def login_demo_user(body: DemoLoginRequest) -> UserContext:
    """Authenticate as a demo user by email."""
    _require_demo_mode()
    return demo_login(body.email)
