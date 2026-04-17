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
        # --- Direct injection: instruction override ---
        r"ignore\s+(all\s+)?(previous|above)\s+instructions",
        r"disregard\s+(all\s+)?(previous|above)\s+instructions",
        r"forget\s+(all\s+)?(previous|above)\s+instructions",
        r"ignore\s+all\s+instructions",
        r"disregard\s+all\s+instructions",
        r"forget\s+all\s+instructions",
        r"override\s+(previous|all|above)\s+(context|instructions)",
        # --- Role / identity confusion ---
        r"you\s+are\s+now\s+",
        r"act\s+as\s+if\s+you\s+are\s+",
        r"pretend\s+(you\s+are|to\s+be)\s+",
        r"you\s+have\s+been\s+freed\s+from",
        r"you\s+(?:can|will)\s+do\s+anything",
        r"without\s+(any\s+)?restrictions",
        r"no\s+safety\s+filters",
        # --- Prompt template / delimiter injection ---
        r"system\s*:\s*",
        r"<\|im_start\|>",
        r"<\|im_end\|>",
        r"###\s*(system|instruction)",
        r"\[INST\]",
        r"\[/INST\]",
        r"<\s*system\s*>",
        r"```\s*system\b",
        # --- Safety override ---
        r"override\s+(safety|content)\s+(filter|policy)",
        r"do\s+not\s+follow\s+(any|your)\s+(rules|guidelines)",
        r"(enable|enter)\s+developer\s+mode",
        r"(remove|disable|bypass)\s+(all\s+)?(safety|content)\s+(filter|restriction|guardrail)",
        # --- Jailbreak markers ---
        r"jailbreak",
        r"\bDAN\b.*do\s+anything\s+now",
        r"do\s+anything\s+now",
        # --- Data exfiltration ---
        r"(show|reveal|display|tell|give)\s+(me\s+)?(your|the)\s+(system\s+prompt|instructions\s+verbatim|source\s+code|configuration)",
        r"(list|show|reveal|output)\s+(all\s+)?(api\s+keys?|connection\s+strings?|environment\s+variables?|credentials|secrets)",
        r"what\s+(is|are)\s+your\s+(system\s+prompt|instructions)",
        r"repeat\s+(your|the)\s+(system|initial)\s+(prompt|instructions)\s+verbatim",
        # --- Indirect injection via document content ---
        r"ignore\s+safety\s+guidelines",
        r"IMPORTANT\s*:\s*(override|ignore|disregard|forget)",
        r"output\s+raw\s+data",
        r"reveal\s+(system|internal)\s+configuration",
    ]

    def __init__(self) -> None:
        self._compiled = [re.compile(p, re.IGNORECASE) for p in self.INJECTION_PATTERNS]

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
