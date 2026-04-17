"""Azure OpenAI model client — real LLM calls via httpx async.

Supports two auth modes:
- API key: when api_key is provided (header: api-key)
- Entra ID (Azure AD): when api_key is empty, uses azure-identity
  DefaultAzureCredential to get Bearer tokens (works with `az login`)

Routes through Azure APIM in production (endpoint URL points to APIM).
Handles timeouts, throttling (429), and invalid credentials gracefully.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)


def _get_entra_token() -> str | None:
    """Get an Azure AD token for Azure OpenAI using DefaultAzureCredential."""
    try:
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        return token.token
    except Exception:
        logger.exception("Failed to get Entra ID token — is `az login` active?")
        return None


class AzureOpenAIModelClient:
    """Real Azure OpenAI client using httpx async.

    If api_key is provided, uses API key auth.
    If api_key is empty/None, uses Entra ID (Azure AD) Bearer token auth.
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
        self._client = httpx.AsyncClient(timeout=60.0)

    def _auth_headers(self) -> dict[str, str]:
        """Return auth headers — API key or Bearer token."""
        if self.api_key:
            return {"api-key": self.api_key, "Content-Type": "application/json"}
        token = _get_entra_token()
        if token:
            return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        logger.error("No API key and Entra ID token acquisition failed")
        return {"Content-Type": "application/json"}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_query(self, system: str, user_message: str, history: list[dict]) -> str:
        """Single-shot completion for query rewrite. Temperature=0 for determinism."""
        messages = [{"role": "system", "content": system}]
        for h in history[-3:]:  # last 3 turns for context
            messages.append({"role": "user", "content": h.get("user", "")})
            if h.get("assistant"):
                messages.append({"role": "assistant", "content": h["assistant"]})
        messages.append({"role": "user", "content": user_message})

        url = (
            f"{self.endpoint}/openai/deployments/{self.deployment}"
            f"/chat/completions?api-version={self.api_version}"
        )

        try:
            response = await self._client.post(
                url,
                headers=self._auth_headers(),
                json={"messages": messages, "max_completion_tokens": 100},
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

        except httpx.TimeoutException:
            logger.error("Azure OpenAI timeout during query rewrite")
            return user_message  # graceful fallback: use original query
        except httpx.HTTPStatusError as exc:
            self._log_http_error(exc)
            return user_message
        except Exception:
            logger.exception("Unexpected error during query rewrite")
            return user_message

    async def stream_completion(
        self, system: str, messages: list[dict]
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from Azure OpenAI. Yields content deltas."""
        all_messages = [{"role": "system", "content": system}] + messages
        url = (
            f"{self.endpoint}/openai/deployments/{self.deployment}"
            f"/chat/completions?api-version={self.api_version}"
        )

        try:
            async with self._client.stream(
                "POST",
                url,
                headers=self._auth_headers(),
                json={
                    "messages": all_messages,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if not choices:
                                continue
                            delta = choices[0].get("delta", {}).get("content")
                            if delta:
                                yield delta
                        except (json.JSONDecodeError, IndexError, KeyError):
                            continue

        except httpx.TimeoutException:
            logger.error("Azure OpenAI timeout during stream completion")
            yield "[Error: Azure OpenAI request timed out. Please try again.]"
        except httpx.HTTPStatusError as exc:
            self._log_http_error(exc)
            status = exc.response.status_code
            if status == 429:
                yield "[Error: Rate limited by Azure OpenAI. Please wait and retry.]"
            elif status == 401:
                yield "[Error: Invalid Azure OpenAI credentials.]"
            else:
                yield f"[Error: Azure OpenAI returned HTTP {status}.]"
        except Exception:
            logger.exception("Unexpected error during stream completion")
            yield "[Error: Unexpected error communicating with Azure OpenAI.]"

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _log_http_error(exc: httpx.HTTPStatusError) -> None:
        status = exc.response.status_code
        if status == 429:
            logger.warning(
                "Azure OpenAI throttled (429) — retry-after: %s",
                exc.response.headers.get("retry-after", "unknown"),
            )
        elif status == 401:
            logger.error("Azure OpenAI authentication failed (401)")
        else:
            try:
                body = exc.response.text[:200]
            except Exception:
                body = "(streaming response — body not readable)"
            logger.error("Azure OpenAI HTTP %d: %s", status, body)
