"""Direct chat tool — ungrounded GPT completion (no RAG/search).

Wraps a direct Azure OpenAI completion call. Explicitly marks responses as
ungrounded so the UI can display appropriate disclaimers and the audit trail
records that no sources were consulted.
"""

from __future__ import annotations

import logging

from ..agents.azure_client import AzureOpenAIModelClient
from .registry import Tool, ToolMetadata

logger = logging.getLogger(__name__)

_DEFAULT_SYSTEM_PROMPT = (
    "You are EVA, a bilingual (English/French) AI assistant for the "
    "Government of Canada. Respond in the same language as the user's query. "
    "You do NOT have access to any document corpus for this request — "
    "answer from general knowledge only and clearly state that your response "
    "is not grounded in any official source."
)


class DirectChatTool(Tool):
    """Ungrounded GPT-Direct completion — no search, no RAG."""

    metadata = ToolMetadata(
        name="direct_chat",
        description="Ungrounded GPT completion — general knowledge, no document search",
        classification_ceiling="protected_b",
        data_residency="canada_central",
        bilingual=True,
        hitl_required=False,
    )

    def __init__(self, model_client: AzureOpenAIModelClient | None = None) -> None:
        self._model_client = model_client

    async def execute(self, **kwargs) -> dict:
        """Run a direct (ungrounded) completion.

        Parameters
        ----------
        query : str
            The user's message.
        system_prompt : str, optional
            Override the default system prompt.
        temperature : float, optional
            Sampling temperature (default 0.7).
        max_completion_tokens : int, optional
            Max tokens for the completion (default 1024).

        Returns
        -------
        dict
            ``content``, ``mode``, ``sources_consulted``.
        """
        query: str = kwargs["query"]
        system_prompt: str = kwargs.get("system_prompt", _DEFAULT_SYSTEM_PROMPT)
        temperature: float = kwargs.get("temperature", 0.7)
        max_tokens: int = kwargs.get("max_completion_tokens", 1024)

        if self._model_client is None:
            logger.warning("DirectChatTool: no model client configured — returning mock response")
            return {
                "content": (
                    f"[Mock direct-chat response] You asked: {query}\n\n"
                    "This is an ungrounded response (no documents consulted). "
                    "In production, this would call Azure OpenAI directly."
                ),
                "mode": "ungrounded",
                "sources_consulted": 0,
            }

        # Build messages for a single-turn completion
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ]

        # Collect streamed tokens into a single response string
        content_parts: list[str] = []
        async for delta in self._model_client.stream_completion(
            system=system_prompt,
            messages=[{"role": "user", "content": query}],
        ):
            content_parts.append(delta)

        content = "".join(content_parts)

        logger.info(
            "DirectChatTool: completed ungrounded response (%d chars)",
            len(content),
        )

        return {
            "content": content,
            "mode": "ungrounded",
            "sources_consulted": 0,
        }
