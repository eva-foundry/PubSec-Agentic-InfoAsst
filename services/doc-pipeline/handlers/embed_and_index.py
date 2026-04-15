"""Embedding generation and AI Search indexing.

Reads enriched chunks from blob, generates embeddings via Azure OpenAI
(routed through APIM), builds search index documents, and batch-uploads
them to Azure AI Search.
"""
from __future__ import annotations

import json
import logging
from typing import Protocol

from opentelemetry import trace

from shared.blob_helpers import download_blob, list_blobs
from shared.status import PipelineState, StatusTracker

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


# ---------------------------------------------------------------------------
# Protocols for external dependencies
# ---------------------------------------------------------------------------


class EmbeddingClient(Protocol):
    """Protocol for generating embeddings (Azure OpenAI via APIM)."""

    async def generate_embedding(self, text: str) -> list[float]: ...


class SearchIndexClient(Protocol):
    """Protocol for Azure AI Search index operations."""

    async def upload_documents(self, index_name: str, documents: list[dict]) -> dict: ...


class BlobContainerClient(Protocol):
    """Protocol for blob container operations."""

    async def download_blob(self, blob: str) -> "BlobDownloader": ...
    def list_blobs(self, name_starts_with: str | None = None) -> "AsyncBlobIterator": ...


class BlobDownloader(Protocol):
    async def readall(self) -> bytes: ...


class AsyncBlobIterator(Protocol):
    def __aiter__(self) -> "AsyncBlobIterator": ...
    async def __anext__(self) -> object: ...


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------


@tracer.start_as_current_span("embed_and_index")
async def embed_and_index(
    blob_name: str,
    workspace_id: str,
    *,
    chunk_container: BlobContainerClient,
    embedding_client: EmbeddingClient,
    search_client: SearchIndexClient,
    status_tracker: StatusTracker,
    batch_size: int = 50,
) -> int:
    """Generate embeddings and index all chunks for a document.

    For each chunk:
        1. Read chunk JSON from blob
        2. Generate embedding via Azure OpenAI (through APIM)
        3. Build search index document
        4. Batch upload to AI Search index

    Args:
        blob_name: Source document blob name.
        workspace_id: The workspace the document belongs to.
        chunk_container: Blob container where enriched chunks are stored.
        embedding_client: Client for generating embeddings via APIM.
        search_client: Client for Azure AI Search operations.
        status_tracker: Cosmos status tracker.
        batch_size: Number of documents to upload in each batch.

    Returns:
        Number of chunks embedded and indexed.
    """
    span = trace.get_current_span()
    span.set_attribute("doc.blob_name", blob_name)
    span.set_attribute("doc.workspace_id", workspace_id)

    index_name = f"eva-workspace-{workspace_id}-index"
    span.set_attribute("doc.index_name", index_name)

    await status_tracker.update(
        blob_name,
        PipelineState.EMBEDDING,
        "Generating embeddings for document chunks",
    )

    # List all chunk blobs
    chunk_prefix = f"{workspace_id}/{blob_name}/chunks/"
    chunk_paths = await list_blobs(chunk_container, chunk_prefix)

    if not chunk_paths:
        logger.warning("No chunks found for embedding", extra={"blob_name": blob_name})
        return 0

    span.set_attribute("doc.chunk_count", len(chunk_paths))

    # Build search documents with embeddings
    search_docs: list[dict] = []

    for chunk_path in chunk_paths:
        try:
            raw = await download_blob(chunk_container, chunk_path)
            chunk = json.loads(raw)

            # Use translated content for embedding if available, otherwise original
            embed_text = chunk.get("translated_content", chunk.get("content", ""))
            if not embed_text.strip():
                continue

            # Generate embedding
            embedding = await embedding_client.generate_embedding(embed_text)

            # Build search index document
            search_doc = {
                "id": chunk["chunk_id"].replace("/", "_").replace(" ", "_"),
                "chunk_id": chunk["chunk_id"],
                "source_file": chunk.get("source_file", blob_name),
                "workspace_id": workspace_id,
                "content": chunk.get("content", ""),
                "content_vector": embedding,
                "chunk_index": chunk.get("chunk_index", 0),
            }

            # Add enrichment fields if present
            if "translated_content" in chunk:
                search_doc["translated_content"] = chunk["translated_content"]
            if "detected_language" in chunk:
                search_doc["detected_language"] = chunk["detected_language"]
            if "entities" in chunk:
                search_doc["entities"] = json.dumps(chunk["entities"], ensure_ascii=False)
            if "key_phrases" in chunk:
                search_doc["key_phrases"] = chunk["key_phrases"]
            if "pages" in chunk:
                search_doc["pages"] = chunk["pages"]

            search_docs.append(search_doc)

        except Exception:
            logger.error(
                "Failed to embed chunk",
                extra={"chunk_path": chunk_path, "blob_name": blob_name},
                exc_info=True,
            )

    # Batch upload to search index
    if search_docs:
        await status_tracker.update(
            blob_name,
            PipelineState.INDEXING,
            f"Indexing {len(search_docs)} chunks to search index {index_name}",
        )

        for i in range(0, len(search_docs), batch_size):
            batch = search_docs[i : i + batch_size]
            try:
                await search_client.upload_documents(index_name, batch)
                logger.info(
                    "Batch indexed",
                    extra={
                        "blob_name": blob_name,
                        "batch_start": i,
                        "batch_size": len(batch),
                    },
                )
            except Exception:
                logger.error(
                    "Failed to index batch",
                    extra={"blob_name": blob_name, "batch_start": i},
                    exc_info=True,
                )

    # Update status to COMPLETE
    await status_tracker.update(
        blob_name,
        PipelineState.COMPLETE,
        f"Document processed: {len(search_docs)} chunks embedded and indexed",
    )

    logger.info(
        "Document embedded and indexed",
        extra={"blob_name": blob_name, "indexed_count": len(search_docs)},
    )

    return len(search_docs)
