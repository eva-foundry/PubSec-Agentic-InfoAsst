"""
Shared fixtures for integration tests.

Provides sample data, workspace IDs, user context, and auto-cleanup
fixtures that remove test artefacts after each test.
"""

import os
import sys
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio

# ---------------------------------------------------------------------------
# Path setup — same pattern as tests/security/
# ---------------------------------------------------------------------------

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "services", "api-gateway")
)

from app.stores import (  # noqa: E402
    workspace_store,
    booking_store,
    team_store,
    document_store,
    vector_store,
)
from app.stores.compat import aio  # noqa: E402
from app.models.workspace import Booking, TeamMember, Workspace  # noqa: E402
from app.pipeline.document_store import DocumentRecord  # noqa: E402


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TEST_PREFIX = "test-integ-"


def _uid() -> str:
    return f"{TEST_PREFIX}{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Sample data factories
# ---------------------------------------------------------------------------


@pytest.fixture
def workspace_id() -> str:
    """Generate a unique workspace ID for the test."""
    return _uid()


@pytest.fixture
def user_id() -> str:
    return f"user-{uuid.uuid4().hex[:6]}"


@pytest.fixture
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@pytest.fixture
def sample_workspace(workspace_id: str, now_iso: str) -> Workspace:
    return Workspace(
        id=workspace_id,
        name="Integration Test Workspace",
        name_fr="Espace de travail test integration",
        description="Created by integration test suite",
        type="sandbox",
        status="active",
        owner_id="test-owner",
        data_classification="unclassified",
        document_capacity=10,
        document_count=0,
        monthly_cost=0.0,
        cost_centre="CC-TEST",
        created_at=now_iso,
        updated_at=now_iso,
    )


@pytest.fixture
def sample_booking(workspace_id: str, user_id: str, now_iso: str) -> Booking:
    return Booking(
        id=_uid(),
        workspace_id=workspace_id,
        requester_id=user_id,
        status="pending",
        start_date="2026-05-01",
        end_date="2026-06-30",
        created_at=now_iso,
        updated_at=now_iso,
    )


@pytest.fixture
def sample_team_member(workspace_id: str, now_iso: str) -> TeamMember:
    return TeamMember(
        id=_uid(),
        workspace_id=workspace_id,
        user_id=f"user-{uuid.uuid4().hex[:6]}",
        email="integ-test@example.org",
        name="Integration Tester",
        role="contributor",
        added_at=now_iso,
        added_by="test-admin",
    )


@pytest.fixture
def sample_document_bytes() -> bytes:
    """A small UTF-8 document with enough content to produce multiple chunks."""
    paragraphs = []
    for i in range(6):
        paragraphs.append(
            f"Section {i + 1}: This is paragraph {i + 1} of the integration test "
            f"document. It contains enough text to be meaningful for chunking "
            f"purposes. The social benefits Act requires applicants to have "
            f"resided in the country for at least 10 years after turning 18. "
            f"{'x' * 400}"
        )
    return "\n\n".join(paragraphs).encode("utf-8")


@pytest.fixture
def sample_document_record(workspace_id: str, now_iso: str) -> DocumentRecord:
    return DocumentRecord(
        id=_uid(),
        workspace_id=workspace_id,
        file_name="test-document.txt",
        file_size=1024,
        status="uploaded",
        uploaded_by="test-user",
        uploaded_at=now_iso,
    )


# ---------------------------------------------------------------------------
# Auto-cleanup fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _cleanup_workspace_store():
    """Remove any test workspaces created during the test."""
    yield
    # WorkspaceStore uses _workspaces dict — remove test entries
    if hasattr(workspace_store, "_workspaces"):
        to_remove = [
            k for k in workspace_store._workspaces if k.startswith(TEST_PREFIX)
        ]
        for k in to_remove:
            del workspace_store._workspaces[k]


@pytest.fixture(autouse=True)
def _cleanup_booking_store():
    """Remove any test bookings created during the test."""
    yield
    if hasattr(booking_store, "_bookings"):
        to_remove = [
            k for k in booking_store._bookings if k.startswith(TEST_PREFIX)
        ]
        for k in to_remove:
            del booking_store._bookings[k]


@pytest.fixture(autouse=True)
def _cleanup_team_store():
    """Remove any test team entries created during the test."""
    yield
    if hasattr(team_store, "_members"):
        to_remove = [
            k for k in team_store._members if k.startswith(TEST_PREFIX)
        ]
        for k in to_remove:
            del team_store._members[k]


@pytest.fixture(autouse=True)
def _cleanup_document_store():
    """Remove any test document records created during the test."""
    yield
    if hasattr(document_store, "_documents"):
        to_remove = [
            k for k in document_store._documents if k.startswith(TEST_PREFIX)
        ]
        for k in to_remove:
            del document_store._documents[k]


@pytest.fixture(autouse=True)
def _cleanup_vector_store():
    """Remove any test workspace entries from the vector store."""
    yield
    if hasattr(vector_store, "_documents"):
        to_remove = [
            k for k in vector_store._documents if k.startswith(TEST_PREFIX)
        ]
        for k in to_remove:
            del vector_store._documents[k]
