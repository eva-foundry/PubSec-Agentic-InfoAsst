from __future__ import annotations

from enum import Enum


class EscalationTier(str, Enum):
    AUTO_RESOLVE = "auto-resolve"
    FLAGGED_FOR_REVIEW = "flagged-for-review"
    REQUIRES_HUMAN = "requires-human-decision"


class EscalationEngine:
    """Determines escalation tier based on confidence and workspace config."""

    def __init__(
        self,
        auto_threshold: float = 0.7,
        review_threshold: float = 0.4,
    ):
        self.auto_threshold = auto_threshold
        self.review_threshold = review_threshold

    def evaluate(
        self,
        confidence: float,
        workspace_escalation_config: str = "auto",
    ) -> EscalationTier:
        """Return the escalation tier for a given confidence score.

        ``workspace_escalation_config`` overrides:
        - ``"auto"`` — use confidence thresholds.
        - ``"review"`` — minimum ``flagged-for-review``.
        - ``"human"`` — always ``requires-human-decision``.
        """
        if workspace_escalation_config == "human":
            return EscalationTier.REQUIRES_HUMAN

        # Determine tier from confidence
        if confidence >= self.auto_threshold:
            tier = EscalationTier.AUTO_RESOLVE
        elif confidence >= self.review_threshold:
            tier = EscalationTier.FLAGGED_FOR_REVIEW
        else:
            tier = EscalationTier.REQUIRES_HUMAN

        # "review" config enforces minimum of flagged-for-review
        if workspace_escalation_config == "review":
            if tier == EscalationTier.AUTO_RESOLVE:
                tier = EscalationTier.FLAGGED_FOR_REVIEW

        return tier
