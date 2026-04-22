"""Cosmos DB-backed team member store."""

from __future__ import annotations

from ...models.workspace import TeamMember
from .cosmos_client import CosmosClientManager

CONTAINER = "teams"


def _strip(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


class CosmosTeamStore:
    """Team store backed by Cosmos DB (eva-workspaces/teams)."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def list_by_booking(self, booking_id: str) -> list[TeamMember]:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.booking_id = @bid",
            parameters=[{"name": "@bid", "value": booking_id}],
            partition_key=booking_id,
        )
        return [TeamMember(**_strip(i)) for i in items]

    async def add(self, booking_id: str, member: TeamMember) -> TeamMember:
        data = member.model_dump()
        data["booking_id"] = booking_id
        await self._cosmos.upsert(CONTAINER, data)
        return member

    async def get(self, booking_id: str, user_id: str) -> TeamMember | None:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.booking_id = @bid AND c.user_id = @uid",
            parameters=[
                {"name": "@bid", "value": booking_id},
                {"name": "@uid", "value": user_id},
            ],
            partition_key=booking_id,
        )
        return TeamMember(**_strip(items[0])) if items else None

    async def update_role(self, booking_id: str, user_id: str, role: str) -> TeamMember | None:
        member = await self.get(booking_id, user_id)
        if member is None:
            return None
        data = member.model_dump()
        data["role"] = role
        data["booking_id"] = booking_id
        await self._cosmos.upsert(CONTAINER, data)
        return TeamMember(**{k: v for k, v in data.items() if k != "booking_id"})

    async def remove(self, booking_id: str, user_id: str) -> bool:
        member = await self.get(booking_id, user_id)
        if member is None:
            return False
        return await self._cosmos.delete(CONTAINER, member.id, partition_key=booking_id)

    async def is_admin(self, booking_id: str, user_id: str) -> bool:
        member = await self.get(booking_id, user_id)
        return member is not None and member.role == "admin"
