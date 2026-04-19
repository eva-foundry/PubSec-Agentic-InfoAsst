"""Cosmos DB-backed archetype catalog.

Archetypes are platform-wide template metadata. Seeded at startup if the
container is empty; ops can then upsert new archetypes without a UI release.
"""

from __future__ import annotations

from ...models.archetype import ArchetypeDefinition
from .cosmos_client import CosmosClientManager

CONTAINER = "archetypes"


class CosmosArchetypeStore:
    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def list(self) -> list[ArchetypeDefinition]:
        items = await self._cosmos.query_all(CONTAINER)
        return [ArchetypeDefinition(**self._strip(i)) for i in items]

    async def get(self, key: str) -> ArchetypeDefinition | None:
        item = await self._cosmos.read(CONTAINER, key, partition_key=key)
        return ArchetypeDefinition(**self._strip(item)) if item else None

    async def upsert(self, archetype: ArchetypeDefinition) -> ArchetypeDefinition:
        await self._cosmos.upsert(CONTAINER, archetype.model_dump())
        return archetype

    @staticmethod
    def _strip(item: dict) -> dict:
        return {k: v for k, v in item.items() if not k.startswith("_")}
