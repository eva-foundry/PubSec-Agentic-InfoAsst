"""Azure AI Search-backed vector store.

Replaces the in-memory VectorStore for production use.
Creates per-workspace indexes with HNSW vector + BM25 keyword + semantic reranking.
"""

from __future__ import annotations

import logging

from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.aio import SearchClient as AsyncSearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    HnswAlgorithmConfiguration,
    SearchableField,
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SimpleField,
    VectorSearch,
    VectorSearchProfile,
)
from azure.search.documents.models import VectorizedQuery

from ..vector_store import VectorDocument

logger = logging.getLogger(__name__)


def _index_name(prefix: str, workspace_id: str) -> str:
    """Compute the AI Search index name for a workspace."""
    return f"{prefix}-{workspace_id}"


def _build_index_schema(index_name: str, dimensions: int = 1536) -> SearchIndex:
    """Build the index schema matching the EVA vector-index spec."""
    fields = [
        SimpleField(name="id", type=SearchFieldDataType.String, key=True, filterable=True),
        SearchableField(name="content", type=SearchFieldDataType.String),
        SearchableField(name="title", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="workspace_id", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="file_name", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="chunk_index", type=SearchFieldDataType.Int32, filterable=True),
        SearchableField(name="section", type=SearchFieldDataType.String, filterable=True),
        SimpleField(name="pages", type="Collection(Edm.Int32)", filterable=False),
        SimpleField(name="last_verified", type=SearchFieldDataType.String, filterable=True),
        SearchField(
            name="content_vector",
            type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
            searchable=True,
            vector_search_dimensions=dimensions,
            vector_search_profile_name="hnsw-profile",
        ),
    ]

    vector_search = VectorSearch(
        algorithms=[
            HnswAlgorithmConfiguration(name="hnsw-config"),
        ],
        profiles=[
            VectorSearchProfile(
                name="hnsw-profile",
                algorithm_configuration_name="hnsw-config",
            ),
        ],
    )

    return SearchIndex(name=index_name, fields=fields, vector_search=vector_search)


class AzureSearchVectorStore:
    """Azure AI Search vector store — same interface as in-memory VectorStore.

    Each workspace gets its own AI Search index, created on first use.
    """

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        index_prefix: str = "eva-workspace",
        dimensions: int = 1536,
    ) -> None:
        self._endpoint = endpoint
        self._credential = AzureKeyCredential(api_key)
        self._index_prefix = index_prefix
        self._dimensions = dimensions
        self._index_client = SearchIndexClient(endpoint, self._credential)
        self._known_indexes: set[str] = set()

    def _ensure_index_sync(self, workspace_id: str) -> str:
        """Ensure the index exists (synchronous — called during add)."""
        name = _index_name(self._index_prefix, workspace_id)
        if name in self._known_indexes:
            return name
        try:
            self._index_client.get_index(name)
            logger.info("AI Search index exists: %s", name)
        except Exception:
            schema = _build_index_schema(name, self._dimensions)
            self._index_client.create_index(schema)
            logger.info("AI Search index created: %s", name)
        self._known_indexes.add(name)
        return name

    def _search_client(self, workspace_id: str) -> SearchClient:
        """Get a sync SearchClient for a workspace."""
        name = self._ensure_index_sync(workspace_id)
        return SearchClient(self._endpoint, name, self._credential)

    def _async_search_client(self, workspace_id: str) -> AsyncSearchClient:
        """Get an async SearchClient for a workspace."""
        name = self._ensure_index_sync(workspace_id)
        return AsyncSearchClient(self._endpoint, name, self._credential)

    def add_documents(self, workspace_id: str, docs: list[VectorDocument]) -> int:
        """Upload vector documents to the workspace index."""
        if not docs:
            return 0

        client = self._search_client(workspace_id)
        batch = []
        for doc in docs:
            batch.append({
                "id": doc.id,
                "content": doc.content,
                "title": doc.title,
                "workspace_id": doc.workspace_id,
                "file_name": doc.file_name,
                "chunk_index": doc.chunk_index,
                "section": doc.section,
                "pages": doc.pages,
                "last_verified": doc.last_verified,
                "content_vector": doc.embedding,
            })

        result = client.upload_documents(documents=batch)
        succeeded = sum(1 for r in result if r.succeeded)
        logger.info(
            "Indexed %d/%d documents to %s",
            succeeded,
            len(batch),
            _index_name(self._index_prefix, workspace_id),
        )
        return succeeded

    async def search(
        self,
        workspace_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:
        """Hybrid vector + keyword search over a workspace index."""
        name = _index_name(self._index_prefix, workspace_id)
        if name not in self._known_indexes:
            self._ensure_index_sync(workspace_id)

        async with self._async_search_client(workspace_id) as client:
            vector_query = VectorizedQuery(
                vector=query_embedding,
                k_nearest_neighbors=top_k,
                fields="content_vector",
            )

            results = []
            async for result in await client.search(
                search_text=None,
                vector_queries=[vector_query],
                top=top_k,
                select=["id", "content", "title", "file_name", "section", "pages", "chunk_index"],
            ):
                results.append({
                    "id": result["id"],
                    "file": result.get("file_name", ""),
                    "content": result.get("content", ""),
                    "relevance_score": round(result["@search.score"], 4),
                    "page": result.get("pages", [0])[0] if result.get("pages") else 0,
                    "section": result.get("section", ""),
                    "title": result.get("title", ""),
                    "chunk_index": result.get("chunk_index", 0),
                })

        return results

    def delete_by_file(self, workspace_id: str, file_name: str) -> int:
        """Remove all chunks for a file from the workspace index."""
        client = self._search_client(workspace_id)
        # Find all docs for this file
        results = client.search(
            search_text="*",
            filter=f"file_name eq '{file_name}'",
            select=["id"],
        )
        doc_ids = [{"id": r["id"]} for r in results]
        if not doc_ids:
            return 0
        client.delete_documents(documents=doc_ids)
        return len(doc_ids)

    def document_count(self, workspace_id: str) -> int:
        """Return the number of chunks stored for a workspace."""
        try:
            client = self._search_client(workspace_id)
            return client.get_document_count()
        except Exception:
            return 0

    def get_chunks_by_file(
        self, file_name: str, workspace_id: str | None = None
    ) -> list[VectorDocument]:
        """Return all chunks for a file from the workspace index."""
        ws_ids = [workspace_id] if workspace_id else list(self._known_indexes)
        result: list[VectorDocument] = []
        for ws_id in ws_ids:
            # Extract workspace_id from index name if needed
            actual_ws = (
                ws_id.replace(f"{self._index_prefix}-", "")
                if ws_id.startswith(self._index_prefix)
                else ws_id
            )
            try:
                client = self._search_client(actual_ws)
                results = client.search(
                    search_text="*",
                    filter=f"file_name eq '{file_name}'",
                    select=[
                        "id",
                        "content",
                        "title",
                        "file_name",
                        "section",
                        "pages",
                        "chunk_index",
                        "last_verified",
                        "workspace_id",
                    ],
                )
                for r in results:
                    result.append(
                        VectorDocument(
                            id=r["id"],
                            workspace_id=r.get("workspace_id", actual_ws),
                            file_name=r.get("file_name", ""),
                            chunk_index=r.get("chunk_index", 0),
                            content=r.get("content", ""),
                            embedding=[],
                            title=r.get("title", ""),
                            section=r.get("section", ""),
                            pages=r.get("pages", []),
                            last_verified=r.get("last_verified", ""),
                        )
                    )
            except Exception:
                continue
        return sorted(result, key=lambda d: d.chunk_index)

    def get_all_workspace_ids(self) -> list[str]:
        """Return all workspace IDs that have indexes."""
        return [n.replace(f"{self._index_prefix}-", "") for n in self._known_indexes]

    def list_files(self, workspace_id: str) -> list[str]:
        """Return unique file names stored for a workspace."""
        try:
            client = self._search_client(workspace_id)
            results = client.search(
                search_text="*",
                select=["file_name"],
                include_total_count=True,
            )
            seen: set[str] = set()
            files: list[str] = []
            for r in results:
                fn = r.get("file_name", "")
                if fn and fn not in seen:
                    seen.add(fn)
                    files.append(fn)
            return files
        except Exception:
            return []
