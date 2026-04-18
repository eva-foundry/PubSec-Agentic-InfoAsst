"""Tests for /ops/deployments + /admin/deployments/{version}/rollback."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import deployment_store


@pytest.fixture(autouse=True)
def _fresh_deployment_store():
    """Reset the seed between tests so rollback mutations don't leak."""
    # The store is a module-level singleton; reinitialize its seed.
    deployment_store.__init__()  # type: ignore[misc]
    yield
    deployment_store.__init__()  # type: ignore[misc]


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _admin_headers() -> dict[str, str]:
    return {"x-demo-user-email": "dave@demo.gc.ca"}


def _non_admin_headers() -> dict[str, str]:
    return {"x-demo-user-email": "alice@demo.gc.ca"}


class TestListDeployments:
    def test_returns_array_not_wrapper(self, client: TestClient) -> None:
        resp = client.get("/v1/eva/ops/deployments", headers=_admin_headers())
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) > 0
        first = body[0]
        for key in ("version", "deployed_at", "deployed_by", "status", "notes"):
            assert key in first

    def test_exactly_one_active_record_by_default(self, client: TestClient) -> None:
        resp = client.get("/v1/eva/ops/deployments", headers=_admin_headers())
        actives = [d for d in resp.json() if d["status"] == "active"]
        assert len(actives) == 1


class TestRollback:
    def test_admin_can_rollback_to_prior_version(self, client: TestClient) -> None:
        # v0.1.3 is active by default; rollback to v0.1.2.
        resp = client.post(
            "/v1/eva/admin/deployments/v0.1.2/rollback",
            headers=_admin_headers(),
            json={"rationale": "calibration regression on answer grounding"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["version"] == "v0.1.2"
        assert body["status"] == "active"
        assert "calibration regression" in body["notes"]

        # The old active (v0.1.3) now shows rolled-back.
        listing = client.get("/v1/eva/ops/deployments", headers=_admin_headers()).json()
        current = next(d for d in listing if d["version"] == "v0.1.3")
        assert current["status"] == "rolled-back"
        assert "calibration regression" in current["notes"]

    def test_non_admin_gets_403(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/eva/admin/deployments/v0.1.2/rollback",
            headers=_non_admin_headers(),
            json={"rationale": "nope"},
        )
        assert resp.status_code == 403

    def test_unknown_version_returns_409(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/eva/admin/deployments/v999/rollback",
            headers=_admin_headers(),
            json={"rationale": "test"},
        )
        assert resp.status_code == 409
        assert "unknown version" in resp.json()["detail"]

    def test_rollback_to_active_returns_409(self, client: TestClient) -> None:
        # v0.1.3 is already active; rolling back to it is a no-op error.
        resp = client.post(
            "/v1/eva/admin/deployments/v0.1.3/rollback",
            headers=_admin_headers(),
            json={"rationale": "test"},
        )
        assert resp.status_code == 409
        assert "already active" in resp.json()["detail"]

    def test_missing_rationale_returns_422(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/eva/admin/deployments/v0.1.2/rollback",
            headers=_admin_headers(),
            json={},
        )
        assert resp.status_code == 422

    def test_short_rationale_returns_422(self, client: TestClient) -> None:
        resp = client.post(
            "/v1/eva/admin/deployments/v0.1.2/rollback",
            headers=_admin_headers(),
            json={"rationale": "hi"},
        )
        assert resp.status_code == 422
