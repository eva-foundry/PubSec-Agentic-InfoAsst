"""Tests for APIM-simulation cost-attribution headers (Phase E)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import telemetry_store

DAVE = {"x-demo-user-email": "dave@example.org"}


@pytest.fixture(autouse=True)
def _snapshot_telemetry():
    # Snapshot existing records so tests only inspect what this request added.
    baseline_len = len(telemetry_store._records)  # type: ignore[attr-defined]
    yield baseline_len


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestAPIMAttribution:
    def test_client_id_falls_back_to_eva_agentic_without_header(
        self, client: TestClient, _snapshot_telemetry: int
    ):
        client.get("/v1/aia/workspaces", headers=DAVE)
        record = telemetry_store._records[-1]  # type: ignore[attr-defined]
        assert record.client_id == "aia-agentic"
        assert record.user_group == ""
        assert record.classification == ""

    def test_frontend_headers_flow_through(
        self, client: TestClient, _snapshot_telemetry: int
    ):
        client.get(
            "/v1/aia/workspaces",
            headers={
                **DAVE,
                "x-app-id": "portal-unified",
                "x-user-group": "admin",
                "x-classification": "sensitive",
            },
        )
        record = telemetry_store._records[-1]  # type: ignore[attr-defined]
        assert record.client_id == "portal-unified"
        assert record.user_group == "admin"
        assert record.classification == "sensitive"

    def test_records_are_queryable_by_client_id(
        self, client: TestClient, _snapshot_telemetry: int
    ):
        """FinOps attribution depends on cost_by_client rollup picking up the
        frontend's app id — smoke-check the aggregation sees the new value."""
        client.get(
            "/v1/aia/workspaces",
            headers={**DAVE, "x-app-id": "portal-unified"},
        )
        summary = telemetry_store.summary(days=30)
        assert "portal-unified" in summary["cost_by_client"]
