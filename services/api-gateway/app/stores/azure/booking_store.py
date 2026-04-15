"""Cosmos DB-backed booking store."""

from __future__ import annotations

from ...models.workspace import Booking
from .cosmos_client import CosmosClientManager

CONTAINER = "bookings"


def _strip(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


class CosmosBookingStore:
    """Booking store backed by Cosmos DB (eva-workspaces/bookings)."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def create(self, booking: Booking) -> Booking:
        await self._cosmos.upsert(CONTAINER, booking.model_dump())
        return booking

    async def list_by_user(self, user_id: str) -> list[Booking]:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.requester_id = @uid",
            parameters=[{"name": "@uid", "value": user_id}],
        )
        return [Booking(**_strip(i)) for i in items]

    async def list_by_workspace(self, workspace_id: str) -> list[Booking]:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.workspace_id = @wsid",
            parameters=[{"name": "@wsid", "value": workspace_id}],
            partition_key=workspace_id,
        )
        return [Booking(**_strip(i)) for i in items]

    async def list_all(self) -> list[Booking]:
        items = await self._cosmos.query_all(CONTAINER)
        return [Booking(**_strip(i)) for i in items]

    async def get(self, booking_id: str) -> Booking | None:
        # booking partition key is workspace_id — need cross-partition lookup by id
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.id = @id",
            parameters=[{"name": "@id", "value": booking_id}],
        )
        return Booking(**_strip(items[0])) if items else None

    async def update(self, booking_id: str, updates: dict) -> Booking | None:
        existing = await self.get(booking_id)
        if existing is None:
            return None
        data = existing.model_dump()
        data.update(updates)
        await self._cosmos.upsert(CONTAINER, data)
        return Booking(**data)

    async def delete(self, booking_id: str) -> bool:
        existing = await self.get(booking_id)
        if existing is None:
            return False
        return await self._cosmos.delete(CONTAINER, booking_id, partition_key=existing.workspace_id)
