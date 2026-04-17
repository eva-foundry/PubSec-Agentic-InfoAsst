"""Cosmos DB-backed APIM telemetry store for FinOps."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from ..telemetry_store import APIMTelemetryRecord
from .cosmos_client import CosmosClientManager

CONTAINER = "telemetry"


def _strip(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


def _to_record(item: dict) -> APIMTelemetryRecord:
    cleaned = _strip(item)
    # Cosmos stores datetime as string — ensure proper parsing
    if isinstance(cleaned.get("timestamp"), str):
        cleaned["timestamp"] = datetime.fromisoformat(cleaned["timestamp"])
    return APIMTelemetryRecord(**cleaned)


class CosmosTelemetryStore:
    """Telemetry store backed by Cosmos DB (eva-platform/telemetry)."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def add(self, record: APIMTelemetryRecord) -> None:
        data = record.model_dump()
        data["timestamp"] = data["timestamp"].isoformat()
        await self._cosmos.upsert(CONTAINER, data)

    async def list_by_workspace(self, ws_id: str, days: int = 30) -> list[APIMTelemetryRecord]:
        cutoff = (datetime.now(UTC) - timedelta(days=days)).isoformat()
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.workspace_id = @ws AND c.timestamp >= @cutoff",
            parameters=[
                {"name": "@ws", "value": ws_id},
                {"name": "@cutoff", "value": cutoff},
            ],
            partition_key=ws_id,
        )
        return [_to_record(i) for i in items]

    async def summary(self, days: int = 30) -> dict:
        cutoff = (datetime.now(UTC) - timedelta(days=days)).isoformat()
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.timestamp >= @cutoff",
            parameters=[{"name": "@cutoff", "value": cutoff}],
        )
        records = [_to_record(i) for i in items]

        if not records:
            return {
                "period_days": days,
                "total_cost_cad": 0.0,
                "query_count": 0,
                "avg_latency_ms": 0,
                "avg_tokens": 0,
                "cost_by_workspace": {},
                "cost_by_model": {},
                "cost_by_client": {},
            }

        total_cost = sum(r.cost_cad for r in records)
        avg_latency = sum(r.latency_ms for r in records) / len(records)
        avg_tokens = sum(r.total_tokens for r in records) / len(records)

        cost_by_workspace: dict[str, dict] = {}
        for r in records:
            ws = r.workspace_id or "unknown"
            if ws not in cost_by_workspace:
                cost_by_workspace[ws] = {"cost_cad": 0.0, "queries": 0}
            cost_by_workspace[ws]["cost_cad"] = round(
                cost_by_workspace[ws]["cost_cad"] + r.cost_cad, 6
            )
            cost_by_workspace[ws]["queries"] += 1
        for ws_data in cost_by_workspace.values():
            ws_data["cost_per_query"] = round(ws_data["cost_cad"] / max(ws_data["queries"], 1), 4)

        cost_by_model: dict[str, dict] = {}
        for r in records:
            d = r.deployment
            if d not in cost_by_model:
                cost_by_model[d] = {"cost_cad": 0.0, "queries": 0, "model_name": r.model_name}
            cost_by_model[d]["cost_cad"] = round(cost_by_model[d]["cost_cad"] + r.cost_cad, 6)
            cost_by_model[d]["queries"] += 1

        cost_by_client: dict[str, dict] = {}
        for r in records:
            c = r.client_id
            if c not in cost_by_client:
                cost_by_client[c] = {"cost_cad": 0.0, "queries": 0}
            cost_by_client[c]["cost_cad"] = round(cost_by_client[c]["cost_cad"] + r.cost_cad, 6)
            cost_by_client[c]["queries"] += 1

        return {
            "period_days": days,
            "total_cost_cad": round(total_cost, 4),
            "query_count": len(records),
            "avg_latency_ms": round(avg_latency, 1),
            "avg_tokens": round(avg_tokens, 1),
            "cost_by_workspace": cost_by_workspace,
            "cost_by_model": cost_by_model,
            "cost_by_client": cost_by_client,
        }

    async def session_cost(self, session_id: str) -> dict:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.session_id = @sid",
            parameters=[{"name": "@sid", "value": session_id}],
        )
        records = [_to_record(i) for i in items]
        total = sum(r.cost_cad for r in records)
        return {"session_id": session_id, "cost_cad": round(total, 6), "queries": len(records)}
