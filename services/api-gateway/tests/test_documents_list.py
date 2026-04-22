"""Tests for GET /v1/aia/documents list endpoint (Phase F — closes #20)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

CAROL = {"x-demo-user-email": "carol@example.org"}  # admin, grants: all
BOB = {"x-demo-user-email": "bob@example.org"}  # reader, grants: ws-oas-act only
DAVE = {"x-demo-user-email": "dave@example.org"}  # admin, grants: all


@pytest.fixture
def client():
    """Use a context-managed TestClient so startup preload runs."""
    with TestClient(app) as c:
        yield c


_SKIP_REASON_NO_CORPUS = (
    "pending generic sample corpus — see BACKLOG.md §1. "
    "Country-specific fixtures (Benefits Act, the social benefits Act, tribunal decisions, faq-general) "
    "were removed in the opensource prep; the preload pipeline therefore loads "
    "zero documents, and these assertions on doc counts fail."
)


class TestListDocuments:
    @pytest.mark.skip(reason=_SKIP_REASON_NO_CORPUS)
    def test_returns_documents_for_admin(self, client: TestClient):
        resp = client.get("/v1/aia/documents", headers=CAROL)
        assert resp.status_code == 200
        docs = resp.json()
        assert len(docs) > 0
        first = docs[0]
        # Wire shape mirrors DocumentRecord
        assert {"id", "workspace_id", "file_name", "file_size", "status"} <= set(first)

    def test_sorted_newest_first(self, client: TestClient):
        docs = client.get("/v1/aia/documents", headers=CAROL).json()
        timestamps = [d["uploaded_at"] for d in docs]
        assert timestamps == sorted(timestamps, reverse=True)

    @pytest.mark.skip(reason=_SKIP_REASON_NO_CORPUS)
    def test_workspace_filter(self, client: TestClient):
        docs = client.get(
            "/v1/aia/documents?workspace_id=ws-faq", headers=CAROL
        ).json()
        assert len(docs) > 0
        assert all(d["workspace_id"] == "ws-faq" for d in docs)

    def test_workspace_filter_denied_returns_empty(self, client: TestClient):
        """Bob only has ws-oas-act — asking for ws-faq returns []."""
        resp = client.get(
            "/v1/aia/documents?workspace_id=ws-faq", headers=BOB
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_grant_filtered_default_scope(self, client: TestClient):
        """No workspace_id — bob only sees docs from ws-oas-act."""
        docs = client.get("/v1/aia/documents", headers=BOB).json()
        assert all(d["workspace_id"] == "ws-oas-act" for d in docs)

    def test_q_substring_match(self, client: TestClient):
        docs = client.get(
            "/v1/aia/documents?q=faq", headers=CAROL
        ).json()
        assert all("faq" in d["file_name"].lower() for d in docs)

    def test_kind_extension_filter(self, client: TestClient):
        docs = client.get(
            "/v1/aia/documents?kind=txt", headers=CAROL
        ).json()
        assert all(d["file_name"].lower().endswith(".txt") for d in docs)

    @pytest.mark.skip(reason=_SKIP_REASON_NO_CORPUS)
    def test_limit_caps_results(self, client: TestClient):
        docs = client.get("/v1/aia/documents?limit=1", headers=CAROL).json()
        assert len(docs) == 1

    def test_requires_auth(self, client: TestClient):
        resp = client.get("/v1/aia/documents")
        assert resp.status_code == 401
