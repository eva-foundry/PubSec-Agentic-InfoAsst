from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ContentSafetyResult:
    """Result from Azure AI Content Safety check."""

    passed: bool
    categories: dict[str, str] = field(default_factory=dict)  # category -> severity
    blocked_reason: str | None = None


class ContentSafetyChecker:
    """Wraps Azure AI Content Safety for input/output filtering.

    Placeholder implementation — always passes.  When the Azure Content
    Safety SDK is integrated, ``check_input`` and ``check_output`` will
    call the remote API.
    """

    async def check_input(self, text: str) -> ContentSafetyResult:
        """Check user input for harmful content."""
        # Placeholder — returns pass
        return ContentSafetyResult(passed=True)

    async def check_output(self, text: str) -> ContentSafetyResult:
        """Check agent output for harmful content."""
        # Placeholder — returns pass
        return ContentSafetyResult(passed=True)
