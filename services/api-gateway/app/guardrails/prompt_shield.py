from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class PromptShieldResult:
    """Result of prompt injection detection."""

    passed: bool
    matched_patterns: list[str] = field(default_factory=list)
    risk_level: str = "none"  # "none" | "low" | "medium" | "high"


class PromptShield:
    """Detects and blocks prompt injection attempts."""

    INJECTION_PATTERNS: list[str] = [
        r"ignore\s+(previous|all|above)\s+instructions",
        r"disregard\s+(previous|all|above)\s+instructions",
        r"forget\s+(previous|all|above)\s+instructions",
        r"you\s+are\s+now\s+",
        r"act\s+as\s+if\s+you\s+are\s+",
        r"pretend\s+you\s+are\s+",
        r"system\s*:\s*",
        r"<\|im_start\|>",
        r"<\|im_end\|>",
        r"###\s*(system|instruction)",
        r"\[INST\]",
        r"\[/INST\]",
        r"<\s*system\s*>",
        r"override\s+(safety|content)\s+(filter|policy)",
        r"do\s+not\s+follow\s+(any|your)\s+(rules|guidelines)",
        r"jailbreak",
    ]

    def __init__(self) -> None:
        self._compiled = [
            re.compile(p, re.IGNORECASE) for p in self.INJECTION_PATTERNS
        ]

    def check(self, user_input: str) -> PromptShieldResult:
        """Check user input for prompt injection patterns."""
        matched: list[str] = []

        for pattern, compiled in zip(self.INJECTION_PATTERNS, self._compiled):
            if compiled.search(user_input):
                matched.append(pattern)

        if not matched:
            return PromptShieldResult(
                passed=True,
                matched_patterns=[],
                risk_level="none",
            )

        count = len(matched)
        if count >= 3:
            risk = "high"
        elif count >= 2:
            risk = "medium"
        else:
            risk = "low"

        return PromptShieldResult(
            passed=False,
            matched_patterns=matched,
            risk_level=risk,
        )
