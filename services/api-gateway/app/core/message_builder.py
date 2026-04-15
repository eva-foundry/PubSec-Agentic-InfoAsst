"""Message accumulator with token tracking.

Builds a list of chat-completion messages while keeping a running count of
tokens consumed.  Integrates with :class:`TokenBudget` for limit enforcement.
"""

from __future__ import annotations

from .token_budget import TokenBudget, count_message_tokens


class MessageBuilder:
    """Accumulates chat messages and tracks total token usage.

    Parameters
    ----------
    max_tokens : int
        Model context window size (passed to internal ``TokenBudget``).
    max_completion_tokens : int
        Reserved completion tokens (passed to internal ``TokenBudget``).
    """

    def __init__(
        self,
        max_tokens: int = 128_000,
        max_completion_tokens: int = 4096,
    ) -> None:
        self._budget = TokenBudget(
            max_tokens=max_tokens,
            max_completion_tokens=max_completion_tokens,
        )
        self._messages: list[dict] = []
        self._token_count: int = 0

    # ------------------------------------------------------------------
    # Message appenders
    # ------------------------------------------------------------------

    def add_system(self, content: str) -> None:
        """Append a system message."""
        self._append({"role": "system", "content": content})

    def add_user(self, content: str) -> None:
        """Append a user message."""
        self._append({"role": "user", "content": content})

    def add_assistant(self, content: str) -> None:
        """Append an assistant message."""
        self._append({"role": "assistant", "content": content})

    # ------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------

    def get_messages(self) -> list[dict]:
        """Return the accumulated message list."""
        return list(self._messages)

    @property
    def token_count(self) -> int:
        """Total tokens across all accumulated messages."""
        return self._token_count

    def fits(self) -> bool:
        """Check whether the current messages fit within the prompt budget."""
        return self._budget.fits(self._messages)

    def trim(self) -> list[dict]:
        """Trim history via the internal budget and return the result.

        Updates internal state to match the trimmed output.
        """
        trimmed = self._budget.trim_history(self._messages)
        self._messages = trimmed
        self._token_count = count_message_tokens(trimmed)
        return list(trimmed)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _append(self, message: dict) -> None:
        self._messages.append(message)
        self._token_count = count_message_tokens(self._messages)

    def __len__(self) -> int:
        return len(self._messages)

    def __repr__(self) -> str:
        return (
            f"MessageBuilder(messages={len(self._messages)}, "
            f"tokens={self._token_count})"
        )
