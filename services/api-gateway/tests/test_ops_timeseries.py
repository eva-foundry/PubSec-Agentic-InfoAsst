"""Tests for AIOps timeseries, calibration, LiveOps latency, incidents (#20)."""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app

DAVE = {"x-demo-user-email": "dave@example.org"}  # ops
ALICE = {"x-demo-user-email": "alice@example.org"}  # no ops


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestAIOpsTimeseries:
    def test_default_returns_14_days(self, client: TestClient):
        body = client.get("/v1/aia/ops/metrics/aiops", headers=DAVE).json()
        assert body["days"] == 14
        assert len(body["timeseries"]) == 14

    def test_days_query_param(self, client: TestClient):
        body = client.get(
            "/v1/aia/ops/metrics/aiops?days=30", headers=DAVE
        ).json()
        assert body["days"] == 30
        assert len(body["timeseries"]) == 30

    def test_days_clamped_to_90(self, client: TestClient):
        body = client.get(
            "/v1/aia/ops/metrics/aiops?days=500", headers=DAVE
        ).json()
        assert body["days"] == 90
        assert len(body["timeseries"]) == 90

    def test_timeseries_shape(self, client: TestClient):
        body = client.get("/v1/aia/ops/metrics/aiops", headers=DAVE).json()
        first = body["timeseries"][0]
        assert set(first) == {"day", "groundedness", "relevance", "coherence"}
        assert 0.0 <= first["groundedness"] <= 1.0
        assert 0.0 <= first["relevance"] <= 1.0
        assert 0.0 <= first["coherence"] <= 1.0

    def test_timeseries_last_day_is_today(self, client: TestClient):
        body = client.get(
            "/v1/aia/ops/metrics/aiops?days=7", headers=DAVE
        ).json()
        assert body["timeseries"][-1]["day"] == date.today().isoformat()


class TestCalibrationScatter:
    def test_returns_samples(self, client: TestClient):
        body = client.get("/v1/aia/ops/metrics/calibration", headers=DAVE).json()
        assert "samples" in body
        assert "count" in body
        assert body["count"] == len(body["samples"])

    def test_sample_shape(self, client: TestClient):
        body = client.get(
            "/v1/aia/ops/metrics/calibration?limit=5", headers=DAVE
        ).json()
        for s in body["samples"]:
            assert set(s) == {"predicted", "actual"}
            assert 0.0 <= s["predicted"] <= 1.0
            assert 0.0 <= s["actual"] <= 1.0

    def test_limit_caps_samples(self, client: TestClient):
        body = client.get(
            "/v1/aia/ops/metrics/calibration?limit=2", headers=DAVE
        ).json()
        assert len(body["samples"]) <= 2

    def test_requires_ops(self, client: TestClient):
        resp = client.get("/v1/aia/ops/metrics/calibration", headers=ALICE)
        assert resp.status_code == 403


class TestLiveOpsLatency:
    def test_rollup_default_has_no_latency_array(self, client: TestClient):
        body = client.get("/v1/aia/ops/metrics/liveops", headers=DAVE).json()
        assert "latency_24h" not in body
        assert "queues" in body

    def test_hour_granularity_returns_24_points(self, client: TestClient):
        body = client.get(
            "/v1/aia/ops/metrics/liveops?granularity=hour&hours=24",
            headers=DAVE,
        ).json()
        assert len(body["latency_24h"]) == 24
        first = body["latency_24h"][0]
        assert set(first) == {"hour", "p50_ms", "p99_ms"}
        assert first["p99_ms"] >= first["p50_ms"]

    def test_hour_granularity_respects_hours_param(self, client: TestClient):
        body = client.get(
            "/v1/aia/ops/metrics/liveops?granularity=hour&hours=6",
            headers=DAVE,
        ).json()
        assert len(body["latency_24h"]) == 6

    def test_invalid_granularity_returns_422(self, client: TestClient):
        resp = client.get(
            "/v1/aia/ops/metrics/liveops?granularity=bogus", headers=DAVE
        )
        assert resp.status_code == 422

    def test_hourly_series_is_contiguous_and_ends_now(self, client: TestClient):
        body = client.get(
            "/v1/aia/ops/metrics/liveops?granularity=hour&hours=3",
            headers=DAVE,
        ).json()
        hours = [datetime.fromisoformat(p["hour"]) for p in body["latency_24h"]]
        # Hour-aligned and increasing by 1h.
        for a, b in zip(hours, hours[1:]):
            assert b - a == timedelta(hours=1)


class TestIncidents:
    def test_list_returns_rows(self, client: TestClient):
        rows = client.get("/v1/aia/ops/incidents", headers=DAVE).json()
        assert len(rows) >= 1
        assert {"id", "title", "status", "severity", "started_at"} <= set(rows[0])

    def test_status_filter(self, client: TestClient):
        rows = client.get(
            "/v1/aia/ops/incidents?status=resolved", headers=DAVE
        ).json()
        assert all(r["status"] == "resolved" for r in rows)

    def test_invalid_status_returns_422(self, client: TestClient):
        resp = client.get(
            "/v1/aia/ops/incidents?status=bogus", headers=DAVE
        )
        assert resp.status_code == 422

    def test_requires_ops(self, client: TestClient):
        resp = client.get("/v1/aia/ops/incidents", headers=ALICE)
        assert resp.status_code == 403
