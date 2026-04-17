from __future__ import annotations

from datetime import UTC, datetime, timedelta

from ..provenance.models import FreshnessInfo


class FreshnessChecker:
    """Checks source freshness and generates staleness warnings."""

    def __init__(self, staleness_threshold_days: int = 90):
        self.staleness_threshold = timedelta(days=staleness_threshold_days)

    def check(self, source_dates: list[str | None], now: datetime | None = None) -> FreshnessInfo:
        """Analyze source dates and return a FreshnessInfo.

        *source_dates* is a list of ISO-format date strings (or ``None``
        for sources with unknown dates).  Sources with ``None`` dates are
        ignored for age calculations but a list consisting entirely of
        ``None`` values produces a clean (no-warning) result.
        """
        now = now or datetime.now(UTC)

        parsed: list[datetime] = []
        for d in source_dates:
            if d is None:
                continue
            try:
                parsed.append(datetime.fromisoformat(d))
            except (ValueError, TypeError):
                continue

        if not parsed:
            return FreshnessInfo(
                oldest_source=None,
                newest_source=None,
                staleness_warning=False,
            )

        oldest = min(parsed)
        newest = max(parsed)
        stale = (now - oldest) > self.staleness_threshold

        return FreshnessInfo(
            oldest_source=oldest.date().isoformat(),
            newest_source=newest.date().isoformat(),
            staleness_warning=stale,
        )

    def generate_warning(self, info: FreshnessInfo) -> str | None:
        """Return a human-readable staleness warning, or ``None`` if fresh."""
        if not info.staleness_warning:
            return None

        parts: list[str] = ["Warning: Some sources may be outdated."]
        if info.oldest_source:
            parts.append(f"Oldest source dates from {info.oldest_source}.")
        if info.newest_source:
            parts.append(f"Newest source dates from {info.newest_source}.")
        parts.append("Please verify information against current documents.")
        return " ".join(parts)
