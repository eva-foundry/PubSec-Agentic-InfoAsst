"""Cosmos DB-backed prompt versioning store."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from ...models.admin import PromptVersion
from .cosmos_client import CosmosClientManager

CONTAINER = "prompt-versions"


def _strip(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


class CosmosPromptStore:
    """Prompt versioning store backed by Cosmos DB (eva-platform/prompt-versions)."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def list_prompts(self) -> list[dict]:
        items = await self._cosmos.query_all(CONTAINER)
        # Group by prompt_name
        grouped: dict[str, list[PromptVersion]] = {}
        for item in items:
            pv = PromptVersion(**_strip(item))
            grouped.setdefault(pv.prompt_name, []).append(pv)

        result = []
        for name, versions in grouped.items():
            active = next((v for v in versions if v.is_active), None)
            latest = max(versions, key=lambda v: v.version)
            result.append(
                {
                    "prompt_name": name,
                    "latest_version": latest.version,
                    "active_version": active.version if active else None,
                    "total_versions": len(versions),
                }
            )
        return result

    async def get_versions(self, prompt_name: str) -> list[PromptVersion]:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.prompt_name = @name",
            parameters=[{"name": "@name", "value": prompt_name}],
            partition_key=prompt_name,
        )
        return [PromptVersion(**_strip(i)) for i in items]

    async def get_active(self, prompt_name: str) -> PromptVersion | None:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.prompt_name = @name AND c.is_active = true",
            parameters=[{"name": "@name", "value": prompt_name}],
            partition_key=prompt_name,
        )
        return PromptVersion(**_strip(items[0])) if items else None

    async def create_version(
        self, prompt_name: str, content: str, author: str, rationale: str
    ) -> PromptVersion:
        # Deactivate existing
        existing = await self.get_versions(prompt_name)
        for pv in existing:
            if pv.is_active:
                data = pv.model_dump()
                data["is_active"] = False
                await self._cosmos.upsert(CONTAINER, data)

        next_version = max((pv.version for pv in existing), default=0) + 1
        new_pv = PromptVersion(
            id=str(uuid.uuid4()),
            prompt_name=prompt_name,
            version=next_version,
            content=content,
            author=author,
            rationale=rationale,
            created_at=datetime.now(UTC).isoformat(),
            is_active=True,
        )
        await self._cosmos.upsert(CONTAINER, new_pv.model_dump())
        return new_pv

    async def rollback(self, prompt_name: str, version: int) -> PromptVersion | None:
        versions = await self.get_versions(prompt_name)
        if not versions:
            return None

        target = None
        for pv in versions:
            data = pv.model_dump()
            if pv.version == version:
                data["is_active"] = True
                target = PromptVersion(**data)
            else:
                data["is_active"] = False
            await self._cosmos.upsert(CONTAINER, data)
        return target
