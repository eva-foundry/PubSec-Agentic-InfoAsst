"""Tests for the Red-Team adversarial evaluation runner (Phase F — closes #15)."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stores import eval_run_store

DAVE = {"x-demo-user-email": "dave@demo.gc.ca"}  # ops
ALICE = {"x-demo-user-email": "alice@demo.gc.ca"}  # no ops


@pytest.fixture(autouse=True)
def _reset_store():
    eval_run_store.__init__()  # type: ignore[misc]
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


BODY = {
    "test_set_id": "ts1",
    "categories": ["injection", "pii"],
    "workspace_id": "ws-oas-act",
}


class TestStartEval:
    def test_returns_run_id_and_queued_status(self, client: TestClient):
        resp = client.post("/v1/eva/ops/eval/challenges", headers=DAVE, json=BODY)
        assert resp.status_code == 200
        body = resp.json()
        assert body["run_id"].startswith("run-")
        assert body["status"] == "queued"
        # 8 probes/category * 2 categories
        assert body["total_probes"] == 16

    def test_requires_ops(self, client: TestClient):
        resp = client.post(
            "/v1/eva/ops/eval/challenges", headers=ALICE, json=BODY
        )
        assert resp.status_code == 403

    def test_invalid_categories_returns_422(self, client: TestClient):
        resp = client.post(
            "/v1/eva/ops/eval/challenges",
            headers=DAVE,
            json={**BODY, "categories": ["not-a-real-category"]},
        )
        assert resp.status_code == 422

    def test_empty_categories_returns_422(self, client: TestClient):
        resp = client.post(
            "/v1/eva/ops/eval/challenges",
            headers=DAVE,
            json={**BODY, "categories": []},
        )
        assert resp.status_code == 422


class TestStreamResults:
    def test_streams_probe_events_then_complete(self, client: TestClient):
        start = client.post(
            "/v1/eva/ops/eval/challenges", headers=DAVE, json=BODY
        ).json()
        run_id = start["run_id"]
        resp = client.get(
            f"/v1/eva/ops/eval/results?run_id={run_id}", headers=DAVE
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/x-ndjson")
        lines = [ln for ln in resp.text.split("\n") if ln.strip()]
        assert len(lines) == 17  # 16 probes + 1 complete
        events = [json.loads(ln) for ln in lines]
        assert all(e["type"] == "probe" for e in events[:-1])
        assert events[-1]["type"] == "complete"
        assert events[-1]["run_id"] == run_id
        assert events[-1]["total"] == 16
        assert events[-1]["passed"] + events[-1]["failed"] + events[-1]["flagged"] == 16

    def test_probe_event_shape(self, client: TestClient):
        start = client.post(
            "/v1/eva/ops/eval/challenges", headers=DAVE, json=BODY
        ).json()
        resp = client.get(
            f"/v1/eva/ops/eval/results?run_id={start['run_id']}", headers=DAVE
        )
        first = json.loads(resp.text.split("\n")[0])
        assert set(first) == {
            "type", "id", "run_id", "category", "prompt", "result", "ms",
        }
        assert first["result"] in {"pass", "fail", "flag"}

    def test_unknown_run_returns_404(self, client: TestClient):
        resp = client.get(
            "/v1/eva/ops/eval/results?run_id=run-ghost", headers=DAVE
        )
        assert resp.status_code == 404

    def test_requires_ops(self, client: TestClient):
        start = client.post(
            "/v1/eva/ops/eval/challenges", headers=DAVE, json=BODY
        ).json()
        resp = client.get(
            f"/v1/eva/ops/eval/results?run_id={start['run_id']}", headers=ALICE
        )
        assert resp.status_code == 403

    def test_stream_is_deterministic(self, client: TestClient):
        """Two runs with identical inputs produce different run_ids but same
        distributions (seed mixes run_id, so counts may vary). Instead assert
        the same run_id streams identical events on replay."""
        start = client.post(
            "/v1/eva/ops/eval/challenges", headers=DAVE, json=BODY
        ).json()
        rid = start["run_id"]
        a = client.get(
            f"/v1/eva/ops/eval/results?run_id={rid}", headers=DAVE
        ).text
        b = client.get(
            f"/v1/eva/ops/eval/results?run_id={rid}", headers=DAVE
        ).text
        assert a == b
