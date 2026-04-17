"""Shared test fixtures for the api-gateway test suite."""

from __future__ import annotations

from collections.abc import Generator

import pytest


@pytest.fixture(autouse=True, scope="session")
def _test_content_safety_endpoint() -> Generator[None, None, None]:
    """Ensure ContentSafetyChecker thinks a Content Safety endpoint is configured.

    The real module inspects app.config.settings at construction time and skips
    the Azure client wiring entirely when endpoint/key are empty. Tests that
    rely on ``patch('app.guardrails.content_safety.ContentSafetyClient')`` to
    intercept calls need those settings to be truthy; otherwise __init__ never
    calls the mocked class and the checker falls back to pass-through mode.
    """
    from app.config import settings

    original_endpoint = settings.content_safety_endpoint
    original_key = settings.content_safety_key
    settings.content_safety_endpoint = "https://fake-content-safety.test"
    settings.content_safety_key = "fake-key-for-tests"
    yield
    settings.content_safety_endpoint = original_endpoint
    settings.content_safety_key = original_key
