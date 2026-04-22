"""Cosmos DB-backed survey store."""

from __future__ import annotations

from ...models.workspace import EntrySurvey, ExitSurvey
from .cosmos_client import CosmosClientManager

ENTRY_CONTAINER = "surveys-entry"
EXIT_CONTAINER = "surveys-exit"


def _strip(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


class CosmosSurveyStore:
    """Survey store backed by Cosmos DB (eva-workspaces/surveys-entry, surveys-exit)."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def create_entry(self, survey: EntrySurvey) -> EntrySurvey:
        await self._cosmos.upsert(ENTRY_CONTAINER, survey.model_dump())
        return survey

    async def create_exit(self, survey: ExitSurvey) -> ExitSurvey:
        await self._cosmos.upsert(EXIT_CONTAINER, survey.model_dump())
        return survey

    async def get_entry_by_booking(self, booking_id: str) -> EntrySurvey | None:
        items = await self._cosmos.query(
            ENTRY_CONTAINER,
            "SELECT * FROM c WHERE c.booking_id = @bid",
            parameters=[{"name": "@bid", "value": booking_id}],
            partition_key=booking_id,
        )
        return EntrySurvey(**_strip(items[0])) if items else None

    async def get_exit_by_booking(self, booking_id: str) -> ExitSurvey | None:
        items = await self._cosmos.query(
            EXIT_CONTAINER,
            "SELECT * FROM c WHERE c.booking_id = @bid",
            parameters=[{"name": "@bid", "value": booking_id}],
            partition_key=booking_id,
        )
        return ExitSurvey(**_strip(items[0])) if items else None
