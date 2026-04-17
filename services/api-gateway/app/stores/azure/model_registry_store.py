"""Cosmos DB-backed model registry store with versioned audit trail."""

from __future__ import annotations

from datetime import UTC, datetime

from ...models.admin import ModelConfig
from .cosmos_client import CosmosClientManager

CONTAINER = "model-registry"


def _strip(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


class CosmosModelRegistryStore:
    """Model registry backed by Cosmos DB (eva-platform/model-registry)."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def list_models(self) -> list[ModelConfig]:
        items = await self._cosmos.query_all(CONTAINER)
        return [ModelConfig(**_strip(i)) for i in items]

    async def get_model(self, model_id: str) -> ModelConfig | None:
        item = await self._cosmos.read(CONTAINER, model_id, partition_key=model_id)
        return ModelConfig(**_strip(item)) if item else None

    async def update_model(
        self,
        model_id: str,
        updates: dict,
        author: str = "system",
        rationale: str = "",
    ) -> ModelConfig | None:
        existing = await self.get_model(model_id)
        if existing is None:
            return None

        data = existing.model_dump()
        history = list(data.get("change_history", []))
        version = len(history) + 1
        now = datetime.now(UTC).isoformat()

        for field, new_value in updates.items():
            if field == "change_history":
                continue
            old_value = data.get(field)
            if old_value != new_value:
                history.append(
                    {
                        "version": version,
                        "action": "update",
                        "field": field,
                        "old_value": old_value,
                        "new_value": new_value,
                        "author": author,
                        "rationale": rationale,
                        "timestamp": now,
                    }
                )

        data.update(updates)
        data["change_history"] = history
        await self._cosmos.upsert(CONTAINER, data)
        return ModelConfig(**data)

    async def toggle_model(
        self,
        model_id: str,
        is_active: bool,
        author: str = "system",
        rationale: str = "",
    ) -> ModelConfig | None:
        action = "enabled" if is_active else "disabled"
        return await self.update_model(
            model_id,
            {"is_active": is_active},
            author=author,
            rationale=rationale or f"Model {action} by {author}",
        )

    async def get_change_history(self, model_id: str) -> list[dict]:
        m = await self.get_model(model_id)
        return m.change_history if m else []
