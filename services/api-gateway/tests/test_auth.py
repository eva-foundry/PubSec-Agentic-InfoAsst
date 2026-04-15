from fastapi import Depends
from fastapi.testclient import TestClient

from app.auth import UserContext, get_current_user
from app.main import app

client = TestClient(app)


def test_list_demo_users_returns_five():
    response = client.get("/v1/eva/auth/demo/users")
    assert response.status_code == 200
    users = response.json()
    assert len(users) == 5
    emails = {u["email"] for u in users}
    assert "alice@demo.gc.ca" in emails
    assert "dave@demo.gc.ca" in emails


def test_demo_login_valid_email():
    response = client.post(
        "/v1/eva/auth/demo/login",
        json={"email": "alice@demo.gc.ca"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "alice@demo.gc.ca"
    assert data["name"] == "Alice Chen"
    assert data["role"] == "contributor"
    assert data["portal_access"] == ["self-service"]
    assert data["workspace_grants"] == ["ws-oas-act", "ws-ei-juris"]
    assert data["data_classification_level"] == "protected_b"


def test_demo_login_invalid_email():
    response = client.post(
        "/v1/eva/auth/demo/login",
        json={"email": "nobody@demo.gc.ca"},
    )
    assert response.status_code == 404


def test_get_current_user_with_demo_header():
    """Test the get_current_user dependency via a temporary endpoint."""

    @app.get("/test/me", response_model=UserContext)
    async def _test_me(user: UserContext = Depends(get_current_user)):
        return user

    response = client.get(
        "/test/me",
        headers={"x-demo-user-email": "bob@demo.gc.ca"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "bob@demo.gc.ca"
    assert data["role"] == "reader"


def test_get_current_user_without_header_returns_401():
    """Missing x-demo-user-email header should yield 401."""

    @app.get("/test/me-no-header", response_model=UserContext)
    async def _test_me_no_header(user: UserContext = Depends(get_current_user)):
        return user

    response = client.get("/test/me-no-header")
    assert response.status_code == 401
