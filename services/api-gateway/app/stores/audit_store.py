"""Audit log store.

Consolidates governance events that Compliance needs to surface:
decisions made by the guardrail / HITL gate, admin actions
(model toggles, deployment rollbacks, prompt rollbacks), and
workspace lifecycle transitions.

In production this is backed by Log Analytics + Cosmos DB for
long-retention; for demo/dev we keep it in-memory with a seed
history so the Compliance page is immediately meaningful.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, Field


class AuditEntry(BaseModel):
    """A single governance/audit event."""

    id: str = Field(default_factory=lambda: f"au-{uuid.uuid4().hex[:10]}")
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    actor: str = Field(description="Entra/demo user_id of the actor")
    action: str = Field(
        description=(
            "Machine-readable action: 'model.toggle', 'deployment.rollback', "
            "'prompt.rollback', 'workspace.provision', 'guardrail.decision', ..."
        ),
    )
    target: str = Field(description="Target entity identifier — model id, version, workspace id, …")
    subject: str = Field(default="", description="Subject of the action (for guardrail decisions)")
    decision: str = Field(
        default="allow",
        description="'allow' | 'deny' | 'hitl-required' — for guardrail events",
    )
    policy: str = Field(default="", description="Policy identifier triggering the decision")
    rationale: str = Field(default="", description="Free-text rationale supplied by the actor")
    correlation_id: str | None = None


class AuditStore:
    """In-memory audit log with seed + filter support."""

    def __init__(self) -> None:
        self._entries: list[AuditEntry] = []
        self._seed()

    def _seed(self) -> None:
        """Seed a realistic history so Compliance renders immediately."""
        base = [
            {
                "timestamp": "2026-04-15T09:42:10Z",
                "actor": "demo-dave",
                "action": "model.toggle",
                "target": "m-gpt-51",
                "subject": "gpt-5.1",
                "decision": "allow",
                "policy": "model-registry",
                "rationale": "enable reasoning-premium for Legal workspace",
            },
            {
                "timestamp": "2026-04-14T22:11:03Z",
                "actor": "demo-dave",
                "action": "deployment.rollback",
                "target": "v0.1.2",
                "subject": "api-gateway",
                "decision": "allow",
                "policy": "deploy-change-advisory",
                "rationale": "calibration regression detected on answer grounding",
            },
            {
                "timestamp": "2026-04-13T14:05:41Z",
                "actor": "system-guardrail",
                "action": "guardrail.decision",
                "target": "conv-abc123",
                "subject": "prompt-injection-probe",
                "decision": "deny",
                "policy": "prompt-injection-defense-v1",
                "rationale": "matched known-bad pattern",
            },
            {
                "timestamp": "2026-04-12T10:30:00Z",
                "actor": "demo-carol",
                "action": "workspace.provision",
                "target": "ws-ei-juris",
                "subject": "EI Jurisprudence",
                "decision": "allow",
                "policy": "sensitive-boundary",
                "rationale": "approved at change advisory board 2026-04-10",
            },
            {
                "timestamp": "2026-04-11T16:45:22Z",
                "actor": "system-guardrail",
                "action": "guardrail.decision",
                "target": "conv-def456",
                "subject": "cross-classification-query",
                "decision": "hitl-required",
                "policy": "classification-ceiling",
                "rationale": "query attempted to retrieve above workspace ceiling",
            },
        ]
        self._entries = [AuditEntry(**e) for e in base]

    # ---- writer API (routers call these) ----

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
        self._entries.append(entry)
        return entry

    # ---- reader API ----

    def query(
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
        """Return entries matching all filters, newest first, capped by limit."""

        def ok(e: AuditEntry) -> bool:
            if actor and e.actor != actor:
                return False
            if action and e.action != action:
                return False
            if decision and e.decision != decision:
                return False
            if policy and policy.lower() not in e.policy.lower():
                return False
            if start and e.timestamp < start:
                return False
            if end and e.timestamp > end:
                return False
            return True

        filtered = [e for e in self._entries if ok(e)]
        filtered.sort(key=lambda e: e.timestamp, reverse=True)
        if limit > 0:
            filtered = filtered[:limit]
        return filtered
