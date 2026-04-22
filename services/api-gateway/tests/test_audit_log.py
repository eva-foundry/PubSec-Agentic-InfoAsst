"""Tests for /ops/audit + audit recording from admin mutations."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import audit_store, deployment_store


@pytest.fixture(autouse=True)
def _fresh_stores():
    """Reset audit + deployment stores between tests to isolate writes."""
    audit_store.__init__()  # type: ignore[misc]
    deployment_store.__init__()  # type: ignore[misc]
    yield
    audit_store.__init__()  # type: ignore[misc]
    deployment_store.__init__()  # type: ignore[misc]


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _ops_headers() -> dict[str, str]:
    return {"x-demo-user-email": "dave@example.org"}


def _non_ops_headers() -> dict[str, str]:
    return {"x-demo-user-email": "alice@example.org"}


class TestAuditEndpoint:
    def test_returns_seed_entries_newest_first(self, client: TestClient) -> None:
        resp = client.get("/v1/aia/ops/audit", headers=_ops_headers())
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) > 0
        timestamps = [e["timestamp"] for e in body]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_non_ops_gets_403(self, client: TestClient) -> None:
        resp = client.get("/v1/aia/ops/audit", headers=_non_ops_headers())
        assert resp.status_code == 403

    def test_filter_by_decision(self, client: TestClient) -> None:
        resp = client.get(
            "/v1/aia/ops/audit",
            headers=_ops_headers(),
            params={"decision": "deny"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) > 0
        assert all(e["decision"] == "deny" for e in body)

    def test_filter_by_action(self, client: TestClient) -> None:
        resp = client.get(
            "/v1/aia/ops/audit",
            headers=_ops_headers(),
            params={"action": "deployment.rollback"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert all(e["action"] == "deployment.rollback" for e in body)

    def test_limit_is_respected_and_bounded(self, client: TestClient) -> None:
        resp = client.get(
            "/v1/aia/ops/audit",
            headers=_ops_headers(),
            params={"limit": 2},
        )
        assert resp.status_code == 200
        assert len(resp.json()) <= 2


class TestAuditRecording:
    def test_deployment_rollback_writes_an_audit_entry(self, client: TestClient) -> None:
        before = len(client.get("/v1/aia/ops/audit", headers=_ops_headers()).json())

        rollback = client.post(
            "/v1/aia/admin/deployments/v0.1.2/rollback",
            headers=_ops_headers(),
            json={"rationale": "audit integration test"},
        )
        assert rollback.status_code == 200

        after = client.get(
            "/v1/aia/ops/audit",
            headers=_ops_headers(),
            params={"action": "deployment.rollback"},
        ).json()
        assert len(after) >= 1
        matching = [e for e in after if "audit integration test" in e["rationale"]]
        assert matching, "rollback did not write an audit entry with our rationale"
        entry = matching[0]
        assert entry["target"] == "v0.1.2"
        assert entry["actor"] == "demo-dave"
        assert entry["policy"] == "deploy-change-advisory"

        # Total grew by at least 1.
        total_after = len(client.get("/v1/aia/ops/audit", headers=_ops_headers()).json())
        assert total_after >= before + 1
