"""Tests for workspace catalog, booking lifecycle, teams, and surveys."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import booking_store, survey_store, team_store, workspace_store


@pytest.fixture(autouse=True)
def _reset_stores():
    """Reset all stores to clean seed state before each test."""
    workspace_store.__init__()  # type: ignore[misc]
    booking_store.__init__()  # type: ignore[misc]
    team_store.__init__()  # type: ignore[misc]
    survey_store.__init__()  # type: ignore[misc]
    yield


client = TestClient(app)

# --- Helpers ---

ALICE = {"x-demo-user-email": "alice@demo.gc.ca"}  # contributor, grants: ws-oas-act, ws-ei-juris
BOB = {"x-demo-user-email": "bob@demo.gc.ca"}  # reader, grants: ws-oas-act
CAROL = {"x-demo-user-email": "carol@demo.gc.ca"}  # admin, grants: all
DAVE = {"x-demo-user-email": "dave@demo.gc.ca"}  # admin, grants: all


def _create_booking(headers: dict = ALICE, workspace_id: str = "ws-protb") -> dict:
    """Helper to create a booking and return the response JSON."""
    # Alice doesn't have ws-protb in her grants — use Carol for that
    resp = client.post(
        "/v1/eva/bookings",
        json={
            "workspace_id": workspace_id,
            "start_date": "2026-05-01",
            "end_date": "2026-08-01",
        },
        headers=headers,
    )
    return resp.json(), resp.status_code


# ==================== WORKSPACE TESTS ====================


class TestWorkspaces:
    def test_list_returns_seeded_data(self):
        resp = client.get("/v1/eva/workspaces", headers=CAROL)
        assert resp.status_code == 200
        workspaces = resp.json()
        assert len(workspaces) == 5
        ids = {ws["id"] for ws in workspaces}
        assert ids == {"ws-protb", "ws-ocr", "ws-translation", "ws-summarization", "ws-general"}

    def test_list_filtered_by_grants(self):
        """Alice only has grants for ws-oas-act and ws-ei-juris, neither of which
        are in the new seed data, so she should see zero workspaces."""
        resp = client.get("/v1/eva/workspaces", headers=ALICE)
        assert resp.status_code == 200
        workspaces = resp.json()
        # Alice's grants (ws-oas-act, ws-ei-juris) don't match seed IDs
        assert len(workspaces) == 0

    def test_list_filtered_bob_sees_subset(self):
        """Bob has grant for ws-oas-act only, which is not in new seeds."""
        resp = client.get("/v1/eva/workspaces", headers=BOB)
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    def test_admin_sees_all(self):
        resp = client.get("/v1/eva/workspaces", headers=CAROL)
        assert resp.status_code == 200
        assert len(resp.json()) == 5

    def test_get_workspace_detail(self):
        resp = client.get("/v1/eva/workspaces/ws-protb", headers=CAROL)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "ws-protb"
        assert data["name"] == "Protected B Environment"
        assert data["data_classification"] == "protected_b"

    def test_workspace_not_found(self):
        resp = client.get("/v1/eva/workspaces/ws-nonexistent", headers=CAROL)
        assert resp.status_code == 404

    def test_workspace_access_denied(self):
        """Alice doesn't have ws-protb in her grants."""
        resp = client.get("/v1/eva/workspaces/ws-protb", headers=ALICE)
        assert resp.status_code == 403


# ==================== BOOKING TESTS ====================


class TestBookings:
    def test_create_booking_calculates_cost(self):
        resp = client.post(
            "/v1/eva/bookings",
            json={
                "workspace_id": "ws-ocr",
                "start_date": "2026-05-01",
                "end_date": "2026-07-01",
            },
            headers=CAROL,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["workspace_id"] == "ws-ocr"
        assert data["status"] == "pending"
        assert data["requester_id"] == "demo-carol"
        # ws-ocr monthly_cost=3500, weekly=875, ~8.7 weeks -> 9 weeks -> 7875
        assert data["weekly_cost"] == 875.0
        assert data["total_cost"] > 0

    def test_create_booking_workspace_not_found(self):
        resp = client.post(
            "/v1/eva/bookings",
            json={
                "workspace_id": "ws-nonexistent",
                "start_date": "2026-05-01",
                "end_date": "2026-08-01",
            },
            headers=CAROL,
        )
        assert resp.status_code == 404

    def test_create_booking_access_denied(self):
        """Alice doesn't have access to ws-protb."""
        resp = client.post(
            "/v1/eva/bookings",
            json={
                "workspace_id": "ws-protb",
                "start_date": "2026-05-01",
                "end_date": "2026-08-01",
            },
            headers=ALICE,
        )
        assert resp.status_code == 403

    def test_list_bookings_by_user(self):
        # Carol creates a booking
        client.post(
            "/v1/eva/bookings",
            json={"workspace_id": "ws-general", "start_date": "2026-05-01", "end_date": "2026-06-01"},
            headers=CAROL,
        )
        # Carol sees it
        resp = client.get("/v1/eva/bookings", headers=CAROL)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["requester_id"] == "demo-carol"

        # Alice sees nothing (her bookings are empty)
        resp = client.get("/v1/eva/bookings", headers=ALICE)
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    def test_booking_lifecycle_create_activate_complete(self):
        # Create
        create_resp = client.post(
            "/v1/eva/bookings",
            json={"workspace_id": "ws-general", "start_date": "2026-05-01", "end_date": "2026-08-01"},
            headers=CAROL,
        )
        assert create_resp.status_code == 201
        booking_id = create_resp.json()["id"]
        assert create_resp.json()["status"] == "pending"

        # Activate
        activate_resp = client.patch(
            f"/v1/eva/bookings/{booking_id}",
            json={"status": "active"},
            headers=CAROL,
        )
        assert activate_resp.status_code == 200
        data = activate_resp.json()
        assert data["status"] == "active"
        assert data["search_index_id"] is not None  # index provisioned
        assert data["search_index_id"].startswith("idx-")

        # Complete
        complete_resp = client.patch(
            f"/v1/eva/bookings/{booking_id}",
            json={"status": "completed"},
            headers=CAROL,
        )
        assert complete_resp.status_code == 200
        assert complete_resp.json()["status"] == "completed"

    def test_booking_invalid_transition(self):
        create_resp = client.post(
            "/v1/eva/bookings",
            json={"workspace_id": "ws-general", "start_date": "2026-05-01", "end_date": "2026-06-01"},
            headers=CAROL,
        )
        booking_id = create_resp.json()["id"]

        # pending -> completed is not valid (must go through active)
        resp = client.patch(
            f"/v1/eva/bookings/{booking_id}",
            json={"status": "completed"},
            headers=CAROL,
        )
        assert resp.status_code == 400

    def test_booking_cancellation(self):
        create_resp = client.post(
            "/v1/eva/bookings",
            json={"workspace_id": "ws-general", "start_date": "2026-05-01", "end_date": "2026-06-01"},
            headers=CAROL,
        )
        booking_id = create_resp.json()["id"]

        resp = client.delete(f"/v1/eva/bookings/{booking_id}", headers=CAROL)
        assert resp.status_code == 204

        # Verify it's cancelled
        list_resp = client.get("/v1/eva/bookings", headers=CAROL)
        bookings = list_resp.json()
        assert len(bookings) == 1
        assert bookings[0]["status"] == "cancelled"

    def test_booking_ownership_enforced(self):
        """Bob can't update Carol's booking."""
        create_resp = client.post(
            "/v1/eva/bookings",
            json={"workspace_id": "ws-general", "start_date": "2026-05-01", "end_date": "2026-06-01"},
            headers=CAROL,
        )
        booking_id = create_resp.json()["id"]

        resp = client.patch(
            f"/v1/eva/bookings/{booking_id}",
            json={"status": "active"},
            headers=BOB,
        )
        assert resp.status_code == 403


# ==================== TEAM TESTS ====================


class TestTeams:
    def _setup_booking(self) -> str:
        """Create a booking as Carol and return its ID."""
        resp = client.post(
            "/v1/eva/bookings",
            json={"workspace_id": "ws-general", "start_date": "2026-05-01", "end_date": "2026-08-01"},
            headers=CAROL,
        )
        return resp.json()["id"]

    def test_add_and_list_members(self):
        booking_id = self._setup_booking()

        # Add a member
        resp = client.post(
            f"/v1/eva/teams/{booking_id}/members",
            json={"email": "alice@demo.gc.ca", "name": "Alice Chen", "user_id": "demo-alice", "role": "contributor"},
            headers=CAROL,
        )
        assert resp.status_code == 201
        member = resp.json()
        assert member["role"] == "contributor"
        assert member["email"] == "alice@demo.gc.ca"

        # List members
        resp = client.get(f"/v1/eva/teams/{booking_id}/members", headers=CAROL)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_change_member_role(self):
        booking_id = self._setup_booking()

        # Add member
        client.post(
            f"/v1/eva/teams/{booking_id}/members",
            json={"email": "bob@demo.gc.ca", "name": "Bob Wilson", "user_id": "demo-bob", "role": "reader"},
            headers=CAROL,
        )

        # Update role
        resp = client.patch(
            f"/v1/eva/teams/{booking_id}/members/demo-bob",
            json={"role": "contributor"},
            headers=CAROL,
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "contributor"

    def test_remove_member(self):
        booking_id = self._setup_booking()

        # Add then remove
        client.post(
            f"/v1/eva/teams/{booking_id}/members",
            json={"email": "bob@demo.gc.ca", "name": "Bob Wilson", "user_id": "demo-bob", "role": "reader"},
            headers=CAROL,
        )
        resp = client.delete(f"/v1/eva/teams/{booking_id}/members/demo-bob", headers=CAROL)
        assert resp.status_code == 204

        # Verify removed
        resp = client.get(f"/v1/eva/teams/{booking_id}/members", headers=CAROL)
        assert len(resp.json()) == 0

    def test_non_admin_cannot_manage_team(self):
        booking_id = self._setup_booking()

        # Bob (reader, not admin, not booking owner) tries to add a member
        resp = client.post(
            f"/v1/eva/teams/{booking_id}/members",
            json={"email": "eve@demo.gc.ca", "name": "Eve Tremblay", "role": "reader"},
            headers=BOB,
        )
        assert resp.status_code == 403

    def test_invalid_role_rejected(self):
        booking_id = self._setup_booking()

        resp = client.post(
            f"/v1/eva/teams/{booking_id}/members",
            json={"email": "bob@demo.gc.ca", "name": "Bob", "role": "superadmin"},
            headers=CAROL,
        )
        assert resp.status_code == 400

    def test_team_member_can_list_members(self):
        """A team member (non-admin) should be able to list members."""
        booking_id = self._setup_booking()

        # Add Alice as contributor
        client.post(
            f"/v1/eva/teams/{booking_id}/members",
            json={"email": "alice@demo.gc.ca", "name": "Alice Chen", "user_id": "demo-alice", "role": "contributor"},
            headers=CAROL,
        )

        # Alice can list members
        resp = client.get(f"/v1/eva/teams/{booking_id}/members", headers=ALICE)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


# ==================== SURVEY TESTS ====================


class TestSurveys:
    def _setup_active_booking(self) -> str:
        """Create and activate a booking as Carol."""
        resp = client.post(
            "/v1/eva/bookings",
            json={"workspace_id": "ws-general", "start_date": "2026-05-01", "end_date": "2026-08-01"},
            headers=CAROL,
        )
        booking_id = resp.json()["id"]
        client.patch(
            f"/v1/eva/bookings/{booking_id}",
            json={"status": "active"},
            headers=CAROL,
        )
        return booking_id

    def test_entry_survey_creates_and_links(self):
        booking_id = self._setup_active_booking()

        resp = client.post(
            "/v1/eva/surveys/entry",
            json={
                "booking_id": booking_id,
                "use_case": "Document analysis for OAS claims",
                "expected_users": 10,
                "expected_data_volume_gb": 5.0,
                "data_classification": "protected_a",
                "business_justification": "Need AI-assisted review of claim documents",
            },
            headers=CAROL,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["booking_id"] == booking_id
        assert data["use_case"] == "Document analysis for OAS claims"
        assert data["id"].startswith("es-")

        # Verify booking was updated
        bookings = client.get("/v1/eva/bookings", headers=CAROL).json()
        bk = next(b for b in bookings if b["id"] == booking_id)
        assert bk["entry_survey_completed"] is True

    def test_entry_survey_duplicate_rejected(self):
        booking_id = self._setup_active_booking()

        payload = {
            "booking_id": booking_id,
            "use_case": "Test",
            "expected_users": 5,
            "expected_data_volume_gb": 1.0,
            "business_justification": "Testing",
        }
        resp1 = client.post("/v1/eva/surveys/entry", json=payload, headers=CAROL)
        assert resp1.status_code == 201

        resp2 = client.post("/v1/eva/surveys/entry", json=payload, headers=CAROL)
        assert resp2.status_code == 409

    def test_exit_survey_marks_booking_completed(self):
        booking_id = self._setup_active_booking()

        resp = client.post(
            "/v1/eva/surveys/exit",
            json={
                "booking_id": booking_id,
                "satisfaction_rating": 4,
                "objectives_met": True,
                "data_disposition": "archive",
                "feedback": "Great experience",
                "would_recommend": True,
            },
            headers=CAROL,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["booking_id"] == booking_id
        assert data["id"].startswith("xs-")

        # Verify booking is now completed
        bookings = client.get("/v1/eva/bookings", headers=CAROL).json()
        bk = next(b for b in bookings if b["id"] == booking_id)
        assert bk["status"] == "completed"
        assert bk["exit_survey_completed"] is True

    def test_survey_booking_not_found(self):
        resp = client.post(
            "/v1/eva/surveys/entry",
            json={
                "booking_id": "bk-nonexistent",
                "use_case": "Test",
                "expected_users": 1,
                "expected_data_volume_gb": 0.5,
                "business_justification": "Test",
            },
            headers=CAROL,
        )
        assert resp.status_code == 404

    def test_survey_ownership_enforced(self):
        """Bob can't submit a survey for Carol's booking."""
        booking_id = self._setup_active_booking()

        resp = client.post(
            "/v1/eva/surveys/entry",
            json={
                "booking_id": booking_id,
                "use_case": "Hijack",
                "expected_users": 1,
                "expected_data_volume_gb": 0.1,
                "business_justification": "Nope",
            },
            headers=BOB,
        )
        assert resp.status_code == 403
