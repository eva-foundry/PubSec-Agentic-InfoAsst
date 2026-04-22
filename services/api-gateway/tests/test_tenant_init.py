"""Tests for POST /v1/aia/admin/tenants/init (Phase A — Onboarding wizard wiring)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import audit_store, client_store

CAROL = {"x-demo-user-email": "carol@example.org"}  # admin
BOB = {"x-demo-user-email": "bob@example.org"}  # reader


@pytest.fixture(autouse=True)
def _reset():
    client_store.__init__()  # type: ignore[misc]
    audit_store.__init__()  # type: ignore[misc]
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


BODY = {
    "org_name": "Acme Public Sector",
    "region": "eastus",
    "industry": "Financial services",
    "primary_admin_email": "admin@example.org",
    "default_classification": "restricted",
    "classification_notes": "PII redacted at ingest",
    "default_mode": "Decision-informing",
    "hitl_threshold": "confidence < 0.75",
    "preferred_archetype": "policy",
    "initial_corpus_hint": "s3://acme-docs/handbook",
    "idp_group_admin": "okta-aia-admins",
    "idp_group_contributor": "okta-aia-editors",
    "idp_group_reader": "okta-aia-viewers",
    "invitees": ["alice@example.org", "bob@example.org"],
    "pilot_question": "What is our parental leave policy?",
}


class TestTenantInit:
    def test_creates_client_and_interview(self, client: TestClient):
        resp = client.post(
            "/v1/aia/admin/tenants/init", headers=CAROL, json=BODY
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["client_id"].startswith("cl-")
        assert body["interview_id"].startswith("iv-")
        assert body["status"] == "initialized"

    def test_non_admin_is_forbidden(self, client: TestClient):
        resp = client.post(
            "/v1/aia/admin/tenants/init", headers=BOB, json=BODY
        )
        assert resp.status_code == 403

    def test_invalid_classification_returns_422(self, client: TestClient):
        resp = client.post(
            "/v1/aia/admin/tenants/init",
            headers=CAROL,
            json={**BODY, "default_classification": "secret"},
        )
        assert resp.status_code == 422

    def test_invalid_mode_returns_422(self, client: TestClient):
        resp = client.post(
            "/v1/aia/admin/tenants/init",
            headers=CAROL,
            json={**BODY, "default_mode": "Freestyle"},
        )
        assert resp.status_code == 422

    def test_audit_trail_recorded(self, client: TestClient):
        client.post("/v1/aia/admin/tenants/init", headers=CAROL, json=BODY)
        entries = audit_store.query(action="tenant.init")
        assert len(entries) == 1
        assert entries[0].subject == "Acme Public Sector"
        assert entries[0].decision == "allow"

    def test_decision_informing_maps_to_rai_level_2(self, client: TestClient):
        resp = client.post(
            "/v1/aia/admin/tenants/init",
            headers=CAROL,
            json={**BODY, "default_mode": "Decision-informing"},
        )
        iv_id = resp.json()["interview_id"]
        cl_id = resp.json()["client_id"]
        interviews = client_store.get_interviews_by_client(cl_id)
        matching = [i for i in interviews if i.id == iv_id]
        assert len(matching) == 1
        assert matching[0].rai_assessment == "level_2"
