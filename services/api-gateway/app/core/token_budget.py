"""Token-aware message construction with budget management.

Uses tiktoken ``cl100k_base`` encoding (the tokenizer for GPT-4o/GPT-4/GPT-3.5)
to accurately count tokens and enforce context-window limits.
"""

from __future__ import annotations

import logging

import tiktoken

logger = logging.getLogger(__name__)

# Cache the encoding instance — it's thread-safe and expensive to create.
_encoding: tiktoken.Encoding | None = None


def _get_encoding() -> tiktoken.Encoding:
    global _encoding
    if _encoding is None:
        _encoding = tiktoken.get_encoding("cl100k_base")
    return _encoding


def count_tokens(text: str) -> int:
    """Count tokens in *text* using cl100k_base."""
    return len(_get_encoding().encode(text))


def count_message_tokens(messages: list[dict]) -> int:
    """Count tokens across a list of chat-completion messages.

    Follows the OpenAI token-counting convention:
    each message adds ~4 overhead tokens (role, delimiters).
    """
    enc = _get_encoding()
    total = 0
    for msg in messages:
        # 4 tokens per message: <|start|>{role/name}\n{content}<|end|>\n
        total += 4
        for key, value in msg.items():
            if isinstance(value, str):
                total += len(enc.encode(value))
    # Every reply is primed with <|start|>assistant<|message|>
    total += 3
    return total


class TokenBudget:
    """Enforces token limits for model context windows.

    Parameters
    ----------
    max_tokens : int
        Total context window size (e.g. 128000 for GPT-4o).
    max_completion_tokens : int
        Reserved space for the model's completion output.
    """

    def __init__(
        self,
        max_tokens: int = 128_000,
        max_completion_tokens: int = 4096,
    ) -> None:
        self.max_tokens = max_tokens
        self.max_completion_tokens = max_completion_tokens

    @property
    def available_prompt_tokens(self) -> int:
        """Tokens available for prompt (system + history + user)."""
        return self.max_tokens - self.max_completion_tokens

    def fits(self, messages: list[dict]) -> bool:
        """Check whether *messages* fit within the prompt budget."""
        return count_message_tokens(messages) <= self.available_prompt_tokens

    def trim_history(
        self,
        messages: list[dict],
        system_tokens: int | None = None,
        max_completion: int | None = None,
    ) -> list[dict]:
        """Trim the oldest non-system messages to fit within budget.

        Iterates backward from the oldest conversational message and drops
        messages until the total fits.  System messages (index 0 if role ==
        "system") are never dropped.

        Parameters
        ----------
        messages : list[dict]
            Full message list (system + history + current user turn).
        system_tokens : int | None
            Pre-computed system-message token count.  If ``None``, computed
            from ``messages[0]`` when its role is ``"system"``.
        max_completion : int | None
            Override for ``max_completion_tokens``.

        Returns
        -------
        list[dict]
            Trimmed message list guaranteed to fit the budget.
        """
        completion_reserve = max_completion or self.max_completion_tokens
        budget = self.max_tokens - completion_reserve

        # Separate system message (always kept) from conversation
        system_msgs: list[dict] = []
        conversation: list[dict] = []

        for msg in messages:
            if msg.get("role") == "system" and not conversation:
                system_msgs.append(msg)
            else:
                conversation.append(msg)

        if system_tokens is None and system_msgs:
            system_tokens = count_message_tokens(system_msgs)
        elif system_tokens is None:
            system_tokens = 0

        remaining_budget = budget - system_tokens

        # Walk backward through conversation, accumulate from newest
        kept: list[dict] = []
        running_tokens = 0
        for msg in reversed(conversation):
            msg_tokens = count_message_tokens([msg])
            if running_tokens + msg_tokens <= remaining_budget:
                kept.append(msg)
                running_tokens += msg_tokens
            else:
                logger.debug(
                    "TokenBudget: dropping message (role=%s, tokens=%d) to fit budget",
                    msg.get("role"),
                    msg_tokens,
                )

        kept.reverse()

        return system_msgs + kept
