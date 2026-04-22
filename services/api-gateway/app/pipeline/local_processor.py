"""Local document processing pipeline — extract, chunk, embed, index.

Implements the full ingestion flow in-process (no Service Bus, no Azure
Document Intelligence). Works with both in-memory and Azure-backed stores
via the ``aio()`` wrapper.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from ..stores.compat import aio
from ..stores.vector_store import VectorDocument, VectorStore
from .document_store import DocumentRecord, DocumentStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lightweight paragraph-based chunker (avoids doc-pipeline dependency on
# tiktoken/NLTK at import time).  For demo purposes this is sufficient;
# the full chunking engine in services/doc-pipeline is used in production.
# ---------------------------------------------------------------------------

_DEFAULT_TARGET_CHARS = 2000  # roughly ~500 tokens


def _paragraph_chunk(
    text: str,
    file_name: str,
    target_chars: int = _DEFAULT_TARGET_CHARS,
) -> list[dict]:
    """Split text into paragraph-based chunks.

    Returns a list of dicts with keys: content, chunk_index, title, section, pages.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return []

    chunks: list[dict] = []
    current = ""
    chunk_index = 0

    for para in paragraphs:
        candidate = (current + "\n\n" + para) if current else para
        if len(candidate) > target_chars and current:
            chunks.append({
                "content": current,
                "chunk_index": chunk_index,
                "title": "",
                "section": "",
                "pages": [],
            })
            chunk_index += 1
            current = para
        else:
            current = candidate

    if current:
        chunks.append({
            "content": current,
            "chunk_index": chunk_index,
            "title": "",
            "section": "",
            "pages": [],
        })

    return chunks


class LocalDocumentProcessor:
    """Process a document locally: extract text, chunk, embed, store."""

    def __init__(
        self,
        vector_store: VectorStore,
        embedding_client,
        document_store: DocumentStore,
    ) -> None:
        self.vector_store = vector_store
        self.embedding_client = embedding_client
        self.document_store = document_store

    async def process(
        self,
        workspace_id: str,
        file_name: str,
        content_bytes: bytes,
        archetype: str = "default",
        uploaded_by: str = "unknown",
    ) -> DocumentRecord:
        """Run the full ingestion pipeline for a single document.

        Steps:
        1. Create DocumentRecord (status: processing)
        2. Extract text from bytes (UTF-8 decode)
        3. Chunk text into paragraphs
        4. Embed all chunks via Azure OpenAI (or mock)
        5. Store VectorDocuments in AI Search (or in-memory)
        6. Return updated DocumentRecord (status: indexed)
        """
        doc_id = f"doc-{uuid.uuid4().hex[:8]}"
        now = datetime.now(UTC).isoformat()

        record = DocumentRecord(
            id=doc_id,
            workspace_id=workspace_id,
            file_name=file_name,
            file_size=len(content_bytes),
            status="processing",
            uploaded_by=uploaded_by,
            uploaded_at=now,
        )
        await aio(self.document_store.add(record))

        try:
            # 1. Extract text
            text = content_bytes.decode("utf-8", errors="replace").strip()
            if not text:
                await aio(
                    self.document_store.update_status(
                        doc_id, "error", error_message="Empty document"
                    )
                )
                return await aio(self.document_store.get(doc_id))  # type: ignore[return-value]

            # 2. Chunk
            await aio(self.document_store.update_status(doc_id, "chunking"))
            chunks = _paragraph_chunk(text, file_name)
            if not chunks:
                await aio(
                    self.document_store.update_status(
                        doc_id, "error", error_message="No chunks produced"
                    )
                )
                return await aio(self.document_store.get(doc_id))  # type: ignore[return-value]

            logger.info(
                "Chunked %s into %d chunks for workspace %s",
                file_name,
                len(chunks),
                workspace_id,
            )

            # 3. Embed
            await aio(self.document_store.update_status(doc_id, "embedding"))
            chunk_texts = [c["content"] for c in chunks]
            embeddings = await self.embedding_client.embed(chunk_texts)

            # 4. Build VectorDocuments
            vector_docs: list[VectorDocument] = []
            for chunk, embedding in zip(chunks, embeddings):
                vector_docs.append(
                    VectorDocument(
                        id=f"{doc_id}-chunk-{chunk['chunk_index']}",
                        workspace_id=workspace_id,
                        file_name=file_name,
                        chunk_index=chunk["chunk_index"],
                        content=chunk["content"],
                        embedding=embedding,
                        title=chunk.get("title", ""),
                        section=chunk.get("section", ""),
                        pages=chunk.get("pages", []),
                        last_verified=now,
                    )
                )

            # 5. Store in vector index (AI Search or in-memory)
            await aio(self.vector_store.add_documents(workspace_id, vector_docs))

            indexed_at = datetime.now(UTC).isoformat()
            await aio(
                self.document_store.update_status(
                    doc_id,
                    "indexed",
                    chunk_count=len(vector_docs),
                    indexed_at=indexed_at,
                )
            )

            logger.info(
                "Indexed %s: %d chunks stored for workspace %s",
                file_name,
                len(vector_docs),
                workspace_id,
            )

        except Exception as exc:
            logger.exception("Failed to process %s", file_name)
            await aio(self.document_store.update_status(doc_id, "error", error_message=str(exc)))

        return await aio(self.document_store.get(doc_id))  # type: ignore[return-value]
