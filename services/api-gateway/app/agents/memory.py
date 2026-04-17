"""Per-user semantic memory — stores and recalls user context per workspace.

In mock mode: pure in-memory dict with cosine-similarity recall.
In Azure mode: uses Azure AI Search ``eva-memories-index`` for persistent
vector-backed retrieval.
"""

from __future__ import annotations

import logging
import math
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from ..config import settings
from ..stores.compat import aio

logger = logging.getLogger(__name__)


@dataclass
class MemoryEntry:
    """A single stored memory."""

    id: str
    user_id: str
    workspace_id: str
    content: str
    embedding: list[float]
    created_at: str


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


class SemanticMemory:
    """Per-user semantic memory with dual-mode storage.

    Parameters
    ----------
    use_azure : bool | None
        When ``True``, uses Azure AI Search.  When ``False``, uses in-memory.
        Defaults to ``not settings.api_mock``.
    search_endpoint : str | None
        Azure AI Search endpoint (only used in Azure mode).
    search_api_key : str | None
        Azure AI Search API key (only used in Azure mode).
    index_name : str
        Name of the AI Search index for memories.
    """

    def __init__(
        self,
        use_azure: bool | None = None,
        search_endpoint: str | None = None,
        search_api_key: str | None = None,
        index_name: str = "eva-memories-index",
    ) -> None:
        self._use_azure = use_azure if use_azure is not None else (not settings.api_mock)
        self._index_name = index_name

        # In-memory store: dict keyed by (user_id, workspace_id) -> list of entries
        self._store: dict[tuple[str, str], list[MemoryEntry]] = {}

        # Azure AI Search client (lazy init)
        self._search_client = None
        if self._use_azure:
            self._search_endpoint = search_endpoint or settings.azure_search_endpoint
            self._search_api_key = search_api_key or settings.azure_search_api_key

    def _get_search_client(self):
        """Lazily create the Azure AI Search client."""
        if self._search_client is None:
            from azure.core.credentials import AzureKeyCredential
            from azure.search.documents import SearchClient

            self._search_client = SearchClient(
                endpoint=self._search_endpoint,
                index_name=self._index_name,
                credential=AzureKeyCredential(self._search_api_key),
            )
        return self._search_client

    async def store(
        self,
        user_id: str,
        workspace_id: str,
        content: str,
        embedding: list[float],
    ) -> str:
        """Store a memory entry.

        Returns the ID of the created memory.
        """
        entry_id = f"mem-{uuid.uuid4().hex[:12]}"
        now = datetime.now(UTC).isoformat()

        if self._use_azure:
            client = self._get_search_client()
            document = {
                "id": entry_id,
                "user_id": user_id,
                "workspace_id": workspace_id,
                "content": content,
                "embedding": embedding,
                "created_at": now,
            }
            await aio(client.upload_documents(documents=[document]))
            logger.info("SemanticMemory: stored %s in Azure AI Search", entry_id)
        else:
            entry = MemoryEntry(
                id=entry_id,
                user_id=user_id,
                workspace_id=workspace_id,
                content=content,
                embedding=embedding,
                created_at=now,
            )
            key = (user_id, workspace_id)
            self._store.setdefault(key, []).append(entry)
            logger.info("SemanticMemory: stored %s in memory", entry_id)

        return entry_id

    async def recall(
        self,
        user_id: str,
        workspace_id: str,
        query_embedding: list[float],
        top_k: int = 3,
    ) -> list[dict]:
        """Retrieve the most relevant memories for the query.

        Returns a list of dicts with ``id``, ``content``, ``score``,
        ``created_at``.
        """
        if self._use_azure:
            client = self._get_search_client()
            from azure.search.documents.models import VectorizedQuery

            vector_query = VectorizedQuery(
                vector=query_embedding,
                k_nearest_neighbors=top_k,
                fields="embedding",
            )
            results = await aio(
                client.search(
                    search_text=None,
                    vector_queries=[vector_query],
                    filter=f"user_id eq '{user_id}' and workspace_id eq '{workspace_id}'",
                    top=top_k,
                )
            )
            return [
                {
                    "id": r["id"],
                    "content": r["content"],
                    "score": r.get("@search.score", 0.0),
                    "created_at": r.get("created_at", ""),
                }
                for r in results
            ]

        # In-memory: cosine similarity search
        key = (user_id, workspace_id)
        entries = self._store.get(key, [])
        if not entries:
            return []

        scored = [
            (entry, _cosine_similarity(entry.embedding, query_embedding))
            for entry in entries
        ]
        scored.sort(key=lambda x: x[1], reverse=True)

        return [
            {
                "id": entry.id,
                "content": entry.content,
                "score": round(score, 4),
                "created_at": entry.created_at,
            }
            for entry, score in scored[:top_k]
        ]

    async def clear(self, user_id: str, workspace_id: str) -> int:
        """Delete all memories for a user in a workspace.

        Returns the number of memories deleted.
        """
        if self._use_azure:
            client = self._get_search_client()
            # Retrieve all memory IDs for this user+workspace, then delete
            results = await aio(
                client.search(
                    search_text="*",
                    filter=f"user_id eq '{user_id}' and workspace_id eq '{workspace_id}'",
                    select=["id"],
                    top=1000,
                )
            )
            docs_to_delete = [{"id": r["id"]} for r in results]
            if docs_to_delete:
                await aio(client.delete_documents(documents=docs_to_delete))
            logger.info(
                "SemanticMemory: cleared %d memories from Azure for user=%s ws=%s",
                len(docs_to_delete), user_id, workspace_id,
            )
            return len(docs_to_delete)

        # In-memory
        key = (user_id, workspace_id)
        count = len(self._store.pop(key, []))
        logger.info(
            "SemanticMemory: cleared %d memories from memory for user=%s ws=%s",
            count, user_id, workspace_id,
        )
        return count
