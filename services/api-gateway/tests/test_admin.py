"""Tests for admin endpoints: client onboarding, interviews, provisioning, models, prompts."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import (
    booking_store,
    client_store,
    model_registry_store,
    prompt_store,
    team_store,
    workspace_store,
)

client = TestClient(app)

# Demo user headers
CAROL = {"x-demo-user-email": "carol@demo.gc.ca"}  # admin
ALICE = {"x-demo-user-email": "alice@demo.gc.ca"}  # contributor (non-admin)


@pytest.fixture(autouse=True)
def _reset_stores():
    """Reset all stores to clean seed state before each test."""
    client_store.__init__()  # type: ignore[misc]
    model_registry_store.__init__()  # type: ignore[misc]
    prompt_store.__init__()  # type: ignore[misc]
    workspace_store.__init__()  # type: ignore[misc]
    booking_store.__init__()  # type: ignore[misc]
    team_store.__init__()  # type: ignore[misc]
    yield


# ==================== AUTH TESTS ====================


class TestAdminAuth:
    def test_non_admin_gets_403(self):
        resp = client.get("/v1/eva/admin/clients", headers=ALICE)
        assert resp.status_code == 403
        assert "Admin role required" in resp.json()["detail"]

    def test_admin_gets_200(self):
        resp = client.get("/v1/eva/admin/clients", headers=CAROL)
        assert resp.status_code == 200


# ==================== CLIENT TESTS ====================


class TestClients:
    def test_list_returns_seeded_clients(self):
        resp = client.get("/v1/eva/admin/clients", headers=CAROL)
        assert resp.status_code == 200
        clients = resp.json()
        assert len(clients) == 2
        ids = {c["id"] for c in clients}
        assert "client-bdm" in ids
        assert "client-sco" in ids

    def test_list_clients_includes_computed_metrics(self):
        resp = client.get("/v1/eva/admin/clients", headers=CAROL)
        assert resp.status_code == 200
        clients = resp.json()

        bdm = next(c for c in clients if c["id"] == "client-bdm")
        assert bdm["workspaces_count"] == 3
        assert bdm["query_count"] > 0
        assert bdm["document_count"] > 0
        assert bdm["last_active"] is not None

        sco = next(c for c in clients if c["id"] == "client-sco")
        assert sco["workspaces_count"] == 1

    def test_onboard_client_creates_client(self):
        resp = client.post(
            "/v1/eva/admin/clients",
            json={
                "org_name": "Test Organization",
                "billing_contact": "test@esdc.gc.ca",
                "data_classification_level": "protected_a",
            },
            headers=CAROL,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["org_name"] == "Test Organization"
        assert data["status"] == "active"
        assert data["id"].startswith("cl-")

        # Verify persisted
        resp2 = client.get("/v1/eva/admin/clients", headers=CAROL)
        assert len(resp2.json()) == 3

    def test_get_client_by_id(self):
        resp = client.get("/v1/eva/admin/clients/client-bdm", headers=CAROL)
        assert resp.status_code == 200
        assert resp.json()["org_name"] == "Benefits Delivery Modernization"

    def test_get_client_404(self):
        resp = client.get("/v1/eva/admin/clients/cl-nonexistent", headers=CAROL)
        assert resp.status_code == 404

    def test_update_client(self):
        resp = client.patch(
            "/v1/eva/admin/clients/client-bdm",
            json={"status": "suspended"},
            headers=CAROL,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "suspended"

        # Verify persisted
        resp2 = client.get("/v1/eva/admin/clients/client-bdm", headers=CAROL)
        assert resp2.json()["status"] == "suspended"


# ==================== INTERVIEW TESTS ====================


class TestInterviews:
    def test_interview_creates_with_archetype_legislation(self):
        resp = client.post(
            "/v1/eva/admin/interviews",
            json={
                "client_id": "client-bdm",
                "use_case_description": "Analyze the Employment Insurance Act and related regulations",
                "data_sources": ["legislation-db", "gazette"],
                "expected_volume": "500 documents",
                "compliance_requirements": "Protected B",
            },
            headers=CAROL,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["archetype_recommendation"] == "legislation"
        assert data["client_id"] == "client-bdm"
        assert data["id"].startswith("iv-")

    def test_interview_creates_with_archetype_case_law(self):
        resp = client.post(
            "/v1/eva/admin/interviews",
            json={
                "client_id": "client-bdm",
                "use_case_description": "Search tribunal decisions and court rulings for EI appeals",
                "data_sources": ["canlii"],
            },
            headers=CAROL,
        )
        assert resp.status_code == 201
        assert resp.json()["archetype_recommendation"] == "case_law"

    def test_interview_creates_with_archetype_default(self):
        resp = client.post(
            "/v1/eva/admin/interviews",
            json={
                "client_id": "client-bdm",
                "use_case_description": "General document search and summarization",
                "data_sources": ["sharepoint"],
            },
            headers=CAROL,
        )
        assert resp.status_code == 201
        assert resp.json()["archetype_recommendation"] == "default"

    def test_interview_404_unknown_client(self):
        resp = client.post(
            "/v1/eva/admin/interviews",
            json={
                "client_id": "cl-nonexistent",
                "use_case_description": "Test",
            },
            headers=CAROL,
        )
        assert resp.status_code == 404

    def test_list_interviews_by_client(self):
        # Create an interview first
        client.post(
            "/v1/eva/admin/interviews",
            json={
                "client_id": "client-bdm",
                "use_case_description": "Test use case",
            },
            headers=CAROL,
        )
        resp = client.get("/v1/eva/admin/clients/client-bdm/interviews", headers=CAROL)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


# ==================== WORKSPACE PROVISIONING TESTS ====================


class TestWorkspaceProvisioning:
    def test_provision_dry_run_returns_plan(self):
        resp = client.post(
            "/v1/eva/admin/workspaces/provision",
            json={"workspace_id": "ws-oas-act", "dry_run": True},
            headers=CAROL,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "preview"
        assert "plan" in data
        plan = data["plan"]
        assert len(plan["resources"]) == 3
        assert plan["estimated_monthly_cost"].startswith("$")

    def test_provision_confirm_changes_status(self):
        # Set workspace to draft first
        workspace_store.update("ws-oas-act", {"status": "draft"})

        resp = client.post(
            "/v1/eva/admin/workspaces/provision",
            json={"workspace_id": "ws-oas-act", "dry_run": False},
            headers=CAROL,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "provisioning"
        assert data["workspace"]["status"] == "active"

    def test_provision_404_unknown_workspace(self):
        resp = client.post(
            "/v1/eva/admin/workspaces/provision",
            json={"workspace_id": "ws-nonexistent"},
            headers=CAROL,
        )
        assert resp.status_code == 404

    def test_decommission_dry_run_returns_plan(self):
        resp = client.post(
            "/v1/eva/admin/workspaces/ws-oas-act/decommission?dry_run=true",
            headers=CAROL,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "preview"
        plan = data["plan"]
        assert "safety_gates" in plan
        assert len(plan["safety_gates"]) > 0
        assert plan["documents_to_delete"] == 4  # matches seed data

    def test_decommission_confirm_archives(self):
        resp = client.post(
            "/v1/eva/admin/workspaces/ws-oas-act/decommission?dry_run=false",
            headers=CAROL,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "decommissioned"
        assert data["workspace"]["status"] == "archived"

    def test_workspace_resources(self):
        resp = client.get("/v1/eva/admin/workspaces/ws-oas-act/resources", headers=CAROL)
        assert resp.status_code == 200
        data = resp.json()
        assert data["workspace_id"] == "ws-oas-act"
        assert "ai_search_index" in data["resources"]


# ==================== MODEL REGISTRY TESTS ====================


class TestModelRegistry:
    def test_list_seeded_models(self):
        resp = client.get("/v1/eva/admin/models", headers=CAROL)
        assert resp.status_code == 200
        models = resp.json()
        assert len(models) == 4
        names = {m["model_name"] for m in models}
        assert "gpt-5-mini" in names
        assert "gpt-5.1" in names
        assert "text-embedding-ada-002" in names
        assert "text-embedding-3-large" in names

    def test_get_model(self):
        resp = client.get("/v1/eva/admin/models/model-gpt5-mini", headers=CAROL)
        assert resp.status_code == 200
        assert resp.json()["model_name"] == "gpt-5-mini"

    def test_toggle_model_disables(self):
        resp = client.post(
            "/v1/eva/admin/models/model-gpt5-mini/toggle?is_active=false",
            headers=CAROL,
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

        # Verify persisted
        resp2 = client.get("/v1/eva/admin/models/model-gpt5-mini", headers=CAROL)
        assert resp2.json()["is_active"] is False

    def test_toggle_model_enables(self):
        # Disable then re-enable
        client.post(
            "/v1/eva/admin/models/model-gpt5-mini/toggle?is_active=false",
            headers=CAROL,
        )
        resp = client.post(
            "/v1/eva/admin/models/model-gpt5-mini/toggle?is_active=true",
            headers=CAROL,
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

    def test_update_model(self):
        resp = client.patch(
            "/v1/eva/admin/models/model-gpt5-mini",
            json={"parameter_overrides": {"temperature": 0.5}},
            headers=CAROL,
        )
        assert resp.status_code == 200
        assert resp.json()["parameter_overrides"]["temperature"] == 0.5

    def test_model_404(self):
        resp = client.get("/v1/eva/admin/models/model-nonexistent", headers=CAROL)
        assert resp.status_code == 404


# ==================== PROMPT MANAGEMENT TESTS ====================


class TestPrompts:
    def test_list_seeded_prompts(self):
        resp = client.get("/v1/eva/admin/prompts", headers=CAROL)
        assert resp.status_code == 200
        prompts = resp.json()
        assert len(prompts) == 3
        names = {p["prompt_name"] for p in prompts}
        assert names == {"rag-system", "ungrounded-system", "query-rewrite"}

    def test_get_prompt_versions(self):
        resp = client.get("/v1/eva/admin/prompts/rag-system/versions", headers=CAROL)
        assert resp.status_code == 200
        versions = resp.json()
        assert len(versions) == 1
        assert versions[0]["version"] == 1
        assert versions[0]["is_active"] is True

    def test_create_prompt_version(self):
        resp = client.post(
            "/v1/eva/admin/prompts/rag-system/versions",
            json={
                "content": "Updated RAG prompt with better citation format.",
                "rationale": "Improved citation accuracy",
            },
            headers=CAROL,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["version"] == 2
        assert data["is_active"] is True
        assert data["author"] == "demo-carol"

        # Check that version 1 is now inactive
        resp2 = client.get("/v1/eva/admin/prompts/rag-system/versions", headers=CAROL)
        versions = resp2.json()
        assert len(versions) == 2
        v1 = next(v for v in versions if v["version"] == 1)
        v2 = next(v for v in versions if v["version"] == 2)
        assert v1["is_active"] is False
        assert v2["is_active"] is True

    def test_prompt_rollback_activates_older_version(self):
        # Create v2 first
        client.post(
            "/v1/eva/admin/prompts/rag-system/versions",
            json={"content": "Version 2 content", "rationale": "v2"},
            headers=CAROL,
        )
        # Rollback to v1
        resp = client.post(
            "/v1/eva/admin/prompts/rag-system/rollback?target_version=1",
            headers=CAROL,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == 1
        assert data["is_active"] is True

        # Verify v2 is now inactive
        resp2 = client.get("/v1/eva/admin/prompts/rag-system/versions", headers=CAROL)
        versions = resp2.json()
        v2 = next(v for v in versions if v["version"] == 2)
        assert v2["is_active"] is False

    def test_prompt_rollback_404(self):
        resp = client.post(
            "/v1/eva/admin/prompts/rag-system/rollback?target_version=99",
            headers=CAROL,
        )
        assert resp.status_code == 404

    def test_create_new_prompt_name(self):
        resp = client.post(
            "/v1/eva/admin/prompts/custom-prompt/versions",
            json={"content": "Custom prompt content", "rationale": "New prompt"},
            headers=CAROL,
        )
        assert resp.status_code == 201
        assert resp.json()["version"] == 1
        assert resp.json()["prompt_name"] == "custom-prompt"


# ==================== BOOKING MANAGEMENT TESTS ====================


class TestBookingManagement:
    def _create_booking(self) -> str:
        """Helper: create a booking via the booking store directly."""
        from app.models.workspace import Booking

        bk = Booking(
            id="bk-test-001",
            workspace_id="ws-oas-act",
            requester_id="demo-alice",
            status="pending",
            start_date="2026-05-01",
            end_date="2026-08-01",
            created_at="2026-04-14T00:00:00Z",
            updated_at="2026-04-14T00:00:00Z",
        )
        booking_store.create(bk)
        return bk.id

    def test_list_all_bookings(self):
        # Seeded bookings exist + create one more
        self._create_booking()
        resp = client.get("/v1/eva/admin/bookings", headers=CAROL)
        assert resp.status_code == 200
        bookings = resp.json()
        # 3 seeded + 1 created = 4
        assert len(bookings) == 4
        test_bk = next(b for b in bookings if b["id"] == "bk-test-001")
        assert "workspace_name" in test_bk

    def test_approve_booking_changes_status(self):
        bk_id = self._create_booking()
        resp = client.patch(
            f"/v1/eva/admin/bookings/{bk_id}?action=approve",
            headers=CAROL,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["action"] == "approve"
        assert data["booking"]["status"] == "active"

    def test_reject_booking(self):
        bk_id = self._create_booking()
        resp = client.patch(
            f"/v1/eva/admin/bookings/{bk_id}?action=reject",
            headers=CAROL,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

    def test_approve_booking_404(self):
        resp = client.patch(
            "/v1/eva/admin/bookings/bk-nonexistent?action=approve",
            headers=CAROL,
        )
        assert resp.status_code == 404

    def test_invalid_action_400(self):
        bk_id = self._create_booking()
        resp = client.patch(
            f"/v1/eva/admin/bookings/{bk_id}?action=invalid",
            headers=CAROL,
        )
        assert resp.status_code == 400


# ==================== VALVE TESTS ====================


class TestValves:
    def test_update_valves(self):
        resp = client.patch(
            "/v1/eva/admin/workspaces/ws-oas-act/valves",
            json={"valves": {"temperature": 0.2, "top_k": 10}},
            headers=CAROL,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["valves"]["temperature"] == 0.2
        assert data["status"] == "updated"

    def test_update_valves_404(self):
        resp = client.patch(
            "/v1/eva/admin/workspaces/ws-nonexistent/valves",
            json={"valves": {"temperature": 0.2}},
            headers=CAROL,
        )
        assert resp.status_code == 404
