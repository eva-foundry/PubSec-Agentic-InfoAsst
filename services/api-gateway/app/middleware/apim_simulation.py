"""APIM simulation middleware — adds correlation IDs, cost tracking, session cookies.

In production, Azure API Management provides these headers natively.
This middleware simulates the same behavior for local dev and demo,
so the UI and FinOps dashboard work identically in both environments.
"""

from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from ..stores import telemetry_store, workspace_store
from ..stores.compat import aio
from ..stores.telemetry_store import APIMTelemetryRecord


async def _cost_centre_for(workspace_id: str) -> str:
    """Resolve a workspace's cost-centre (or '' if none / not found)."""
    if not workspace_id:
        return ""
    try:
        ws = await aio(workspace_store.get(workspace_id))
    except Exception:
        return ""
    return (ws.cost_centre or "") if ws else ""


class APIMSimulationMiddleware(BaseHTTPMiddleware):
    """Simulate Azure APIM gateway headers and telemetry recording."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.monotonic()

        # --- Correlation ID ---
        correlation_id = request.headers.get("x-correlation-id") or str(uuid.uuid4())

        # --- Session ID (from cookie or generate new) ---
        session_id = request.cookies.get("eva_session_id") or str(uuid.uuid4())
        set_cookie = "eva_session_id" not in request.cookies

        # --- Workspace ID (optional, from header) ---
        workspace_id = request.headers.get("x-workspace-id", "")

        # --- Cost-attribution headers from the frontend (Phase E) ---
        # Frontend injects these via ApiProvider.getHeaderContext so FinOps
        # rollups attribute spend to the right app / user group / classification.
        client_app_id = request.headers.get("x-app-id", "aia-agentic")
        user_group = request.headers.get("x-user-group", "")
        classification = request.headers.get("x-classification", "")

        # Execute the actual request
        response = await call_next(request)

        elapsed_ms = int((time.monotonic() - start) * 1000)

        # --- Set APIM response headers ---
        response.headers["x-correlation-id"] = correlation_id
        response.headers["x-app-id"] = "aia-agentic"
        response.headers["x-request-duration-ms"] = str(elapsed_ms)

        # --- Set session cookie if new ---
        if set_cookie:
            response.set_cookie(
                key="eva_session_id",
                value=session_id,
                httponly=False,  # JS needs to read it
                samesite="lax",
                max_age=86400,  # 24 hours
            )

        # --- Record telemetry for API calls (skip health/static) ---
        # The chat endpoint records its own telemetry post-stream with real
        # token counts from Azure OpenAI; skip the heuristic here to avoid
        # double-counting.
        path = request.url.path
        is_chat = path.startswith("/v1/aia/chat") and not path.endswith("/feedback")
        if path.startswith("/v1/aia/") and request.method in ("POST", "GET") and not is_chat:
            # Non-chat requests (workspaces, admin, ops) bill only for the
            # small embeddings-like overhead — no chat completion fired.
            prompt_tokens = 50
            completion_tokens = 0
            deployment = "embeddings-default"
            model_name = "text-embedding-3-small"
            cost = 0.0

            cost_centre = await _cost_centre_for(workspace_id)
            record = APIMTelemetryRecord(
                correlation_id=correlation_id,
                workspace_id=workspace_id,
                session_id=session_id,
                client_id=client_app_id,
                deployment=deployment,
                model_name=model_name,
                operation=path,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                latency_ms=elapsed_ms,
                cost_cad=cost,
                status_code=response.status_code,
                user_group=user_group,
                classification=classification,
                cost_centre=cost_centre,
            )
            await aio(telemetry_store.add(record))

        return response
