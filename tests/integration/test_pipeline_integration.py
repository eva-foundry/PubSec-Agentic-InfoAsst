"""
Pipeline integration tests -- verify the full document processing lifecycle.

Upload -> chunk -> embed -> index, with status transitions tracked in
DocumentStore and chunks stored in VectorStore.

Uses LocalDocumentProcessor with a mock embedding client so tests run
without Azure OpenAI credentials.

Reference: services/api-gateway/app/pipeline/local_processor.py
"""

import os
import sys

import pytest

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "services", "api-gateway")
)

from app.stores import document_store, vector_store  # noqa: E402
from app.stores.compat import aio  # noqa: E402
from app.pipeline.local_processor import LocalDocumentProcessor  # noqa: E402
from app.pipeline.document_store import DocumentRecord  # noqa: E402


# ---------------------------------------------------------------------------
# Mock embedding client
# ---------------------------------------------------------------------------


class MockEmbeddingClient:
    """Returns deterministic fake embeddings for testing.

    Each embedding is a 16-dimensional vector derived from the text length,
    ensuring different texts produce different (but deterministic) vectors.
    """

    def __init__(self, dimensions: int = 16) -> None:
        self.dimensions = dimensions
        self.call_count = 0

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self.call_count += 1
        embeddings = []
        for i, text in enumerate(texts):
            # Create a simple deterministic embedding from text properties
            base = len(text) % 100 / 100.0
            vec = [
                (base + j * 0.01 + i * 0.001) % 1.0
                for j in range(self.dimensions)
            ]
            embeddings.append(vec)
        return embeddings


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_embedding_client() -> MockEmbeddingClient:
    return MockEmbeddingClient()


@pytest.fixture
def processor(mock_embedding_client: MockEmbeddingClient) -> LocalDocumentProcessor:
    return LocalDocumentProcessor(
        vector_store=vector_store,
        embedding_client=mock_embedding_client,
        document_store=document_store,
    )


# ---------------------------------------------------------------------------
# Full pipeline tests
# ---------------------------------------------------------------------------


class TestDocumentPipeline:
    """End-to-end document processing through the local pipeline."""

    @pytest.mark.asyncio
    async def test_full_pipeline_produces_indexed_document(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
        sample_document_bytes: bytes,
    ):
        """Upload -> chunk -> embed -> index. Final status should be 'indexed'."""
        record = await processor.process(
            workspace_id=workspace_id,
            file_name="policy-guide.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )

        assert record is not None
        assert record.status == "indexed"
        assert record.chunk_count > 0
        assert record.indexed_at is not None
        assert record.error_message is None

    @pytest.mark.asyncio
    async def test_chunks_stored_in_vector_store(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
        sample_document_bytes: bytes,
    ):
        """After processing, vector store should contain chunks for the workspace."""
        record = await processor.process(
            workspace_id=workspace_id,
            file_name="oas-act-extract.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )

        chunk_count = await aio(vector_store.document_count(workspace_id))
        assert chunk_count == record.chunk_count
        assert chunk_count > 0

    @pytest.mark.asyncio
    async def test_chunks_are_searchable(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
        mock_embedding_client: MockEmbeddingClient,
        sample_document_bytes: bytes,
    ):
        """Stored chunks should be retrievable via vector search."""
        await processor.process(
            workspace_id=workspace_id,
            file_name="searchable-doc.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )

        # Generate a query embedding using the same mock client
        query_embeddings = await mock_embedding_client.embed(["residency requirements"])
        results = await aio(
            vector_store.search(workspace_id, query_embeddings[0], top_k=3)
        )

        assert len(results) > 0
        assert all("content" in r for r in results)
        assert all("relevance_score" in r for r in results)

    @pytest.mark.asyncio
    async def test_file_names_tracked(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
        sample_document_bytes: bytes,
    ):
        """Vector store should track which files have been indexed."""
        await processor.process(
            workspace_id=workspace_id,
            file_name="tracked-file.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )

        files = await aio(vector_store.list_files(workspace_id))
        assert "tracked-file.txt" in files

    @pytest.mark.asyncio
    async def test_embedding_client_called(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
        mock_embedding_client: MockEmbeddingClient,
        sample_document_bytes: bytes,
    ):
        """Embedding client should be invoked exactly once (batch embed)."""
        await processor.process(
            workspace_id=workspace_id,
            file_name="embed-test.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )

        assert mock_embedding_client.call_count == 1

    @pytest.mark.asyncio
    async def test_document_record_in_store(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
        sample_document_bytes: bytes,
    ):
        """DocumentStore should contain the record after processing."""
        record = await processor.process(
            workspace_id=workspace_id,
            file_name="stored-record.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )

        docs = await aio(document_store.list_by_workspace(workspace_id))
        assert len(docs) == 1
        assert docs[0].id == record.id
        assert docs[0].status == "indexed"


# ---------------------------------------------------------------------------
# Status transition tests
# ---------------------------------------------------------------------------


class TestStatusTransitions:
    """Verify that the pipeline walks through expected status values."""

    @pytest.mark.asyncio
    async def test_empty_document_produces_error(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
    ):
        """An empty document should result in error status."""
        record = await processor.process(
            workspace_id=workspace_id,
            file_name="empty.txt",
            content_bytes=b"",
            uploaded_by="test-user",
        )

        assert record is not None
        assert record.status == "error"
        assert record.error_message is not None
        assert "Empty" in record.error_message or "empty" in record.error_message.lower()

    @pytest.mark.asyncio
    async def test_whitespace_only_document_produces_error(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
    ):
        """Whitespace-only content should fail during chunking."""
        record = await processor.process(
            workspace_id=workspace_id,
            file_name="whitespace.txt",
            content_bytes=b"   \n\n   \t\t   ",
            uploaded_by="test-user",
        )

        assert record is not None
        assert record.status == "error"

    @pytest.mark.asyncio
    async def test_single_paragraph_document(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
    ):
        """A single short paragraph should produce exactly one chunk."""
        content = b"This is a single paragraph document for testing."
        record = await processor.process(
            workspace_id=workspace_id,
            file_name="single-para.txt",
            content_bytes=content,
            uploaded_by="test-user",
        )

        assert record is not None
        assert record.status == "indexed"
        assert record.chunk_count == 1


# ---------------------------------------------------------------------------
# Multi-document workspace
# ---------------------------------------------------------------------------


class TestMultiDocument:
    """Verify that multiple documents in one workspace coexist correctly."""

    @pytest.mark.asyncio
    async def test_two_documents_accumulate_chunks(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
        sample_document_bytes: bytes,
    ):
        r1 = await processor.process(
            workspace_id=workspace_id,
            file_name="doc-alpha.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )
        r2 = await processor.process(
            workspace_id=workspace_id,
            file_name="doc-beta.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )

        total = await aio(vector_store.document_count(workspace_id))
        assert total == r1.chunk_count + r2.chunk_count

        files = await aio(vector_store.list_files(workspace_id))
        assert "doc-alpha.txt" in files
        assert "doc-beta.txt" in files

    @pytest.mark.asyncio
    async def test_delete_one_file_preserves_other(
        self,
        processor: LocalDocumentProcessor,
        workspace_id: str,
        sample_document_bytes: bytes,
    ):
        await processor.process(
            workspace_id=workspace_id,
            file_name="keeper.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )
        r2 = await processor.process(
            workspace_id=workspace_id,
            file_name="deleteme.txt",
            content_bytes=sample_document_bytes,
            uploaded_by="test-user",
        )

        removed = await aio(vector_store.delete_by_file(workspace_id, "deleteme.txt"))
        assert removed == r2.chunk_count

        files = await aio(vector_store.list_files(workspace_id))
        assert "keeper.txt" in files
        assert "deleteme.txt" not in files
