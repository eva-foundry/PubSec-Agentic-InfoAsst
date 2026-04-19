"""Tests for TelemetryStore.summary_historical (Phase B)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.stores.telemetry_store import APIMTelemetryRecord, TelemetryStore


@pytest.fixture
def store():
    """TelemetryStore with an empty record list + 3 synthetic samples."""
    s = TelemetryStore()
    # Wipe the pre-seeded realistic records so the test controls the timeline.
    s._records.clear()  # type: ignore[attr-defined]
    now = datetime.now(UTC)
    records = [
        APIMTelemetryRecord(
            correlation_id=f"c{i}",
            timestamp=now - timedelta(days=i),
            workspace_id="ws-oas-act",
            session_id="s1",
            client_id="eva-portal",
            deployment="chat-default",
            model_name="gpt-5-mini",
            operation="chat/completions",
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150,
            latency_ms=200 + i * 100,
            cost_cad=0.5 + i * 0.1,
            status_code=200,
        )
        for i in (0, 1, 5)
    ]
    for r in records:
        s.add(r)
    return s


class TestSummaryHistorical:
    def test_returns_requested_number_of_days(self, store: TelemetryStore):
        out = store.summary_historical(days=7)
        assert len(out) == 7

    def test_points_ordered_oldest_first(self, store: TelemetryStore):
        out = store.summary_historical(days=7)
        days = [p["day"] for p in out]
        assert days == sorted(days)

    def test_empty_days_zeroed(self, store: TelemetryStore):
        out = store.summary_historical(days=7)
        # day at index 0 is 6 days ago — no records there.
        assert out[0]["queries"] == 0
        assert out[0]["cost_cad"] == 0.0
        assert out[0]["avg_latency_ms"] == 0.0

    def test_today_reflects_record(self, store: TelemetryStore):
        out = store.summary_historical(days=2)
        today = out[-1]
        assert today["queries"] == 1
        assert today["cost_cad"] > 0
        assert today["avg_latency_ms"] > 0

    def test_point_shape(self, store: TelemetryStore):
        out = store.summary_historical(days=3)
        assert set(out[0].keys()) == {"day", "cost_cad", "queries", "avg_latency_ms"}
