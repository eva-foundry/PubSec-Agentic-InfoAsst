"""Search tool — vector search over workspace documents.

Uses the in-memory VectorStore locally or Azure AI Search in production.
The ``aio()`` wrapper handles both sync and async store backends.
"""

from __future__ import annotations

import logging
import time

from ..stores.compat import aio
from ..stores.vector_store import VectorStore
from .registry import Tool, ToolMetadata

logger = logging.getLogger(__name__)


class SearchTool(Tool):
    """Vector search over workspace documents."""

    metadata = ToolMetadata(
        name="search",
        description="Vector search over workspace documents",
        classification_ceiling="protected_b",
        data_residency="canada_central",
        bilingual=True,
        hitl_required=False,
    )

    def __init__(self, vector_store: VectorStore | None = None, embedding_client=None) -> None:
        self._vector_store = vector_store
        self._embedding_client = embedding_client

    async def execute(self, **kwargs) -> dict:
        """Search for documents matching the query.

        Parameters
        ----------
        query : str
            The user's search query.
        workspace_id : str
            The workspace to search within.
        top_k : int
            Maximum number of results to return (default 5).

        Returns
        -------
        dict
            ``results`` list and ``duration_ms``.
        """
        query: str = kwargs["query"]
        workspace_id: str = kwargs.get("workspace_id", "default")
        top_k: int = kwargs.get("top_k", 5)

        start = time.monotonic()

        results: list[dict] = []

        if self._vector_store and self._embedding_client:
            # Embed the query
            query_embeddings = await self._embedding_client.embed([query])
            query_embedding = query_embeddings[0]

            # Search the vector store (sync for in-memory, async for Azure AI Search)
            results = await aio(self._vector_store.search(
                workspace_id=workspace_id,
                query_embedding=query_embedding,
                top_k=top_k,
            ))

            logger.info(
                "Vector search: query=%r workspace=%s results=%d",
                query[:80], workspace_id, len(results),
            )

        duration_ms = int((time.monotonic() - start) * 1000)

        return {
            "results": results,
            "duration_ms": duration_ms,
            "query_used": query,
            "workspace_id": workspace_id,
        }
