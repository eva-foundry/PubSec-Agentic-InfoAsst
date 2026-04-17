"""Source quality scoring — tracks per-file user feedback signals.

Aggregates accept/reject/correct signals per source file per workspace
to compute quality scores and flag low-quality sources for review.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger(__name__)


@dataclass
class _Signal:
    file_name: str
    workspace_id: str
    signal: Literal["accepted", "rejected", "corrected"]


class SourceQualityTracker:
    """Tracks user feedback signals per source file and computes quality scores.

    Quality score = acceptance_rate, where:
    - ``accepted`` counts as positive
    - ``rejected`` counts as negative
    - ``corrected`` counts as negative (source needed human correction)
    """

    def __init__(self) -> None:
        # Keyed by (workspace_id, file_name) -> list of signals
        self._signals: dict[tuple[str, str], list[str]] = defaultdict(list)

    def record_signal(
        self,
        file_name: str,
        workspace_id: str,
        signal: Literal["accepted", "rejected", "corrected"],
    ) -> None:
        """Record a user feedback signal for a source file.

        Parameters
        ----------
        file_name : str
            The source file that was cited.
        workspace_id : str
            The workspace the file belongs to.
        signal : str
            One of ``"accepted"``, ``"rejected"``, or ``"corrected"``.
        """
        if signal not in ("accepted", "rejected", "corrected"):
            raise ValueError(f"Invalid signal: {signal!r}. Must be accepted/rejected/corrected.")
        self._signals[(workspace_id, file_name)].append(signal)
        logger.debug(
            "SourceQuality: recorded %s for %s in workspace %s",
            signal, file_name, workspace_id,
        )

    def get_quality_scores(self, workspace_id: str) -> list[dict]:
        """Compute per-file quality scores for a workspace.

        Returns a list of dicts sorted by quality score ascending (worst first):
        - ``file_name``
        - ``total_signals``
        - ``accepted_count``
        - ``rejected_count``
        - ``corrected_count``
        - ``acceptance_rate``  (accepted / total)
        - ``correction_rate`` (corrected / total)
        - ``quality_score``   (same as acceptance_rate)
        """
        results: list[dict] = []

        for (ws_id, file_name), signals in self._signals.items():
            if ws_id != workspace_id:
                continue

            total = len(signals)
            accepted = signals.count("accepted")
            rejected = signals.count("rejected")
            corrected = signals.count("corrected")

            acceptance_rate = accepted / total if total > 0 else 0.0
            correction_rate = corrected / total if total > 0 else 0.0

            results.append({
                "file_name": file_name,
                "total_signals": total,
                "accepted_count": accepted,
                "rejected_count": rejected,
                "corrected_count": corrected,
                "acceptance_rate": round(acceptance_rate, 4),
                "correction_rate": round(correction_rate, 4),
                "quality_score": round(acceptance_rate, 4),
            })

        # Sort worst quality first for easy identification
        results.sort(key=lambda r: r["quality_score"])
        return results

    def flag_low_quality(
        self,
        workspace_id: str,
        threshold: float = 0.5,
    ) -> list[str]:
        """Return file names with quality score below *threshold*.

        Parameters
        ----------
        workspace_id : str
            The workspace to check.
        threshold : float
            Quality score below which a file is flagged. Default 0.5.

        Returns
        -------
        list[str]
            File names below the threshold, sorted by quality score ascending.
        """
        scores = self.get_quality_scores(workspace_id)
        flagged = [
            s["file_name"]
            for s in scores
            if s["quality_score"] < threshold and s["total_signals"] > 0
        ]
        logger.info(
            "SourceQuality: %d files flagged below %.2f in workspace %s",
            len(flagged), threshold, workspace_id,
        )
        return flagged
