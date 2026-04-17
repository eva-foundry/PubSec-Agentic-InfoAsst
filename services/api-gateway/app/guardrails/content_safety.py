"""Azure AI Content Safety integration for input/output filtering.

When ``content_safety_endpoint`` is configured, calls the Azure API.
Otherwise falls back to the existing pass-through for local dev.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..config import settings
from .audit import AuditLogger

logger = logging.getLogger("eva.guardrails.content_safety")
_audit = AuditLogger()


@dataclass
class ContentSafetyResult:
    """Result from Azure AI Content Safety check."""

    passed: bool
    categories: dict[str, str] = field(default_factory=dict)
    blocked_reason: str | None = None


class ContentSafetyChecker:
    """Wraps Azure AI Content Safety for input/output filtering.

    Severity scale: 0=safe, 2=low, 4=medium, 6=high.
    Default threshold blocks medium (4) and above.
    """

    DEFAULT_THRESHOLD = 4  # Block medium and above

    def __init__(self, threshold: int = DEFAULT_THRESHOLD):
        self.threshold = threshold
        self._client = None

        if settings.content_safety_endpoint and settings.content_safety_key:
            try:
                from azure.ai.contentsafety import ContentSafetyClient
                from azure.core.credentials import AzureKeyCredential

                self._client = ContentSafetyClient(
                    endpoint=settings.content_safety_endpoint,
                    credential=AzureKeyCredential(settings.content_safety_key),
                )
                logger.info(
                    "Content Safety client initialized (endpoint: %s)",
                    settings.content_safety_endpoint[:30] + "...",
                )
            except ImportError:
                logger.warning("azure-ai-contentsafety not installed — using pass-through mode")
            except Exception as exc:
                logger.error("Failed to initialize Content Safety client: %s", exc)
        else:
            logger.info("Content Safety endpoint not configured — using pass-through mode")

    async def check_input(self, text: str, correlation_id: str = "") -> ContentSafetyResult:
        """Check user input against all content safety categories."""
        return await self._analyze(text, "input", correlation_id)

    async def check_output(self, text: str, correlation_id: str = "") -> ContentSafetyResult:
        """Check agent output against all content safety categories."""
        return await self._analyze(text, "output", correlation_id)

    async def _analyze(self, text: str, direction: str, correlation_id: str) -> ContentSafetyResult:
        """Run content safety analysis. Falls back to pass-through if client unavailable."""
        if self._client is None:
            return ContentSafetyResult(passed=True)

        try:
            from azure.ai.contentsafety.models import AnalyzeTextOptions

            # API limit is 10K characters
            request = AnalyzeTextOptions(text=text[:10000])
            response = self._client.analyze_text(request)

            categories: dict[str, str] = {}
            blocked_reason: str | None = None
            passed = True

            for item in response.categories_analysis:
                severity = item.severity or 0
                categories[item.category] = str(severity)
                if severity >= self.threshold:
                    passed = False
                    blocked_reason = (
                        f"{item.category}: severity {severity} >= threshold {self.threshold}"
                    )

            _audit.log_action(
                subject=f"content-safety-{direction}",
                actor="content-safety-checker",
                action="analyze",
                purpose=f"Check {direction} for harmful content",
                resource=f"text-length-{len(text)}",
                policy_decision="pass" if passed else f"block:{blocked_reason}",
                correlation_id=correlation_id,
                trace_id="",
            )

            if not passed:
                logger.warning(
                    "Content safety blocked %s: %s",
                    direction,
                    blocked_reason,
                    extra={"correlation_id": correlation_id},
                )

            return ContentSafetyResult(
                passed=passed,
                categories=categories,
                blocked_reason=blocked_reason,
            )

        except Exception as exc:
            # Graceful degradation — log error, don't crash the request
            logger.error(
                "Content Safety API error (degrading gracefully): %s",
                exc,
                extra={"correlation_id": correlation_id, "direction": direction},
            )
            _audit.log_action(
                subject=f"content-safety-{direction}",
                actor="content-safety-checker",
                action="analyze-error",
                purpose=f"Content safety check failed for {direction}",
                resource=f"error:{type(exc).__name__}",
                policy_decision="degrade:pass-on-error",
                correlation_id=correlation_id,
                trace_id="",
            )
            return ContentSafetyResult(
                passed=True, blocked_reason=f"API error: {type(exc).__name__}"
            )
