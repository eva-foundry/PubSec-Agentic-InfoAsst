"""Post-deploy smoke tests.

Run against a live `--base-url` (the api-gateway public FQDN). Hits four
high-signal endpoints that exercise Cosmos, the archetype catalog, and
the AIOps time-series we shipped in Phase F. Fails fast so `deploy.yml`
can block production promotion when staging is sick.

Usage::

    pytest tests/smoke/ --base-url=https://aia-api-gateway-staging.*.azurecontainerapps.io
"""

from __future__ import annotations

import httpx
import pytest


@pytest.fixture
def base_url(request):
    return request.config.getoption("--base-url").rstrip("/")


@pytest.fixture
def admin_headers():
    return {"x-demo-user-email": "carol@example.org"}


@pytest.fixture
def ops_headers():
    return {"x-demo-user-email": "dave@example.org"}


def test_health_endpoint(base_url: str):
    r = httpx.get(f"{base_url}/health", timeout=10.0)
    assert r.status_code == 200


def test_demo_login_returns_ops_persona(base_url: str):
    r = httpx.post(
        f"{base_url}/v1/aia/auth/demo/login",
        json={"email": "dave@example.org"},
        timeout=10.0,
    )
    assert r.status_code == 200
    body = r.json()
    assert "ops" in body["portal_access"]


def test_workspaces_seeded(base_url: str, admin_headers: dict):
    r = httpx.get(f"{base_url}/v1/aia/workspaces", headers=admin_headers, timeout=10.0)
    assert r.status_code == 200
    workspaces = r.json()
    assert len(workspaces) >= 5, f"expected ≥5 seeded workspaces, got {len(workspaces)}"


def test_aiops_timeseries_shape(base_url: str, ops_headers: dict):
    r = httpx.get(
        f"{base_url}/v1/aia/ops/metrics/aiops", headers=ops_headers, timeout=15.0
    )
    assert r.status_code == 200
    body = r.json()
    assert "timeseries" in body
    assert len(body["timeseries"]) == 14
    first = body["timeseries"][0]
    assert set(first) == {"day", "groundedness", "relevance", "coherence"}


def test_archetypes_catalog(base_url: str, admin_headers: dict):
    r = httpx.get(f"{base_url}/v1/aia/archetypes", headers=admin_headers, timeout=10.0)
    assert r.status_code == 200
    archetypes = r.json()
    assert len(archetypes) == 5
    keys = {a["key"] for a in archetypes}
    assert keys == {"kb", "policy", "case", "bi", "decision"}
