"""Tests for telemetry_store.summary() — FinOps rollups including the
enriched forecast_cad / waste_score / chargeback_coverage fields."""

from __future__ import annotations

from app.stores.telemetry_store import TelemetryStore


def _store() -> TelemetryStore:
    # Seed data is loaded by __init__; we rely on it for stable numbers.
    return TelemetryStore()


class TestFinOpsSummary:
    def test_core_fields_present(self) -> None:
        summary = _store().summary(days=30)
        for key in (
            "period_days",
            "total_cost_cad",
            "query_count",
            "avg_latency_ms",
            "avg_tokens",
            "cost_by_workspace",
            "cost_by_model",
            "cost_by_client",
        ):
            assert key in summary, f"missing core field: {key}"

    def test_enriched_fields_present_and_typed(self) -> None:
        summary = _store().summary(days=30)
        assert "forecast_cad" in summary
        assert "waste_score" in summary
        assert "chargeback_coverage" in summary
        assert isinstance(summary["forecast_cad"], (int, float))
        assert isinstance(summary["waste_score"], (int, float))
        assert isinstance(summary["chargeback_coverage"], (int, float))

    def test_forecast_is_linear_projection(self) -> None:
        summary = _store().summary(days=30)
        total = float(summary["total_cost_cad"])
        forecast = float(summary["forecast_cad"])
        if total == 0:
            assert forecast == 0
            return
        # forecast = (total / days) * 30 → equal when days=30
        assert forecast == summary["total_cost_cad"]

    def test_waste_score_bounded_0_100(self) -> None:
        summary = _store().summary(days=30)
        assert 0.0 <= summary["waste_score"] <= 100.0

    def test_chargeback_coverage_bounded_0_1(self) -> None:
        summary = _store().summary(days=30)
        assert 0.0 <= summary["chargeback_coverage"] <= 1.0

    def test_empty_window_zeroes_enriched_fields(self) -> None:
        # days=0 → no records in window
        summary = _store().summary(days=0)
        assert summary["forecast_cad"] == 0.0
        assert summary["waste_score"] == 0.0
        assert summary["chargeback_coverage"] == 0.0
