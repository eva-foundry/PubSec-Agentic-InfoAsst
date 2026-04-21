"""Tests for the archetype catalog endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import archetype_store

CAROL = {"x-demo-user-email": "carol@example.org"}


@pytest.fixture(autouse=True)
def _reset_store():
    archetype_store.__init__()  # type: ignore[misc]
    yield


client = TestClient(app)


class TestArchetypesCatalog:
    def test_list_returns_five_seeded_archetypes(self):
        resp = client.get("/v1/aia/archetypes", headers=CAROL)
        assert resp.status_code == 200
        archetypes = resp.json()
        assert len(archetypes) == 5
        keys = {a["key"] for a in archetypes}
        assert keys == {"kb", "policy", "case", "bi", "decision"}

    def test_list_payload_shape(self):
        resp = client.get("/v1/aia/archetypes", headers=CAROL)
        assert resp.status_code == 200
        kb = next(a for a in resp.json() if a["key"] == "kb")
        assert kb["name"] == "Knowledge Base"
        assert kb["name_fr"] == "Base de connaissances"
        assert kb["assurance"] == "Advisory"
        assert kb["cost_band"].startswith("$")
        assert len(kb["sample_questions"]) >= 1
        assert len(kb["sample_questions_fr"]) >= 1
        assert kb["default_capacity"] > 0

    def test_decision_support_is_decision_informing(self):
        resp = client.get("/v1/aia/archetypes", headers=CAROL)
        decision = next(a for a in resp.json() if a["key"] == "decision")
        assert decision["assurance"] == "Decision-informing"

    def test_requires_auth(self):
        """No demo header → 401."""
        resp = client.get("/v1/aia/archetypes")
        assert resp.status_code == 401

    def test_get_by_key(self):
        resp = client.get("/v1/aia/archetypes/policy", headers=CAROL)
        assert resp.status_code == 200
        assert resp.json()["key"] == "policy"
        assert resp.json()["assurance"] == "Decision-informing"

    def test_get_unknown_key_returns_404(self):
        resp = client.get("/v1/aia/archetypes/not-a-real-key", headers=CAROL)
        assert resp.status_code == 404
