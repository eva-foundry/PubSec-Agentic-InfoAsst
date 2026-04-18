"""Deployment history + rollback store.

Tracks the chronological list of platform deployments. The oldest `active`
record (one at a time) represents the currently-serving build; rollback
marks that one `rolled-back` and promotes the target version to `active`
with a rationale appended to its notes.

In production this would be backed by a table in the platform control
plane; for demo/dev we keep it in-memory with deterministic seed data.
"""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, Field


class DeploymentRecord(BaseModel):
    """A single platform deployment, as surfaced by /ops/deployments."""

    version: str
    deployed_at: str = Field(description="ISO timestamp")
    deployed_by: str
    status: str = Field(
        default="pending",
        description="'pending', 'active', 'rolled-back', 'failed'",
    )
    notes: str = ""


class DeploymentStore:
    """In-memory deployment history with rollback semantics."""

    def __init__(self) -> None:
        self._records: list[DeploymentRecord] = []
        self._seed()

    def _seed(self) -> None:
        self._records = [
            DeploymentRecord(
                version="v0.1.3",
                deployed_at="2026-04-16T11:48:00Z",
                deployed_by="ci-pipeline",
                status="active",
                notes="cache shedding under p99>600ms",
            ),
            DeploymentRecord(
                version="v0.1.2",
                deployed_at="2026-04-12T08:00:00Z",
                deployed_by="ci-pipeline",
                status="rolled-back",
                notes="reranker timeout bump",
            ),
            DeploymentRecord(
                version="v0.1.1",
                deployed_at="2026-04-09T09:32:00Z",
                deployed_by="ci-pipeline",
                status="rolled-back",
                notes="initial v0.1 cut",
            ),
        ]

    def list_all(self) -> list[DeploymentRecord]:
        return list(self._records)

    def get(self, version: str) -> DeploymentRecord | None:
        return next((r for r in self._records if r.version == version), None)

    def active(self) -> DeploymentRecord | None:
        return next((r for r in self._records if r.status == "active"), None)

    def rollback(self, target_version: str, actor: str, rationale: str) -> DeploymentRecord:
        """Promote `target_version` to active; mark the current active as rolled-back.

        Raises:
            ValueError: target doesn't exist, target is the current active, or
                target was previously marked failed.
        """
        target = self.get(target_version)
        if target is None:
            raise ValueError(f"unknown version: {target_version}")
        if target.status == "failed":
            raise ValueError(f"cannot roll back to failed build {target_version}")

        current = self.active()
        if current and current.version == target_version:
            raise ValueError(f"{target_version} is already active")

        now = datetime.now(UTC).isoformat()
        if current is not None:
            current.status = "rolled-back"
            suffix = f"rolled back to {target_version} by {actor} at {now}: {rationale}"
            current.notes = f"{current.notes}; {suffix}" if current.notes else suffix

        target.status = "active"
        rollback_note = f"promoted by rollback from {current.version if current else 'none'} " \
                        f"by {actor} at {now}: {rationale}"
        target.notes = f"{target.notes}; {rollback_note}" if target.notes else rollback_note
        return target
