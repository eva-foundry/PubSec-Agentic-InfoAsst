"""Cosmos DB-backed workspace store."""

from __future__ import annotations

from ...models.workspace import Workspace
from .cosmos_client import CosmosClientManager

CONTAINER = "workspaces"


class CosmosWorkspaceStore:
    """Workspace store backed by Cosmos DB (eva-workspaces/workspaces)."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def list(self, workspace_grants: list[str]) -> list[Workspace]:
        if "all" in workspace_grants:
            items = await self._cosmos.query_all(CONTAINER)
        else:
            placeholders = ", ".join(f"@g{i}" for i in range(len(workspace_grants)))
            params = [{"name": f"@g{i}", "value": g} for i, g in enumerate(workspace_grants)]
            items = await self._cosmos.query(
                CONTAINER,
                f"SELECT * FROM c WHERE c.id IN ({placeholders})",
                parameters=params,
            )
        return [Workspace(**self._strip(item)) for item in items]

    async def get(self, workspace_id: str) -> Workspace | None:
        item = await self._cosmos.read(CONTAINER, workspace_id, partition_key=workspace_id)
        return Workspace(**self._strip(item)) if item else None

    async def create(self, workspace: Workspace) -> Workspace:
        await self._cosmos.upsert(CONTAINER, workspace.model_dump())
        return workspace

    async def update(self, workspace_id: str, updates: dict) -> Workspace | None:
        existing = await self.get(workspace_id)
        if existing is None:
            return None
        data = existing.model_dump()
        data.update(updates)
        await self._cosmos.upsert(CONTAINER, data)
        return Workspace(**data)

    @staticmethod
    def _strip(item: dict) -> dict:
        """Remove Cosmos system properties before Pydantic parsing."""
        return {k: v for k, v in item.items() if not k.startswith("_")}
