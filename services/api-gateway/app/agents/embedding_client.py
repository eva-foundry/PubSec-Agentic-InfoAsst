"""Azure OpenAI embedding client — real and mock implementations.

Routes through Azure APIM in production (endpoint URL points to APIM).
"""

from __future__ import annotations

import logging
import random

import httpx

logger = logging.getLogger(__name__)


class AzureEmbeddingClient:
    """Real Azure OpenAI embeddings client.

    Supports API key or Entra ID (Azure AD) Bearer token auth.
    """

    def __init__(
        self,
        endpoint: str,
        api_key: str | None,
        deployment: str,
        api_version: str = "2024-12-01-preview",
    ) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.deployment = deployment
        self.api_version = api_version
        self._client = httpx.AsyncClient(timeout=30.0)

    def _auth_headers(self) -> dict[str, str]:
        if self.api_key:
            return {"api-key": self.api_key, "Content-Type": "application/json"}
        from .azure_client import _get_entra_token
        token = _get_entra_token()
        if token:
            return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        return {"Content-Type": "application/json"}

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts. Returns list of embedding vectors."""
        url = (
            f"{self.endpoint}/openai/deployments/{self.deployment}"
            f"/embeddings?api-version={self.api_version}"
        )

        try:
            response = await self._client.post(
                url,
                headers=self._auth_headers(),
                json={"input": texts},
            )
            response.raise_for_status()
            data = response.json()
            return [item["embedding"] for item in data["data"]]

        except httpx.TimeoutException:
            logger.error("Azure OpenAI timeout during embedding")
            raise
        except httpx.HTTPStatusError as exc:
            logger.error("Azure OpenAI embedding HTTP %d", exc.response.status_code)
            raise
        except Exception:
            logger.exception("Unexpected error during embedding")
            raise


class MockEmbeddingClient:
    """Returns random vectors when no Azure creds available."""

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Return deterministic-ish random embeddings (1536-dim)."""
        return [[random.gauss(0, 1) for _ in range(1536)] for _ in texts]
