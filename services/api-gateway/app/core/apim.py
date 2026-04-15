"""Azure APIM client wrapper for FinOps-governed AI calls.

Every outbound call to Azure OpenAI must route through Azure API Management
so that cost-attribution headers (x-app-id, x-user-group, x-classification,
x-workspace-id) are recorded for FinOps chargeback.

Falls back to direct Azure OpenAI endpoint when APIM URL is not configured
(local dev / mock mode).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


@dataclass
class FinOpsContext:
    """FinOps headers attached to every APIM request."""

    app_id: str = "eva-agentic"
    user_group: str = "default"
    classification: str = "protected_b"
    workspace_id: str = ""


class APIMClient:
    """Wraps ``httpx.AsyncClient`` for calls routed through Azure APIM.

    Adds FinOps request headers on every outbound call and extracts
    outcome headers from responses for downstream telemetry.

    Parameters
    ----------
    apim_url : str | None
        The APIM gateway base URL.  When empty/None, falls back to the
        direct Azure OpenAI endpoint from settings.
    api_key : str | None
        API key for authentication (APIM subscription key or Azure OpenAI key).
    api_version : str
        Azure OpenAI API version string.
    timeout : float
        HTTP request timeout in seconds.
    """

    def __init__(
        self,
        apim_url: str | None = None,
        api_key: str | None = None,
        api_version: str = "2024-12-01-preview",
        timeout: float = 60.0,
    ) -> None:
        self._apim_url = (apim_url or settings.apim_gateway_url).rstrip("/") or None
        self._direct_url = settings.azure_openai_endpoint.rstrip("/") or None
        self._api_key = api_key or settings.azure_openai_api_key or None
        self._api_version = api_version
        self._client = httpx.AsyncClient(timeout=timeout)

    @property
    def base_url(self) -> str | None:
        """Resolved base URL — APIM if configured, else direct endpoint."""
        return self._apim_url or self._direct_url

    def _build_request_headers(self, finops: FinOpsContext) -> dict[str, str]:
        """Build headers with auth + FinOps cost-attribution."""
        headers: dict[str, str] = {"Content-Type": "application/json"}

        # Auth
        if self._api_key:
            if self._apim_url:
                headers["Ocp-Apim-Subscription-Key"] = self._api_key
            else:
                headers["api-key"] = self._api_key

        # FinOps headers — always present
        headers["x-app-id"] = finops.app_id
        headers["x-user-group"] = finops.user_group
        headers["x-classification"] = finops.classification
        headers["x-workspace-id"] = finops.workspace_id

        return headers

    @staticmethod
    def extract_outcome_headers(response: httpx.Response) -> dict[str, str | int]:
        """Extract outcome/telemetry headers from the APIM response."""
        outcome: dict[str, str | int] = {}

        for header_name in (
            "x-sources-consulted",
            "x-sources-cited",
            "x-escalation-tier",
        ):
            value = response.headers.get(header_name)
            if value is not None:
                try:
                    outcome[header_name] = int(value)
                except ValueError:
                    outcome[header_name] = value

        return outcome

    async def call_openai(
        self,
        deployment: str,
        messages: list[dict],
        *,
        finops: FinOpsContext | None = None,
        **kwargs,
    ) -> dict:
        """Call Azure OpenAI chat completions through APIM.

        Parameters
        ----------
        deployment : str
            Azure OpenAI deployment name (e.g. ``"chat-default"``).
        messages : list[dict]
            Chat completion messages.
        finops : FinOpsContext | None
            FinOps cost-attribution context.  Defaults to a generic context.
        **kwargs
            Additional body parameters (temperature, max_completion_tokens, etc.).

        Returns
        -------
        dict
            Parsed JSON response with an extra ``_outcome_headers`` key
            containing extracted APIM outcome headers.

        Raises
        ------
        httpx.HTTPStatusError
            If the API returns a non-2xx status code.
        RuntimeError
            If no endpoint is configured.
        """
        base = self.base_url
        if not base:
            raise RuntimeError(
                "No APIM URL or direct Azure OpenAI endpoint configured. "
                "Set EVA_APIM_GATEWAY_URL or EVA_AZURE_OPENAI_ENDPOINT."
            )

        ctx = finops or FinOpsContext()
        url = (
            f"{base}/openai/deployments/{deployment}"
            f"/chat/completions?api-version={self._api_version}"
        )

        body: dict = {"messages": messages, **kwargs}
        headers = self._build_request_headers(ctx)

        logger.info(
            "APIMClient: POST %s (deployment=%s, workspace=%s)",
            "APIM" if self._apim_url else "direct",
            deployment,
            ctx.workspace_id,
        )

        response = await self._client.post(url, headers=headers, json=body)
        response.raise_for_status()

        data = response.json()
        data["_outcome_headers"] = self.extract_outcome_headers(response)

        return data

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()
