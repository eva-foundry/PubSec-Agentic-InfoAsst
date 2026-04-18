"""Tests for the drift metrics endpoint."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app

DAVE = {"x-demo-user-email": "dave@demo.gc.ca"}  # admin, ops portal
ALICE = {"x-demo-user-email": "alice@demo.gc.ca"}  # contributor, no ops portal


@pytest.fixture
def client():
    return TestClient(app)


class TestDriftMetrics:
    def test_requires_ops_portal(self, client: TestClient):
        resp = client.get("/v1/eva/ops/metrics/drift", headers=ALICE)
        assert resp.status_code == 403

    def test_default_window_is_30d(self, client: TestClient):
        resp = client.get("/v1/eva/ops/metrics/drift", headers=DAVE)
        assert resp.status_code == 200
        body = resp.json()
        assert body["window"] == "30d"
        assert len(body["model"]) == 30
        assert len(body["prompt"]) == 30
        assert len(body["corpus"]) == 30

    def test_explicit_windows(self, client: TestClient):
        for window, expected in [("7d", 7), ("30d", 30), ("90d", 90)]:
            resp = client.get(
                f"/v1/eva/ops/metrics/drift?window={window}", headers=DAVE
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["window"] == window
            assert len(body["model"]) == expected

    def test_invalid_window_returns_422(self, client: TestClient):
        resp = client.get(
            "/v1/eva/ops/metrics/drift?window=bogus", headers=DAVE
        )
        assert resp.status_code == 422

    def test_series_is_deterministic_per_workspace(self, client: TestClient):
        a = client.get(
            "/v1/eva/ops/metrics/drift?workspace_id=ws-oas-act&window=7d",
            headers=DAVE,
        )
        b = client.get(
            "/v1/eva/ops/metrics/drift?workspace_id=ws-oas-act&window=7d",
            headers=DAVE,
        )
        assert a.status_code == 200
        assert a.json() == b.json()

    def test_series_differs_across_workspaces(self, client: TestClient):
        a = client.get(
            "/v1/eva/ops/metrics/drift?workspace_id=ws-oas-act&window=7d",
            headers=DAVE,
        ).json()
        b = client.get(
            "/v1/eva/ops/metrics/drift?workspace_id=ws-ei-juris&window=7d",
            headers=DAVE,
        ).json()
        assert a["model"] != b["model"]

    def test_dates_are_contiguous_and_end_today(self, client: TestClient):
        resp = client.get(
            "/v1/eva/ops/metrics/drift?window=7d", headers=DAVE
        )
        days = [p["day"] for p in resp.json()["model"]]
        # Last entry is today; prior entries walk one day back each.
        today = date.today()
        expected = [
            (today - timedelta(days=i)).isoformat() for i in range(6, -1, -1)
        ]
        assert days == expected

    def test_point_shape(self, client: TestClient):
        body = client.get(
            "/v1/eva/ops/metrics/drift?window=7d", headers=DAVE
        ).json()
        assert set(body["model"][0]) == {"day", "psi", "confidence_delta"}
        assert set(body["prompt"][0]) == {"day", "lexical_shift", "token_mix_delta"}
        assert set(body["corpus"][0]) == {"day", "refresh_count", "stale_pct"}
        assert body["model"][0]["psi"] >= 0.0
        assert 0.0 <= body["prompt"][0]["lexical_shift"] <= 1.0
        assert 0.0 <= body["corpus"][0]["stale_pct"] <= 1.0
        assert body["corpus"][0]["refresh_count"] >= 0

    def test_alert_shape_when_present(self, client: TestClient):
        """Any alert returned must carry the contract fields."""
        body = client.get(
            "/v1/eva/ops/metrics/drift?workspace_id=probe-alerts&window=90d",
            headers=DAVE,
        ).json()
        for alert in body["alerts"]:
            assert set(alert.keys()) == {"type", "severity", "message", "since"}
            assert alert["type"] in {"model", "prompt", "corpus"}
            assert alert["severity"] in {"info", "warning", "critical"}
