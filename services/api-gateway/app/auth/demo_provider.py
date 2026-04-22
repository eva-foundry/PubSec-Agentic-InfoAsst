from fastapi import HTTPException

from .models import UserContext

_DEMO_USERS: list[UserContext] = [
    UserContext(
        user_id="demo-alice",
        email="alice@example.org",
        name="Alice Chen",
        role="contributor",
        portal_access=["self-service"],
        workspace_grants=["ws-oas-act", "ws-ei-juris"],
        data_classification_level="sensitive",
        language="en",
    ),
    UserContext(
        user_id="demo-bob",
        email="bob@example.org",
        name="Bob Wilson",
        role="reader",
        portal_access=["self-service"],
        workspace_grants=["ws-oas-act"],
        data_classification_level="sensitive",
        language="en",
    ),
    UserContext(
        user_id="demo-carol",
        email="carol@example.org",
        name="Carol Martinez",
        role="admin",
        portal_access=["self-service", "admin"],
        workspace_grants=["all"],
        data_classification_level="sensitive",
        language="en",
    ),
    UserContext(
        user_id="demo-dave",
        email="dave@example.org",
        name="Dave Thompson",
        role="admin",
        portal_access=["self-service", "admin", "ops"],
        workspace_grants=["all"],
        data_classification_level="sensitive",
        language="en",
    ),
    UserContext(
        user_id="demo-eve",
        email="eve@example.org",
        name="Eve Tremblay",
        role="contributor",
        portal_access=["self-service"],
        workspace_grants=["ws-oas-act", "ws-ei-juris", "ws-bdm-km"],
        data_classification_level="sensitive",
        language="fr",
    ),
]

_DEMO_USERS_BY_EMAIL: dict[str, UserContext] = {u.email: u for u in _DEMO_USERS}


def get_demo_users() -> list[UserContext]:
    """Return all pre-configured demo personas."""
    return list(_DEMO_USERS)


def get_demo_user(email: str) -> UserContext | None:
    """Look up a demo persona by email. Returns None if not found."""
    return _DEMO_USERS_BY_EMAIL.get(email)


def demo_login(email: str) -> UserContext:
    """Authenticate as a demo user. Raises 404 if email not in demo roster."""
    user = get_demo_user(email)
    if user is None:
        raise HTTPException(status_code=404, detail=f"Demo user '{email}' not found")
    return user
