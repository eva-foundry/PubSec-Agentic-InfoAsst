"""Shared Cosmos DB client manager.

Provides a singleton-style manager that lazily connects to Cosmos DB
and caches container proxies.  All Azure-backed stores use this to
avoid creating multiple CosmosClient instances.
"""

from __future__ import annotations

import logging
from typing import Any, cast

from azure.cosmos import PartitionKey
from azure.cosmos.aio import ContainerProxy, CosmosClient, DatabaseProxy

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Container definitions — database / container / partition key
# ---------------------------------------------------------------------------

CONTAINER_DEFS: dict[str, dict[str, str]] = {
    # eva-workspaces database
    "workspaces": {"database": "eva-workspaces", "partition_key": "/id"},
    "bookings": {"database": "eva-workspaces", "partition_key": "/workspace_id"},
    "teams": {"database": "eva-workspaces", "partition_key": "/booking_id"},
    "surveys-entry": {"database": "eva-workspaces", "partition_key": "/booking_id"},
    "surveys-exit": {"database": "eva-workspaces", "partition_key": "/booking_id"},
    "clients": {"database": "eva-workspaces", "partition_key": "/id"},
    "interviews": {"database": "eva-workspaces", "partition_key": "/client_id"},
    # eva-platform database
    "prompt-versions": {"database": "eva-platform", "partition_key": "/prompt_name"},
    "model-registry": {"database": "eva-platform", "partition_key": "/id"},
    "feedback": {"database": "eva-platform", "partition_key": "/workspace_id"},
    "demo-users": {"database": "eva-platform", "partition_key": "/email"},
    "telemetry": {"database": "eva-platform", "partition_key": "/workspace_id"},
    # statusdb database
    "documents": {"database": "statusdb", "partition_key": "/workspace_id"},
    "chat-history": {"database": "statusdb", "partition_key": "/user_id"},
    # governance — platform-wide (no tenant partition)
    "deployments": {"database": "eva-platform", "partition_key": "/version"},
    "audit": {"database": "eva-platform", "partition_key": "/actor"},
    "archetypes": {"database": "eva-platform", "partition_key": "/key"},
    "eval-runs": {"database": "eva-platform", "partition_key": "/run_id"},
}


class CosmosClientManager:
    """Manages a single CosmosClient and provides container references.

    Usage::

        mgr = CosmosClientManager(endpoint, key)
        await mgr.initialize()          # ensures databases + containers exist
        container = mgr.container("workspaces")
        items = [item async for item in container.query_items(...)]
        await mgr.close()
    """

    def __init__(self, endpoint: str, key: str) -> None:
        self._client = CosmosClient(endpoint, credential=key)
        self._containers: dict[str, ContainerProxy] = {}
        self._databases: dict[str, DatabaseProxy] = {}

    async def initialize(self) -> None:
        """Ensure all databases and containers exist (idempotent)."""
        # Collect unique databases
        db_names = {d["database"] for d in CONTAINER_DEFS.values()}

        for db_name in db_names:
            db = await self._client.create_database_if_not_exists(db_name)
            self._databases[db_name] = db
            logger.info("Cosmos DB database ready: %s", db_name)

        # Create containers
        for container_name, definition in CONTAINER_DEFS.items():
            db = self._databases[definition["database"]]
            pk = PartitionKey(path=definition["partition_key"])
            container = await db.create_container_if_not_exists(
                id=container_name,
                partition_key=pk,
            )
            self._containers[container_name] = container
            logger.info("Cosmos container ready: %s/%s", definition["database"], container_name)

    def container(self, name: str) -> ContainerProxy:
        """Get a container proxy by logical name."""
        if name not in self._containers:
            raise RuntimeError(f"Container '{name}' not initialized. Call initialize() first.")
        return self._containers[name]

    async def close(self) -> None:
        """Close the underlying CosmosClient."""
        await self._client.close()

    # ------------------------------------------------------------------
    # Convenience helpers for common operations
    # ------------------------------------------------------------------

    async def upsert(self, container_name: str, item: dict) -> dict:
        """Upsert an item into a container."""
        c = self.container(container_name)
        return await c.upsert_item(item)

    async def read(self, container_name: str, item_id: str, partition_key: Any) -> dict | None:
        """Read a single item. Returns None if not found."""
        c = self.container(container_name)
        try:
            return await c.read_item(item_id, partition_key=partition_key)
        except Exception:
            return None

    async def delete(self, container_name: str, item_id: str, partition_key: Any) -> bool:
        """Delete an item. Returns True if deleted, False if not found."""
        c = self.container(container_name)
        try:
            await c.delete_item(item_id, partition_key=partition_key)
            return True
        except Exception:
            return False

    async def query(
        self,
        container_name: str,
        query: str,
        parameters: list[dict] | None = None,
        partition_key: Any = None,
    ) -> list[dict]:
        """Run a SQL query and return all matching items."""
        c = self.container(container_name)
        kwargs: dict[str, Any] = {"query": query}
        if parameters:
            kwargs["parameters"] = parameters
        if partition_key is not None:
            kwargs["partition_key"] = partition_key
        items: list[dict] = []
        async for item in c.query_items(**kwargs):
            items.append(item)
        return items

    async def query_all(self, container_name: str) -> list[dict]:
        """Read all items in a container (cross-partition)."""
        return await self.query(container_name, "SELECT * FROM c")

    async def count(self, container_name: str) -> int:
        """Count items in a container."""
        # SELECT VALUE COUNT(1) returns a list with a single scalar int,
        # not the dict-shape that self.query() declares. Cast to satisfy typing.
        result = cast(list[int], await self.query(container_name, "SELECT VALUE COUNT(1) FROM c"))
        return result[0] if result else 0
