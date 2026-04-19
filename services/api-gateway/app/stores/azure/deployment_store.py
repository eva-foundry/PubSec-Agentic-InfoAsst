"""Cosmos DB-backed deployment history store.

Mirrors ``stores.deployment_store.DeploymentStore``. Used when
``EVA_API_MOCK=false`` so rollback history is durable across restarts.
"""

from __future__ import annotations

from datetime import UTC, datetime

from ..deployment_store import DeploymentRecord
from .cosmos_client import CosmosClientManager

CONTAINER = "deployments"


class CosmosDeploymentStore:
    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def list_all(self) -> list[DeploymentRecord]:
        items = await self._cosmos.query_all(CONTAINER)
        records = [DeploymentRecord(**self._strip(i)) for i in items]
        records.sort(key=lambda r: r.deployed_at, reverse=True)
        return records

    async def get(self, version: str) -> DeploymentRecord | None:
        item = await self._cosmos.read(CONTAINER, version, partition_key=version)
        return DeploymentRecord(**self._strip(item)) if item else None

    async def active(self) -> DeploymentRecord | None:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.status = 'active'",
        )
        return DeploymentRecord(**self._strip(items[0])) if items else None

    async def rollback(
        self, target_version: str, actor: str, rationale: str
    ) -> DeploymentRecord:
        target = await self.get(target_version)
        if target is None:
            raise ValueError(f"unknown version: {target_version}")
        if target.status == "failed":
            raise ValueError(f"cannot roll back to failed build {target_version}")

        current = await self.active()
        if current and current.version == target_version:
            raise ValueError(f"{target_version} is already active")

        now = datetime.now(UTC).isoformat()

        if current is not None:
            current.status = "rolled-back"
            suffix = (
                f"rolled back to {target_version} by {actor} at {now}: {rationale}"
            )
            current.notes = (
                f"{current.notes}; {suffix}" if current.notes else suffix
            )
            await self._cosmos.upsert(CONTAINER, current.model_dump())

        target.status = "active"
        rollback_note = (
            f"promoted by rollback from {current.version if current else 'none'} "
            f"by {actor} at {now}: {rationale}"
        )
        target.notes = (
            f"{target.notes}; {rollback_note}" if target.notes else rollback_note
        )
        await self._cosmos.upsert(CONTAINER, target.model_dump())
        return target

    async def upsert(self, record: DeploymentRecord) -> DeploymentRecord:
        """Used by seed bootstrap."""
        await self._cosmos.upsert(CONTAINER, record.model_dump())
        return record

    @staticmethod
    def _strip(item: dict) -> dict:
        return {k: v for k, v in item.items() if not k.startswith("_")}
