"""Text enrichment -- language detection, translation, entity extraction, key phrases.

Enriches each chunk of a document with linguistic metadata using
Azure AI Language and Azure Translator services, then queues
the enriched chunks for embedding.
"""
from __future__ import annotations

import json
import logging
from typing import Protocol

from opentelemetry import trace
from shared.blob_helpers import download_blob, list_blobs, upload_chunk
from shared.status import PipelineState, StatusTracker

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


# ---------------------------------------------------------------------------
# Protocols for Azure AI services (mockable in tests)
# ---------------------------------------------------------------------------


class LanguageClient(Protocol):
    """Protocol for Azure AI Language service operations."""

    async def detect_language(self, documents: list[str]) -> list[dict]: ...
    async def recognize_entities(self, documents: list[str]) -> list[dict]: ...
    async def extract_key_phrases(self, documents: list[str]) -> list[dict]: ...


class TranslatorClient(Protocol):
    """Protocol for Azure Translator operations."""

    async def translate(
        self, texts: list[str], target_language: str, source_language: str | None = None
    ) -> list[str]: ...


class BlobContainerClient(Protocol):
    """Protocol for blob container operations."""

    async def upload_blob(self, name: str, data: bytes, overwrite: bool = False) -> None: ...
    async def download_blob(self, blob: str) -> BlobDownloader: ...
    def list_blobs(self, name_starts_with: str | None = None) -> AsyncBlobIterator: ...


class BlobDownloader(Protocol):
    async def readall(self) -> bytes: ...


class AsyncBlobIterator(Protocol):
    def __aiter__(self) -> AsyncBlobIterator: ...
    async def __anext__(self) -> object: ...


class QueueSender(Protocol):
    """Protocol for sending messages to a queue."""

    async def send_message(self, content: str, visibility_timeout: int = 0) -> None: ...


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------


@tracer.start_as_current_span("enrich.enrich_chunks")
async def enrich_chunks(
    blob_name: str,
    workspace_id: str,
    *,
    chunk_container: BlobContainerClient,
    language_client: LanguageClient,
    translator_client: TranslatorClient,
    embed_queue: QueueSender,
    status_tracker: StatusTracker,
    target_language: str = "en",
) -> int:
    """Enrich all chunks for a document with linguistic metadata.

    For each chunk:
        1. Detect language (Azure AI Language)
        2. If language != target, translate (Azure Translator)
        3. Extract entities (Azure AI Language)
        4. Extract key phrases (Azure AI Language)
        5. Update chunk blob with enrichment fields
        6. Queue for embedding

    Args:
        blob_name: Source document blob name.
        workspace_id: The workspace the document belongs to.
        chunk_container: Blob container where chunks are stored.
        language_client: Azure AI Language service client.
        translator_client: Azure Translator client.
        embed_queue: Queue for sending chunks to embedding.
        status_tracker: Cosmos status tracker.
        target_language: Target language code (default "en").

    Returns:
        Number of chunks enriched.
    """
    span = trace.get_current_span()
    span.set_attribute("doc.blob_name", blob_name)
    span.set_attribute("doc.workspace_id", workspace_id)
    span.set_attribute("doc.target_language", target_language)

    await status_tracker.update(
        blob_name,
        PipelineState.ENRICHING,
        "Starting text enrichment (language, entities, key phrases)",
    )

    # List all chunk blobs for this document
    chunk_prefix = f"{workspace_id}/{blob_name}/chunks/"
    chunk_paths = await list_blobs(chunk_container, chunk_prefix)

    if not chunk_paths:
        logger.warning("No chunks found for enrichment", extra={"blob_name": blob_name})
        return 0

    span.set_attribute("doc.chunk_count", len(chunk_paths))
    enriched_count = 0

    for chunk_path in chunk_paths:
        try:
            await _enrich_single_chunk(
                chunk_path=chunk_path,
                blob_name=blob_name,
                workspace_id=workspace_id,
                chunk_container=chunk_container,
                language_client=language_client,
                translator_client=translator_client,
                target_language=target_language,
            )
            enriched_count += 1
        except Exception:
            logger.error(
                "Failed to enrich chunk",
                extra={"chunk_path": chunk_path, "blob_name": blob_name},
                exc_info=True,
            )

    # Queue all chunks for embedding in a single message
    embed_message = json.dumps(
        {"blob_name": blob_name, "workspace_id": workspace_id},
        ensure_ascii=False,
    )
    await embed_queue.send_message(embed_message)

    logger.info(
        "Chunks enriched and queued for embedding",
        extra={"blob_name": blob_name, "enriched_count": enriched_count},
    )

    return enriched_count


# ---------------------------------------------------------------------------
# Single-chunk enrichment
# ---------------------------------------------------------------------------


@tracer.start_as_current_span("enrich.single_chunk")
async def _enrich_single_chunk(
    chunk_path: str,
    blob_name: str,
    workspace_id: str,
    *,
    chunk_container: BlobContainerClient,
    language_client: LanguageClient,
    translator_client: TranslatorClient,
    target_language: str,
) -> None:
    """Enrich a single chunk with language detection, translation, entities, key phrases."""
    span = trace.get_current_span()
    span.set_attribute("doc.chunk_path", chunk_path)

    # Read chunk
    raw = await download_blob(chunk_container, chunk_path)
    chunk = json.loads(raw)
    content = chunk.get("content", "")

    if not content.strip():
        return

    # 1. Detect language
    lang_results = await language_client.detect_language([content])
    detected_lang = "unknown"
    if lang_results:
        detected_lang = lang_results[0].get("language", "unknown")
    chunk["detected_language"] = detected_lang
    span.set_attribute("doc.detected_language", detected_lang)

    # 2. Translate if needed
    if detected_lang != target_language and detected_lang != "unknown":
        translated = await translator_client.translate(
            [content], target_language=target_language, source_language=detected_lang
        )
        if translated:
            chunk["translated_content"] = translated[0]
            chunk["translation_target"] = target_language

    # 3. Extract entities
    # Use translated content if available, otherwise original
    analysis_content = chunk.get("translated_content", content)
    entity_results = await language_client.recognize_entities([analysis_content])
    if entity_results:
        chunk["entities"] = entity_results[0].get("entities", [])

    # 4. Extract key phrases
    kp_results = await language_client.extract_key_phrases([analysis_content])
    if kp_results:
        chunk["key_phrases"] = kp_results[0].get("key_phrases", [])

    # 5. Update chunk blob
    await upload_chunk(chunk_container, chunk_path, chunk)
