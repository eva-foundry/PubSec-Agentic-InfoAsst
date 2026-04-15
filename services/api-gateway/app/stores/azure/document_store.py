"""Cosmos DB-backed document processing record store."""

from __future__ import annotations

from ...pipeline.document_store import DocumentRecord
from .cosmos_client import CosmosClientManager

CONTAINER = "documents"


def _strip(item: dict) -> dict:
    return {k: v for k, v in item.items() if not k.startswith("_")}


class CosmosDocumentStore:
    """Document record store backed by Cosmos DB (statusdb/documents)."""

    def __init__(self, cosmos: CosmosClientManager) -> None:
        self._cosmos = cosmos

    async def add(self, doc: DocumentRecord) -> None:
        await self._cosmos.upsert(CONTAINER, doc.model_dump())

    async def get(self, doc_id: str) -> DocumentRecord | None:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.id = @id",
            parameters=[{"name": "@id", "value": doc_id}],
        )
        return DocumentRecord(**_strip(items[0])) if items else None

    async def list_by_workspace(self, workspace_id: str) -> list[DocumentRecord]:
        items = await self._cosmos.query(
            CONTAINER,
            "SELECT * FROM c WHERE c.workspace_id = @wsid",
            parameters=[{"name": "@wsid", "value": workspace_id}],
            partition_key=workspace_id,
        )
        return [DocumentRecord(**_strip(i)) for i in items]

    async def update_status(self, doc_id: str, status: str, **kwargs) -> None:
        doc = await self.get(doc_id)
        if doc is None:
            return
        data = doc.model_dump()
        data["status"] = status
        data.update(kwargs)
        await self._cosmos.upsert(CONTAINER, data)

    async def list_all(self) -> list[DocumentRecord]:
        """List all documents across all workspaces."""
        items = await self._cosmos.query_all(CONTAINER)
        return [DocumentRecord(**_strip(i)) for i in items]

    async def delete(self, doc_id: str) -> bool:
        doc = await self.get(doc_id)
        if doc is None:
            return False
        return await self._cosmos.delete(CONTAINER, doc_id, partition_key=doc.workspace_id)
