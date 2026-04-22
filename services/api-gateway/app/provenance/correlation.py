from __future__ import annotations

import uuid


def generate_correlation_id() -> str:
    """Generate a new UUID v4 correlation ID for request tracing."""
    return str(uuid.uuid4())


def get_correlation_id_from_headers(headers: dict[str, str]) -> str | None:
    """Extract a correlation ID from incoming request headers.

    Looks for the ``x-correlation-id`` header (case-insensitive).
    Returns ``None`` if not present.
    """
    # FastAPI/Starlette headers are case-insensitive, but plain dicts are not.
    for key, value in headers.items():
        if key.lower() == "x-correlation-id":
            return value
    return None
