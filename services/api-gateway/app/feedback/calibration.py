"""Confidence calibration loop.

Tracks predicted confidence vs. actual accuracy over time, computes
calibration curves, detects systematic bias (overconfidence/underconfidence),
and suggests adjustments to improve calibration.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Bucket boundaries for the calibration curve (10 equal-width bins)
_BUCKET_EDGES = [i / 10 for i in range(11)]  # 0.0, 0.1, ..., 1.0


@dataclass
class _Outcome:
    predicted_confidence: float
    was_accurate: bool


class CalibrationEngine:
    """Tracks predicted confidence vs. actual accuracy for calibration.

    The engine accumulates outcomes over time and provides:
    - A calibration curve (predicted vs. actual in buckets)
    - An overall bias metric
    - Per-prediction adjustment suggestions
    """

    def __init__(self) -> None:
        self._outcomes: list[_Outcome] = []

    def record_outcome(self, predicted_confidence: float, was_accurate: bool) -> None:
        """Record a single prediction outcome.

        Parameters
        ----------
        predicted_confidence : float
            The confidence score the system assigned (0.0 to 1.0).
        was_accurate : bool
            Whether the prediction/answer turned out to be correct.
        """
        clamped = max(0.0, min(1.0, predicted_confidence))
        self._outcomes.append(_Outcome(clamped, was_accurate))

    def get_calibration_curve(self) -> list[dict]:
        """Compute a calibration curve with 10 equal-width bins.

        Returns a list of dicts, each with:
        - ``bucket_start``: lower edge of the confidence bin
        - ``bucket_end``: upper edge of the confidence bin
        - ``predicted_avg``: mean predicted confidence in this bin
        - ``actual_accuracy``: fraction of correct predictions in this bin
        - ``count``: number of outcomes in this bin
        """
        buckets: list[list[_Outcome]] = [[] for _ in range(10)]

        for outcome in self._outcomes:
            idx = min(int(outcome.predicted_confidence * 10), 9)
            buckets[idx].append(outcome)

        curve: list[dict] = []
        for i, bucket in enumerate(buckets):
            count = len(bucket)
            if count == 0:
                predicted_avg = (_BUCKET_EDGES[i] + _BUCKET_EDGES[i + 1]) / 2
                actual_accuracy = 0.0
            else:
                predicted_avg = sum(o.predicted_confidence for o in bucket) / count
                actual_accuracy = sum(1 for o in bucket if o.was_accurate) / count

            curve.append({
                "bucket_start": round(_BUCKET_EDGES[i], 1),
                "bucket_end": round(_BUCKET_EDGES[i + 1], 1),
                "predicted_avg": round(predicted_avg, 4),
                "actual_accuracy": round(actual_accuracy, 4),
                "count": count,
            })

        return curve

    def compute_bias(self) -> float:
        """Compute overall calibration bias.

        Returns
        -------
        float
            Positive value means the system is overconfident (predicts
            higher confidence than warranted).  Negative means underconfident.
            Zero means perfectly calibrated.  Returns 0.0 if no outcomes.
        """
        if not self._outcomes:
            return 0.0

        total_predicted = sum(o.predicted_confidence for o in self._outcomes)
        total_accurate = sum(1 for o in self._outcomes if o.was_accurate)
        n = len(self._outcomes)

        avg_predicted = total_predicted / n
        avg_actual = total_accurate / n

        return round(avg_predicted - avg_actual, 4)

    def suggest_adjustment(self, predicted: float) -> float:
        """Suggest an adjusted confidence based on historical calibration.

        Uses the calibration curve to find the actual accuracy for the
        bucket this prediction falls into, and blends it with the raw
        prediction (weighted by sample count in that bucket).

        Parameters
        ----------
        predicted : float
            The raw predicted confidence to adjust.

        Returns
        -------
        float
            Adjusted confidence value (0.0 to 1.0).
        """
        if not self._outcomes:
            return predicted

        clamped = max(0.0, min(1.0, predicted))
        curve = self.get_calibration_curve()
        idx = min(int(clamped * 10), 9)
        bucket = curve[idx]

        if bucket["count"] == 0:
            # No data for this bucket — fall back to global bias adjustment
            bias = self.compute_bias()
            adjusted = clamped - bias
        else:
            # Blend raw prediction with observed actual accuracy
            # Weight towards observed data as sample size grows
            weight = min(bucket["count"] / 30.0, 1.0)  # saturate at 30 samples
            adjusted = (1 - weight) * clamped + weight * bucket["actual_accuracy"]

        return round(max(0.0, min(1.0, adjusted)), 4)

    @property
    def total_outcomes(self) -> int:
        """Total number of recorded outcomes."""
        return len(self._outcomes)

    def __repr__(self) -> str:
        return f"CalibrationEngine(outcomes={len(self._outcomes)}, bias={self.compute_bias():.4f})"
