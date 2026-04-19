"""Cosmos DB-backed audit log store.

Mirrors ``stores.audit_store.AuditStore``. Governance events (guardrail
decisions + admin mutations) are durable across restarts when
``EVA_API_MOCK=false``.
"""

from __future__ import annotations

from ..audit_store import AuditEntry
from .cosmos_client import CosmosClientManager

CONTAINER = "audit"


class CosmosAuditStore:
    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    # ---- writer API ----

    def record(
        self,
        *,
        actor: str,
        action: str,
        target: str,
        subject: str = "",
        decision: str = "allow",
        policy: str = "",
        rationale: str = "",
        correlation_id: str | None = None,
    ) -> AuditEntry:
        """Build an AuditEntry and return it immediately.

        The caller awaits nothing — we delegate to ``_persist`` as a
        fire-and-forget coroutine so callers keep the synchronous
        ergonomic shape of the in-memory store. Cosmos upsert is safe
        to drop on cold paths (audit is append-only best-effort).
        """
        entry = AuditEntry(
            actor=actor,
            action=action,
            target=target,
            subject=subject,
            decision=decision,
            policy=policy,
            rationale=rationale,
            correlation_id=correlation_id,
        )
        import asyncio

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._persist(entry))
        except RuntimeError:
            # No loop (rare — test harness). Skip persistence.
            pass
        return entry

    async def _persist(self, entry: AuditEntry) -> None:
        await self._cosmos.upsert(CONTAINER, entry.model_dump())

    # ---- reader API ----

    async def query(
        self,
        *,
        actor: str | None = None,
        action: str | None = None,
        decision: str | None = None,
        policy: str | None = None,
        start: str | None = None,
        end: str | None = None,
        limit: int = 200,
    ) -> list[AuditEntry]:
        clauses: list[str] = []
        params: list[dict] = []
        if actor:
            clauses.append("c.actor = @actor")
            params.append({"name": "@actor", "value": actor})
        if action:
            clauses.append("c.action = @action")
            params.append({"name": "@action", "value": action})
        if decision:
            clauses.append("c.decision = @decision")
            params.append({"name": "@decision", "value": decision})
        if policy:
            clauses.append("CONTAINS(LOWER(c.policy), @policy)")
            params.append({"name": "@policy", "value": policy.lower()})
        if start:
            clauses.append("c.timestamp >= @start")
            params.append({"name": "@start", "value": start})
        if end:
            clauses.append("c.timestamp <= @end")
            params.append({"name": "@end", "value": end})

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        sql = f"SELECT * FROM c {where} ORDER BY c.timestamp DESC"
        items = await self._cosmos.query(CONTAINER, sql, parameters=params)
        entries = [AuditEntry(**self._strip(i)) for i in items]
        if limit > 0:
            entries = entries[:limit]
        return entries

    @staticmethod
    def _strip(item: dict) -> dict:
        return {k: v for k, v in item.items() if not k.startswith("_")}
