"""Tests for real token-count capture + chat telemetry recording."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import telemetry_store

DAVE = {"x-demo-user-email": "dave@example.org"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _drain(resp):
    return b"".join(resp.iter_bytes())


class TestChatRealTokens:
    def test_chat_records_telemetry_with_nonzero_tokens(self, client: TestClient):
        """The chat endpoint owns telemetry for /v1/aia/chat and must record
        real (non-heuristic) token counts derived from the model client's
        last_usage. Under mock mode the counts come from MockModelClient's
        length-based synthesis, which is non-zero for any non-empty input."""
        baseline = len(telemetry_store._records)  # type: ignore[attr-defined]

        resp = client.post(
            "/v1/aia/chat",
            headers={**DAVE, "x-app-id": "portal-unified"},
            json={"message": "What is the OAS eligibility age?", "mode": "grounded"},
        )
        assert resp.status_code == 200
        _drain(resp)

        records = telemetry_store._records  # type: ignore[attr-defined]
        assert len(records) > baseline
        chat_records = [r for r in records[baseline:] if r.operation == "/v1/aia/chat"]
        assert len(chat_records) == 1
        rec = chat_records[0]
        # Real usage, not the old 800/600 heuristic.
        assert rec.prompt_tokens > 0
        assert rec.completion_tokens > 0
        assert (rec.prompt_tokens, rec.completion_tokens) != (800, 600)
        assert rec.total_tokens == rec.prompt_tokens + rec.completion_tokens
        assert rec.client_id == "portal-unified"
        assert rec.deployment == "chat-default"

    def test_non_chat_request_still_records_minimal_telemetry(
        self, client: TestClient
    ):
        """Middleware still records a 50/0 embeddings-like telemetry entry for
        non-chat paths so FinOps rollups keep seeing request traffic."""
        baseline = len(telemetry_store._records)  # type: ignore[attr-defined]
        resp = client.get("/v1/aia/workspaces", headers=DAVE)
        assert resp.status_code == 200
        records = telemetry_store._records  # type: ignore[attr-defined]
        assert len(records) == baseline + 1
        rec = records[-1]
        assert rec.deployment == "embeddings-default"
        assert rec.prompt_tokens == 50
        assert rec.completion_tokens == 0
