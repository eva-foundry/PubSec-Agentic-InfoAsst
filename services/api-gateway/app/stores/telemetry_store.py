"""APIM telemetry store — in-memory store for cost tracking and FinOps.

Seeded with realistic historical data across April 2026.
In production this would be backed by Cosmos DB / Log Analytics.
"""

from __future__ import annotations

import random
import uuid
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel, Field


class APIMTelemetryRecord(BaseModel):
    """Single APIM request telemetry record."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    workspace_id: str = ""
    session_id: str = ""
    client_id: str = "eva-agentic"
    deployment: str = "chat-default"
    model_name: str = "gpt-5-mini"
    operation: str = "chat/completions"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: int = 0
    cost_cad: float = 0.0
    status_code: int = 200


# ---------------------------------------------------------------------------
# Pricing table (CAD per 1K tokens, illustrative)
# ---------------------------------------------------------------------------

# Deployment name → model name mapping
_DEPLOYMENT_MODEL: dict[str, str] = {
    "chat-default": "gpt-5-mini",
    "reasoning-premium": "gpt-5.1",
    "embeddings-default": "text-embedding-3-small",
}

_PRICING: dict[str, dict[str, float]] = {
    "chat-default": {"prompt": 0.00015, "completion": 0.0006},
    "reasoning-premium": {"prompt": 0.003, "completion": 0.012},
    "embeddings-default": {"prompt": 0.00002, "completion": 0.0},
}


def estimate_cost(deployment: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate cost in CAD for a request."""
    pricing = _PRICING.get(deployment, _PRICING["chat-default"])
    return round(
        (prompt_tokens / 1000) * pricing["prompt"]
        + (completion_tokens / 1000) * pricing["completion"],
        6,
    )


class TelemetryStore:
    """In-memory telemetry store with seed data."""

    def __init__(self) -> None:
        self._records: list[APIMTelemetryRecord] = []
        self._seed()

    # ------------------------------------------------------------------
    # Seed data
    # ------------------------------------------------------------------

    def _seed(self) -> None:
        """Generate 50+ realistic records across April 2026."""
        rng = random.Random(42)  # deterministic seed
        workspaces = ["ws-oas-act", "ws-ei-juris", "ws-faq"]
        workspace_weights = [0.3, 0.5, 0.2]
        deployments = ["chat-default", "reasoning-premium"]
        deployment_weights = [0.7, 0.3]
        clients = ["eva-agentic", "eva-portal", "eva-batch"]
        client_weights = [0.6, 0.3, 0.1]

        base = datetime(2026, 4, 1, 8, 0, 0, tzinfo=UTC)

        for i in range(60):
            ws = rng.choices(workspaces, weights=workspace_weights, k=1)[0]
            deployment = rng.choices(deployments, weights=deployment_weights, k=1)[0]
            client = rng.choices(clients, weights=client_weights, k=1)[0]

            day_offset = rng.randint(0, 13)  # April 1-14
            hour_offset = rng.randint(0, 9) + 8  # 8am-5pm
            minute_offset = rng.randint(0, 59)
            ts = base + timedelta(
                days=day_offset, hours=hour_offset, minutes=minute_offset
            )

            prompt_tokens = rng.randint(300, 2000)
            completion_tokens = rng.randint(200, 1200)
            total_tokens = prompt_tokens + completion_tokens
            latency = rng.randint(800, 3000)
            cost = estimate_cost(deployment, prompt_tokens, completion_tokens)

            self._records.append(
                APIMTelemetryRecord(
                    correlation_id=str(uuid.UUID(int=rng.getrandbits(128))),
                    timestamp=ts,
                    workspace_id=ws,
                    session_id=f"seed-session-{i // 5}",
                    client_id=client,
                    deployment=deployment,
                    model_name=_DEPLOYMENT_MODEL.get(deployment, deployment),
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    latency_ms=latency,
                    cost_cad=cost,
                    status_code=200 if rng.random() > 0.03 else 429,
                )
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add(self, record: APIMTelemetryRecord) -> None:
        """Record a new telemetry entry (called by APIM middleware)."""
        self._records.append(record)

    def list_by_workspace(
        self, ws_id: str, days: int = 30
    ) -> list[APIMTelemetryRecord]:
        """Return records for a workspace within the last N days."""
        cutoff = datetime.now(UTC) - timedelta(days=days)
        return [
            r
            for r in self._records
            if r.workspace_id == ws_id and r.timestamp >= cutoff
        ]

    def summary(self, days: int = 30) -> dict:
        """Aggregated FinOps summary for the ops dashboard."""
        cutoff = datetime.now(UTC) - timedelta(days=days)
        records = [r for r in self._records if r.timestamp >= cutoff]

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

        # Add cost_per_query to each workspace
        for ws_data in cost_by_workspace.values():
            ws_data["cost_per_query"] = round(
                ws_data["cost_cad"] / max(ws_data["queries"], 1), 4
            )

        cost_by_model: dict[str, dict] = {}
        for r in records:
            d = r.deployment
            if d not in cost_by_model:
                cost_by_model[d] = {"cost_cad": 0.0, "queries": 0, "model_name": r.model_name}
            cost_by_model[d]["cost_cad"] = round(
                cost_by_model[d]["cost_cad"] + r.cost_cad, 6
            )
            cost_by_model[d]["queries"] += 1

        cost_by_client: dict[str, dict] = {}
        for r in records:
            c = r.client_id
            if c not in cost_by_client:
                cost_by_client[c] = {"cost_cad": 0.0, "queries": 0}
            cost_by_client[c]["cost_cad"] = round(
                cost_by_client[c]["cost_cad"] + r.cost_cad, 6
            )
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

    def session_cost(self, session_id: str) -> dict:
        """Accumulated cost for a specific session."""
        records = [r for r in self._records if r.session_id == session_id]
        total = sum(r.cost_cad for r in records)
        return {
            "session_id": session_id,
            "cost_cad": round(total, 6),
            "queries": len(records),
        }
