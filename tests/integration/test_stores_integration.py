"""
Store integration tests -- verify that mock and Azure store interfaces behave
consistently across CRUD lifecycles.

Runs against whichever backend is configured (EVA_API_MOCK=true by default).
Each test exercises a full lifecycle to catch interface drift between the
in-memory stores and their Cosmos DB counterparts.

Reference: services/api-gateway/app/stores/__init__.py (dual-mode architecture).
"""

import os
import sys
import uuid

import pytest

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "services", "api-gateway")
)

from app.stores import (  # noqa: E402
    workspace_store,
    booking_store,
    team_store,
    document_store,
)
from app.stores.compat import aio  # noqa: E402
from app.models.workspace import Booking, TeamMember, Workspace  # noqa: E402
from app.pipeline.document_store import DocumentRecord  # noqa: E402


# ---------------------------------------------------------------------------
# Workspace CRUD lifecycle
# ---------------------------------------------------------------------------


class TestWorkspaceCRUD:
    """Create -> Read -> Update -> List -> Delete cycle for workspaces."""

    @pytest.mark.asyncio
    async def test_create_and_read(self, sample_workspace: Workspace):
        created = await aio(workspace_store.create(sample_workspace))
        assert created.id == sample_workspace.id
        assert created.name == "Integration Test Workspace"

        fetched = await aio(workspace_store.get(sample_workspace.id))
        assert fetched is not None
        assert fetched.id == sample_workspace.id
        assert fetched.status == "active"

    @pytest.mark.asyncio
    async def test_update(self, sample_workspace: Workspace):
        await aio(workspace_store.create(sample_workspace))

        updated = await aio(
            workspace_store.update(sample_workspace.id, {"status": "suspended"})
        )
        assert updated is not None
        assert updated.status == "suspended"
        # Other fields unchanged
        assert updated.name == sample_workspace.name

    @pytest.mark.asyncio
    async def test_update_nonexistent_returns_none(self):
        result = await aio(workspace_store.update("ws-nonexistent-xyz", {"status": "x"}))
        assert result is None

    @pytest.mark.asyncio
    async def test_list_with_grants(self, sample_workspace: Workspace):
        await aio(workspace_store.create(sample_workspace))

        # Grant for this workspace
        results = await aio(workspace_store.list([sample_workspace.id]))
        assert any(ws.id == sample_workspace.id for ws in results)

        # Grant for "all"
        results_all = await aio(workspace_store.list(["all"]))
        assert any(ws.id == sample_workspace.id for ws in results_all)

        # No matching grant
        results_none = await aio(workspace_store.list(["ws-other-workspace"]))
        assert not any(ws.id == sample_workspace.id for ws in results_none)

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_none(self):
        result = await aio(workspace_store.get("ws-does-not-exist"))
        assert result is None

    @pytest.mark.asyncio
    async def test_multiple_updates_accumulate(self, sample_workspace: Workspace):
        await aio(workspace_store.create(sample_workspace))

        await aio(workspace_store.update(sample_workspace.id, {"document_count": 5}))
        await aio(workspace_store.update(sample_workspace.id, {"status": "archived"}))

        ws = await aio(workspace_store.get(sample_workspace.id))
        assert ws is not None
        assert ws.document_count == 5
        assert ws.status == "archived"


# ---------------------------------------------------------------------------
# Booking lifecycle
# ---------------------------------------------------------------------------


class TestBookingLifecycle:
    """Create -> Update status -> List by user -> List by workspace."""

    @pytest.mark.asyncio
    async def test_create_and_get(self, sample_booking: Booking):
        created = await aio(booking_store.create(sample_booking))
        assert created.id == sample_booking.id
        assert created.status == "pending"

        fetched = await aio(booking_store.get(sample_booking.id))
        assert fetched is not None
        assert fetched.workspace_id == sample_booking.workspace_id

    @pytest.mark.asyncio
    async def test_update_status(self, sample_booking: Booking):
        await aio(booking_store.create(sample_booking))

        updated = await aio(
            booking_store.update(sample_booking.id, {"status": "active"})
        )
        assert updated is not None
        assert updated.status == "active"

    @pytest.mark.asyncio
    async def test_list_by_user(self, sample_booking: Booking):
        await aio(booking_store.create(sample_booking))

        by_user = await aio(booking_store.list_by_user(sample_booking.requester_id))
        assert len(by_user) >= 1
        assert any(b.id == sample_booking.id for b in by_user)

    @pytest.mark.asyncio
    async def test_list_by_workspace(self, sample_booking: Booking):
        await aio(booking_store.create(sample_booking))

        by_ws = await aio(booking_store.list_by_workspace(sample_booking.workspace_id))
        assert len(by_ws) >= 1
        assert any(b.id == sample_booking.id for b in by_ws)

    @pytest.mark.asyncio
    async def test_delete(self, sample_booking: Booking):
        await aio(booking_store.create(sample_booking))

        deleted = await aio(booking_store.delete(sample_booking.id))
        assert deleted is True

        fetched = await aio(booking_store.get(sample_booking.id))
        assert fetched is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_false(self):
        result = await aio(booking_store.delete("bk-nonexistent-xyz"))
        assert result is False

    @pytest.mark.asyncio
    async def test_survey_flags(self, sample_booking: Booking):
        await aio(booking_store.create(sample_booking))
        assert sample_booking.entry_survey_completed is False

        updated = await aio(
            booking_store.update(sample_booking.id, {"entry_survey_completed": True})
        )
        assert updated is not None
        assert updated.entry_survey_completed is True

    @pytest.mark.asyncio
    async def test_list_by_user_no_results(self):
        results = await aio(booking_store.list_by_user("user-nonexistent"))
        assert results == []


# ---------------------------------------------------------------------------
# Team management
# ---------------------------------------------------------------------------


class TestTeamManagement:
    """Add member -> List -> Update role -> Remove."""

    @pytest.mark.asyncio
    async def test_add_and_list(
        self, sample_booking: Booking, sample_team_member: TeamMember
    ):
        await aio(booking_store.create(sample_booking))

        added = await aio(team_store.add(sample_booking.id, sample_team_member))
        assert added.user_id == sample_team_member.user_id
        assert added.role == "contributor"

        members = await aio(team_store.list_by_booking(sample_booking.id))
        assert len(members) == 1
        assert members[0].email == "integ-test@example.org"

    @pytest.mark.asyncio
    async def test_get_member(
        self, sample_booking: Booking, sample_team_member: TeamMember
    ):
        await aio(booking_store.create(sample_booking))
        await aio(team_store.add(sample_booking.id, sample_team_member))

        found = await aio(
            team_store.get(sample_booking.id, sample_team_member.user_id)
        )
        assert found is not None
        assert found.name == "Integration Tester"

    @pytest.mark.asyncio
    async def test_update_role(
        self, sample_booking: Booking, sample_team_member: TeamMember
    ):
        await aio(booking_store.create(sample_booking))
        await aio(team_store.add(sample_booking.id, sample_team_member))

        updated = await aio(
            team_store.update_role(
                sample_booking.id, sample_team_member.user_id, "admin"
            )
        )
        assert updated is not None
        assert updated.role == "admin"

        # Verify is_admin reflects the change
        assert await aio(
            team_store.is_admin(sample_booking.id, sample_team_member.user_id)
        )

    @pytest.mark.asyncio
    async def test_remove_member(
        self, sample_booking: Booking, sample_team_member: TeamMember
    ):
        await aio(booking_store.create(sample_booking))
        await aio(team_store.add(sample_booking.id, sample_team_member))

        removed = await aio(
            team_store.remove(sample_booking.id, sample_team_member.user_id)
        )
        assert removed is True

        members = await aio(team_store.list_by_booking(sample_booking.id))
        assert len(members) == 0

    @pytest.mark.asyncio
    async def test_remove_nonexistent_returns_false(self, sample_booking: Booking):
        await aio(booking_store.create(sample_booking))
        result = await aio(team_store.remove(sample_booking.id, "user-ghost"))
        assert result is False

    @pytest.mark.asyncio
    async def test_list_empty_booking(self, sample_booking: Booking):
        members = await aio(team_store.list_by_booking(sample_booking.id))
        assert members == []

    @pytest.mark.asyncio
    async def test_multiple_members(self, sample_booking: Booking, now_iso: str):
        await aio(booking_store.create(sample_booking))

        for i in range(3):
            member = TeamMember(
                id=f"test-integ-tm-{i}",
                workspace_id=sample_booking.workspace_id,
                user_id=f"user-multi-{i}",
                email=f"user{i}@example.org",
                name=f"User {i}",
                role=["reader", "contributor", "admin"][i],
                added_at=now_iso,
                added_by="test-admin",
            )
            await aio(team_store.add(sample_booking.id, member))

        members = await aio(team_store.list_by_booking(sample_booking.id))
        assert len(members) == 3
        roles = {m.role for m in members}
        assert roles == {"reader", "contributor", "admin"}


# ---------------------------------------------------------------------------
# Document store
# ---------------------------------------------------------------------------


class TestDocumentStore:
    """Add -> Update status -> List by workspace -> Delete."""

    @pytest.mark.asyncio
    async def test_add_and_get(self, sample_document_record: DocumentRecord):
        await aio(document_store.add(sample_document_record))

        fetched = await aio(document_store.get(sample_document_record.id))
        assert fetched is not None
        assert fetched.file_name == "test-document.txt"
        assert fetched.status == "uploaded"

    @pytest.mark.asyncio
    async def test_update_status(self, sample_document_record: DocumentRecord):
        await aio(document_store.add(sample_document_record))

        await aio(
            document_store.update_status(sample_document_record.id, "processing")
        )
        doc = await aio(document_store.get(sample_document_record.id))
        assert doc is not None
        assert doc.status == "processing"

    @pytest.mark.asyncio
    async def test_status_transitions(self, sample_document_record: DocumentRecord):
        """Walk through the full status lifecycle."""
        await aio(document_store.add(sample_document_record))

        for status in ("processing", "chunking", "embedding", "indexed"):
            kwargs = {}
            if status == "indexed":
                kwargs = {"chunk_count": 5, "indexed_at": "2026-04-15T00:00:00Z"}
            await aio(
                document_store.update_status(
                    sample_document_record.id, status, **kwargs
                )
            )
            doc = await aio(document_store.get(sample_document_record.id))
            assert doc is not None
            assert doc.status == status

        # Final state
        doc = await aio(document_store.get(sample_document_record.id))
        assert doc.chunk_count == 5
        assert doc.indexed_at == "2026-04-15T00:00:00Z"

    @pytest.mark.asyncio
    async def test_list_by_workspace(
        self, workspace_id: str, sample_document_record: DocumentRecord
    ):
        await aio(document_store.add(sample_document_record))

        docs = await aio(document_store.list_by_workspace(workspace_id))
        assert len(docs) >= 1
        assert any(d.id == sample_document_record.id for d in docs)

    @pytest.mark.asyncio
    async def test_delete(self, sample_document_record: DocumentRecord):
        await aio(document_store.add(sample_document_record))

        deleted = await aio(document_store.delete(sample_document_record.id))
        assert deleted is True

        fetched = await aio(document_store.get(sample_document_record.id))
        assert fetched is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_false(self):
        result = await aio(document_store.delete("doc-nonexistent-xyz"))
        assert result is False

    @pytest.mark.asyncio
    async def test_error_status_with_message(
        self, sample_document_record: DocumentRecord
    ):
        await aio(document_store.add(sample_document_record))

        await aio(
            document_store.update_status(
                sample_document_record.id,
                "error",
                error_message="Unsupported file format",
            )
        )
        doc = await aio(document_store.get(sample_document_record.id))
        assert doc is not None
        assert doc.status == "error"
        assert doc.error_message == "Unsupported file format"

    @pytest.mark.asyncio
    async def test_list_all(self, sample_document_record: DocumentRecord):
        await aio(document_store.add(sample_document_record))

        all_docs = await aio(document_store.list_all())
        assert any(d.id == sample_document_record.id for d in all_docs)
