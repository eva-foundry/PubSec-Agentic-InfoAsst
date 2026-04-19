"""Tests for POST /v1/eva/workspaces (Phase A — Catalog wizard wiring)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import archetype_store, audit_store, workspace_store

CAROL = {"x-demo-user-email": "carol@demo.gc.ca"}  # admin, protected_b
ALICE = {"x-demo-user-email": "alice@demo.gc.ca"}  # contributor, protected_b
BOB = {"x-demo-user-email": "bob@demo.gc.ca"}  # reader
EVE = {"x-demo-user-email": "eve@demo.gc.ca"}  # contributor, protected_a (if exists)


@pytest.fixture(autouse=True)
def _reset():
    workspace_store.__init__()  # type: ignore[misc]
    archetype_store.__init__()  # type: ignore[misc]
    audit_store.__init__()  # type: ignore[misc]
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


BODY = {
    "name": "Policy Library — HR",
    "archetype": "policy",
    "data_classification": "protected_a",
}


class TestCreateWorkspace:
    def test_admin_can_create(self, client: TestClient):
        resp = client.post("/v1/eva/workspaces", headers=CAROL, json=BODY)
        assert resp.status_code == 201
        body = resp.json()
        assert body["id"].startswith("ws-")
        assert body["name"] == "Policy Library — HR"
        assert body["archetype"] == "policy"
        assert body["status"] == "draft"
        assert body["owner_id"] == "demo-carol"
        # Default capacity comes from the archetype seed.
        assert body["document_capacity"] > 0

    def test_contributor_can_create(self, client: TestClient):
        resp = client.post("/v1/eva/workspaces", headers=ALICE, json=BODY)
        assert resp.status_code == 201

    def test_reader_is_forbidden(self, client: TestClient):
        resp = client.post("/v1/eva/workspaces", headers=BOB, json=BODY)
        assert resp.status_code == 403

    def test_anon_is_unauthorized(self, client: TestClient):
        resp = client.post("/v1/eva/workspaces", json=BODY)
        assert resp.status_code == 401

    def test_unknown_archetype_returns_422(self, client: TestClient):
        resp = client.post(
            "/v1/eva/workspaces",
            headers=CAROL,
            json={**BODY, "archetype": "not-a-thing"},
        )
        assert resp.status_code == 422

    def test_invalid_classification_returns_422(self, client: TestClient):
        resp = client.post(
            "/v1/eva/workspaces",
            headers=CAROL,
            json={**BODY, "data_classification": "ultra-secret"},
        )
        assert resp.status_code == 422

    def test_new_workspace_appears_in_list(self, client: TestClient):
        created = client.post(
            "/v1/eva/workspaces", headers=CAROL, json=BODY
        ).json()
        listed = client.get("/v1/eva/workspaces", headers=CAROL).json()
        ids = {ws["id"] for ws in listed}
        assert created["id"] in ids

    def test_audit_trail_recorded(self, client: TestClient):
        client.post("/v1/eva/workspaces", headers=CAROL, json=BODY)
        entries = audit_store.query(action="workspace.create")
        assert len(entries) >= 1
        assert entries[0].actor == "demo-carol"

    def test_empty_name_rejected(self, client: TestClient):
        resp = client.post(
            "/v1/eva/workspaces", headers=CAROL, json={**BODY, "name": ""}
        )
        assert resp.status_code == 422
