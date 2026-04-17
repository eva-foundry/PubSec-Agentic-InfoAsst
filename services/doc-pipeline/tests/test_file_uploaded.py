"""Tests for the file_uploaded handler.

Covers:
- detect_file_type for every supported extension
- Unsupported extensions return UNSUPPORTED
- Queue routing for each file type
- handle_file_uploaded end-to-end with mocked dependencies
"""

from __future__ import annotations

import json

# We need to make the handlers importable from the test location.
# Add the doc-pipeline root to sys.path.
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

DOC_PIPELINE_ROOT = Path(__file__).resolve().parent.parent
if str(DOC_PIPELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(DOC_PIPELINE_ROOT))

from handlers.file_uploaded import (
    EXTENSION_MAP,
    QUEUE_MAP,
    FileType,
    UploadResult,
    detect_file_type,
    handle_file_uploaded,
)
from shared.status import PipelineState

# ---------------------------------------------------------------------------
# detect_file_type tests
# ---------------------------------------------------------------------------


class TestDetectFileType:
    """Test file type detection from extensions."""

    @pytest.mark.parametrize(
        "filename,expected",
        [
            ("report.pdf", FileType.PDF),
            ("REPORT.PDF", FileType.PDF),
            ("doc.docx", FileType.OFFICE),
            ("slides.pptx", FileType.OFFICE),
            ("data.xlsx", FileType.OFFICE),
            ("readme.txt", FileType.TEXT),
            ("notes.md", FileType.TEXT),
            ("page.html", FileType.TEXT),
            ("page.htm", FileType.TEXT),
            ("data.csv", FileType.TEXT),
            ("config.json", FileType.TEXT),
            ("schema.xml", FileType.TEXT),
            ("photo.jpg", FileType.IMAGE),
            ("photo.jpeg", FileType.IMAGE),
            ("graphic.png", FileType.IMAGE),
            ("anim.gif", FileType.IMAGE),
            ("scan.bmp", FileType.IMAGE),
            ("scan.tif", FileType.IMAGE),
            ("scan.tiff", FileType.IMAGE),
            ("message.eml", FileType.EMAIL),
            ("message.msg", FileType.EMAIL),
        ],
    )
    def test_supported_extensions(self, filename: str, expected: FileType) -> None:
        assert detect_file_type(filename) == expected

    @pytest.mark.parametrize(
        "filename",
        [
            "archive.zip",
            "program.exe",
            "database.db",
            "video.mp4",
            "audio.wav",
            "noextension",
            "",
        ],
    )
    def test_unsupported_extensions(self, filename: str) -> None:
        assert detect_file_type(filename) == FileType.UNSUPPORTED

    def test_all_extension_map_entries_detected(self) -> None:
        """Every entry in EXTENSION_MAP should be correctly detected."""
        for ext, expected_type in EXTENSION_MAP.items():
            filename = f"test_file{ext}"
            assert detect_file_type(filename) == expected_type, (
                f"Extension {ext} -> expected {expected_type}"
            )


# ---------------------------------------------------------------------------
# Queue routing tests
# ---------------------------------------------------------------------------


class TestQueueRouting:
    """Test that each file type maps to the correct queue."""

    def test_pdf_routes_to_pdf_submit(self) -> None:
        assert QUEUE_MAP[FileType.PDF] == "eva-pdf-submit"

    def test_office_routes_to_non_pdf_submit(self) -> None:
        assert QUEUE_MAP[FileType.OFFICE] == "eva-non-pdf-submit"

    def test_text_routes_to_non_pdf_submit(self) -> None:
        assert QUEUE_MAP[FileType.TEXT] == "eva-non-pdf-submit"

    def test_image_routes_to_image_enrichment(self) -> None:
        assert QUEUE_MAP[FileType.IMAGE] == "eva-image-enrichment"

    def test_email_routes_to_non_pdf_submit(self) -> None:
        assert QUEUE_MAP[FileType.EMAIL] == "eva-non-pdf-submit"

    def test_unsupported_has_no_queue(self) -> None:
        assert FileType.UNSUPPORTED not in QUEUE_MAP

    def test_all_supported_types_have_queues(self) -> None:
        """Every non-UNSUPPORTED FileType should have a queue mapping."""
        for ft in FileType:
            if ft != FileType.UNSUPPORTED:
                assert ft in QUEUE_MAP, f"FileType.{ft.name} has no queue mapping"


# ---------------------------------------------------------------------------
# handle_file_uploaded integration test (with mocks)
# ---------------------------------------------------------------------------


class TestHandleFileUploaded:
    """Test the main handler with mocked dependencies."""

    def _make_mocks(self) -> dict:
        status_tracker = AsyncMock()
        queue_client = AsyncMock()
        chunk_container = MagicMock()
        # Make list_blobs return an async iterator with no items
        chunk_container.list_blobs = MagicMock(return_value=AsyncIteratorMock([]))
        chunk_container.delete_blob = AsyncMock()
        search_cleaner = AsyncMock()

        return {
            "status_tracker": status_tracker,
            "queue_clients": {
                "eva-pdf-submit": queue_client,
                "eva-non-pdf-submit": queue_client,
                "eva-image-enrichment": queue_client,
            },
            "chunk_container_client": chunk_container,
            "search_cleaner": search_cleaner,
        }

    @pytest.mark.asyncio
    async def test_pdf_file_routes_correctly(self) -> None:
        mocks = self._make_mocks()
        result = await handle_file_uploaded(
            blob_name="report.pdf",
            blob_uri="https://storage/container/report.pdf",
            workspace_id="ws-001",
            uploaded_by="user@example.com",
            **mocks,
        )

        assert isinstance(result, UploadResult)
        assert result.file_type == FileType.PDF
        assert result.queue_name == "eva-pdf-submit"
        assert result.workspace_id == "ws-001"
        assert result.uploaded_by == "user@example.com"

        # Status tracker should have been called with PROCESSING
        mocks["status_tracker"].update.assert_called()

    @pytest.mark.asyncio
    async def test_unsupported_file_sets_error_status(self) -> None:
        mocks = self._make_mocks()
        result = await handle_file_uploaded(
            blob_name="archive.zip",
            blob_uri="https://storage/container/archive.zip",
            workspace_id="ws-001",
            uploaded_by="user@example.com",
            **mocks,
        )

        assert result.file_type == FileType.UNSUPPORTED
        assert result.queue_name is None

        # Should have called status with ERROR
        calls = mocks["status_tracker"].update.call_args_list
        assert any(call.args[1] == PipelineState.ERROR for call in calls)

    @pytest.mark.asyncio
    async def test_message_sent_to_queue(self) -> None:
        mocks = self._make_mocks()
        await handle_file_uploaded(
            blob_name="data.csv",
            blob_uri="https://storage/container/data.csv",
            workspace_id="ws-002",
            uploaded_by="analyst@example.com",
            **mocks,
        )

        queue_client = mocks["queue_clients"]["eva-non-pdf-submit"]
        queue_client.send_message.assert_called_once()

        sent_msg = json.loads(queue_client.send_message.call_args.args[0])
        assert sent_msg["blob_name"] == "data.csv"
        assert sent_msg["workspace_id"] == "ws-002"
        assert sent_msg["file_type"] == "text"


# ---------------------------------------------------------------------------
# Helper: async iterator mock
# ---------------------------------------------------------------------------


class AsyncIteratorMock:
    """Mock for async iterators (used by list_blobs)."""

    def __init__(self, items: list) -> None:
        self._items = items
        self._index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._items):
            raise StopAsyncIteration
        item = self._items[self._index]
        self._index += 1
        return item
