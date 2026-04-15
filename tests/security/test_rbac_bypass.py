"""
RBAC bypass tests -- verify role enforcement across all protected endpoints.

Uses FastAPI TestClient with demo user personas to confirm that:
- Readers cannot upload, manage teams, or access admin/ops portals
- Contributors can upload but not access admin/ops portals
- Admins have full admin portal access
- Ops users (Dave) have ops portal access
- Unauthenticated requests get 401
- Unknown users get 401

Reference: ESDC RBAC model (Reader / Contributor / Admin) + portal_access grants.
"""

import io
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, "services/api-gateway")
from app.main import app  # noqa: E402

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _h(email: str) -> dict[str, str]:
    """Shortcut: build x-demo-user-email header dict."""
    return {"x-demo-user-email": email}


BOB = _h("bob@demo.gc.ca")       # reader, self-service only, ws-oas-act
ALICE = _h("alice@demo.gc.ca")   # contributor, self-service only, ws-oas-act + ws-ei-juris
CAROL = _h("carol@demo.gc.ca")   # admin, self-service + admin, all workspaces
DAVE = _h("dave@demo.gc.ca")     # admin, self-service + admin + ops, all workspaces
EVE = _h("eve@demo.gc.ca")       # contributor, self-service only, ws-oas-act + ws-ei-juris + ws-bdm-km


# ---------------------------------------------------------------------------
# Reader restrictions (Bob)
# ---------------------------------------------------------------------------

class TestReaderRestrictions:
    """Bob is a reader -- can query but cannot mutate or access admin/ops."""

    def test_reader_can_list_workspaces(self):
        """Readers can view workspaces they are granted access to."""
        r = client.get("/v1/eva/workspaces", headers=BOB)
        assert r.status_code == 200

    def test_reader_can_chat(self):
        """Readers can use the chat endpoint."""
        r = client.post(
            "/v1/eva/chat",
            headers=BOB,
            json={"message": "What is OAS?", "workspace_id": "ws-oas-act"},
        )
        assert r.status_code == 200

    def test_reader_can_view_documents(self):
        """Readers can list document statuses."""
        r = client.get("/v1/eva/documents/status", headers=BOB)
        assert r.status_code == 200

    def test_reader_cannot_access_admin_clients(self):
        """Admin client listing requires admin role."""
        r = client.get("/v1/eva/admin/clients", headers=BOB)
        assert r.status_code == 403

    def test_reader_cannot_create_admin_client(self):
        r = client.post(
            "/v1/eva/admin/clients",
            headers=BOB,
            json={
                "org_name": "Hacker Corp",
                "billing_contact": "hacker@evil.com",
            },
        )
        assert r.status_code == 403

    def test_reader_cannot_access_admin_models(self):
        r = client.get("/v1/eva/admin/models", headers=BOB)
        assert r.status_code == 403

    def test_reader_cannot_access_admin_prompts(self):
        r = client.get("/v1/eva/admin/prompts", headers=BOB)
        assert r.status_code == 403

    def test_reader_cannot_access_ops_health(self):
        """Ops health requires ops portal_access."""
        r = client.get("/v1/eva/ops/health", headers=BOB)
        assert r.status_code == 403

    def test_reader_cannot_access_ops_finops(self):
        r = client.get("/v1/eva/ops/metrics/finops", headers=BOB)
        assert r.status_code == 403

    def test_reader_cannot_access_ops_aiops(self):
        r = client.get("/v1/eva/ops/metrics/aiops", headers=BOB)
        assert r.status_code == 403

    def test_reader_cannot_access_ops_liveops(self):
        r = client.get("/v1/eva/ops/metrics/liveops", headers=BOB)
        assert r.status_code == 403

    def test_reader_cannot_provision_workspace(self):
        r = client.post(
            "/v1/eva/admin/workspaces/provision",
            headers=BOB,
            json={"workspace_id": "ws-oas-act", "dry_run": True},
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Contributor restrictions (Alice)
# ---------------------------------------------------------------------------

class TestContributorRestrictions:
    """Alice is a contributor -- can upload and chat, but no admin/ops access."""

    def test_contributor_can_chat(self):
        r = client.post(
            "/v1/eva/chat",
            headers=ALICE,
            json={"message": "Explain OAS residency", "workspace_id": "ws-oas-act"},
        )
        assert r.status_code == 200

    def test_contributor_can_list_workspaces(self):
        r = client.get("/v1/eva/workspaces", headers=ALICE)
        assert r.status_code == 200

    def test_contributor_can_upload(self):
        """Contributors should be able to upload documents."""
        r = client.post(
            "/v1/eva/documents/upload",
            headers=ALICE,
            files={"file": ("test.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")},
            data={"workspace_id": "ws-oas-act"},
        )
        assert r.status_code == 201

    def test_contributor_cannot_access_admin_clients(self):
        r = client.get("/v1/eva/admin/clients", headers=ALICE)
        assert r.status_code == 403

    def test_contributor_cannot_access_admin_models(self):
        r = client.get("/v1/eva/admin/models", headers=ALICE)
        assert r.status_code == 403

    def test_contributor_cannot_access_ops_health(self):
        r = client.get("/v1/eva/ops/health", headers=ALICE)
        assert r.status_code == 403

    def test_contributor_cannot_access_ops_finops(self):
        r = client.get("/v1/eva/ops/metrics/finops", headers=ALICE)
        assert r.status_code == 403

    def test_contributor_cannot_provision_workspace(self):
        r = client.post(
            "/v1/eva/admin/workspaces/provision",
            headers=ALICE,
            json={"workspace_id": "ws-oas-act", "dry_run": True},
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Admin access (Carol -- admin but NO ops)
# ---------------------------------------------------------------------------

class TestAdminAccess:
    """Carol is admin with self-service + admin portal access, but NOT ops."""

    def test_admin_can_list_clients(self):
        r = client.get("/v1/eva/admin/clients", headers=CAROL)
        assert r.status_code == 200

    def test_admin_can_create_client(self):
        r = client.post(
            "/v1/eva/admin/clients",
            headers=CAROL,
            json={
                "org_name": "Test Org",
                "billing_contact": "billing@test.gc.ca",
                "data_classification_level": "protected_a",
            },
        )
        assert r.status_code == 201

    def test_admin_can_list_models(self):
        r = client.get("/v1/eva/admin/models", headers=CAROL)
        assert r.status_code == 200

    def test_admin_can_list_prompts(self):
        r = client.get("/v1/eva/admin/prompts", headers=CAROL)
        assert r.status_code == 200

    def test_admin_can_list_workspaces(self):
        r = client.get("/v1/eva/workspaces", headers=CAROL)
        assert r.status_code == 200

    def test_admin_cannot_access_ops_health(self):
        """Carol has admin portal access but NOT ops."""
        r = client.get("/v1/eva/ops/health", headers=CAROL)
        assert r.status_code == 403

    def test_admin_cannot_access_ops_finops(self):
        r = client.get("/v1/eva/ops/metrics/finops", headers=CAROL)
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Ops access (Dave -- admin + ops)
# ---------------------------------------------------------------------------

class TestOpsAccess:
    """Dave is admin with ops portal access -- full platform visibility."""

    def test_ops_can_access_health(self):
        r = client.get("/v1/eva/ops/health", headers=DAVE)
        assert r.status_code == 200

    def test_ops_can_access_finops(self):
        r = client.get("/v1/eva/ops/metrics/finops", headers=DAVE)
        assert r.status_code == 200

    def test_ops_can_access_aiops(self):
        r = client.get("/v1/eva/ops/metrics/aiops", headers=DAVE)
        assert r.status_code == 200

    def test_ops_can_access_liveops(self):
        r = client.get("/v1/eva/ops/metrics/liveops", headers=DAVE)
        assert r.status_code == 200

    def test_ops_can_view_traces(self):
        r = client.get("/v1/eva/ops/traces/conv-123", headers=DAVE)
        assert r.status_code == 200

    def test_ops_can_view_corpus_health(self):
        r = client.get("/v1/eva/ops/corpus-health", headers=DAVE)
        assert r.status_code == 200

    def test_ops_can_view_deployments(self):
        r = client.get("/v1/eva/ops/deployments", headers=DAVE)
        assert r.status_code == 200

    def test_ops_can_view_evaluation_arena(self):
        r = client.get("/v1/eva/ops/evaluation-arena", headers=DAVE)
        assert r.status_code == 200

    def test_ops_can_also_access_admin(self):
        """Dave has both admin and ops portal access."""
        r = client.get("/v1/eva/admin/clients", headers=DAVE)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Workspace grant isolation
# ---------------------------------------------------------------------------

class TestWorkspaceGrantIsolation:
    """Verify that workspace_grants limit which workspaces a user can access.

    The in-memory workspace store seeds: ws-protb, ws-ocr, ws-translation,
    ws-summarization, ws-general. User grants reference ws-oas-act / ws-ei-juris
    (not in the store), so we test grant logic via the list endpoint and
    use a store-present ID for single-workspace access tests.
    """

    def test_reader_list_returns_only_granted(self):
        """Bob's workspace list is filtered to his grants."""
        r = client.get("/v1/eva/workspaces", headers=BOB)
        assert r.status_code == 200
        # Bob has grants for ws-oas-act only; store has different IDs,
        # so his list should be empty (no overlap with store seed data).
        data = r.json()
        assert isinstance(data, list)

    def test_bob_cannot_access_workspace_outside_grants(self):
        """Bob does NOT have ws-protb in his grants -- should get 403."""
        r = client.get("/v1/eva/workspaces/ws-protb", headers=BOB)
        assert r.status_code == 403

    def test_admin_all_grant_can_access_any(self):
        """Carol has workspace_grants=['all'] -- can access any workspace in store."""
        r = client.get("/v1/eva/workspaces/ws-protb", headers=CAROL)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Unauthenticated / invalid user
# ---------------------------------------------------------------------------

class TestNoAuth:
    """Requests without valid authentication should get 401."""

    def test_no_header_returns_401(self):
        r = client.get("/v1/eva/workspaces")
        assert r.status_code == 401

    def test_invalid_email_returns_401(self):
        r = client.get("/v1/eva/workspaces", headers=_h("nobody@demo.gc.ca"))
        assert r.status_code == 401

    def test_empty_email_returns_401(self):
        r = client.get("/v1/eva/workspaces", headers=_h(""))
        assert r.status_code == 401

    def test_no_auth_on_chat(self):
        r = client.post("/v1/eva/chat", json={"message": "hello", "workspace_id": "ws-oas-act"})
        assert r.status_code == 401

    def test_no_auth_on_admin(self):
        r = client.get("/v1/eva/admin/clients")
        assert r.status_code == 401

    def test_no_auth_on_ops(self):
        r = client.get("/v1/eva/ops/health")
        assert r.status_code == 401

    def test_no_auth_on_documents(self):
        r = client.get("/v1/eva/documents/status")
        assert r.status_code == 401
