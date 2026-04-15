"""Cosmos DB-backed client and interview store."""

from __future__ import annotations

from ...models.admin import Client, Interview
from .cosmos_client import CosmosClientManager

CLIENT_CONTAINER = "clients"
INTERVIEW_CONTAINER = "interviews"


def _strip(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


class CosmosClientStore:
    """Client + interview store backed by Cosmos DB."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    # -- Client CRUD --

    async def create_client(self, client: Client) -> Client:
        await self._cosmos.upsert(CLIENT_CONTAINER, client.model_dump())
        return client

    async def list_clients(self) -> list[Client]:
        items = await self._cosmos.query_all(CLIENT_CONTAINER)
        return [Client(**_strip(i)) for i in items]

    async def get_client(self, client_id: str) -> Client | None:
        item = await self._cosmos.read(CLIENT_CONTAINER, client_id, partition_key=client_id)
        return Client(**_strip(item)) if item else None

    async def update_client(self, client_id: str, updates: dict) -> Client | None:
        existing = await self.get_client(client_id)
        if existing is None:
            return None
        data = existing.model_dump()
        data.update(updates)
        await self._cosmos.upsert(CLIENT_CONTAINER, data)
        return Client(**data)

    # -- Interview CRUD --

    async def create_interview(self, interview: Interview) -> Interview:
        await self._cosmos.upsert(INTERVIEW_CONTAINER, interview.model_dump())
        return interview

    async def get_interviews_by_client(self, client_id: str) -> list[Interview]:
        items = await self._cosmos.query(
            INTERVIEW_CONTAINER,
            "SELECT * FROM c WHERE c.client_id = @cid",
            parameters=[{"name": "@cid", "value": client_id}],
            partition_key=client_id,
        )
        return [Interview(**_strip(i)) for i in items]

    async def get_interview(self, interview_id: str) -> Interview | None:
        items = await self._cosmos.query(
            INTERVIEW_CONTAINER,
            "SELECT * FROM c WHERE c.id = @id",
            parameters=[{"name": "@id", "value": interview_id}],
        )
        return Interview(**_strip(items[0])) if items else None
