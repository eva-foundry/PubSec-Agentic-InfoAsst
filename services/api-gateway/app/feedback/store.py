"""In-memory feedback store with analytics queries."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from .models import FeedbackRecord, FeedbackSummary, QuestionAnalytics


class FeedbackStore:
    def __init__(self) -> None:
        self._feedback: list[FeedbackRecord] = []
        self._questions: list[QuestionAnalytics] = []

    # ── Writes ──────────────────────────────────────────────

    def add_feedback(self, record: FeedbackRecord) -> None:
        self._feedback.append(record)

    def add_question(self, record: QuestionAnalytics) -> None:
        self._questions.append(record)

    # ── Reads ───────────────────────────────────────────────

    def get_feedback_by_workspace(self, workspace_id: str) -> list[FeedbackRecord]:
        return [r for r in self._feedback if r.workspace_id == workspace_id]

    def get_questions_by_workspace(self, workspace_id: str) -> list[QuestionAnalytics]:
        return [q for q in self._questions if q.workspace_id == workspace_id]

    # ── Analytics ───────────────────────────────────────────

    def get_feedback_summary(
        self,
        workspace_id: str | None = None,
        days: int = 30,
    ) -> FeedbackSummary:
        """Compute acceptance rate, avg confidence, and top correction reasons."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days)

        records = self._feedback
        if workspace_id is not None:
            records = [r for r in records if r.workspace_id == workspace_id]

        records = [
            r for r in records if datetime.fromisoformat(r.created_at) >= cutoff
        ]

        total = len(records)
        accepted = [r for r in records if r.signal == "accept"]
        rejected = [r for r in records if r.signal == "reject"]
        corrections = [r for r in records if r.correction_text is not None]

        acceptance_rate = len(accepted) / total if total else 0.0
        avg_conf_accepted = (
            sum(r.confidence_score for r in accepted) / len(accepted)
            if accepted
            else 0.0
        )
        avg_conf_rejected = (
            sum(r.confidence_score for r in rejected) / len(rejected)
            if rejected
            else 0.0
        )

        reason_counter: Counter[str] = Counter()
        for r in records:
            if r.reason:
                reason_counter[r.reason] += 1

        top_reasons = [
            {"reason": reason, "count": count}
            for reason, count in reason_counter.most_common(10)
        ]

        return FeedbackSummary(
            total_feedback=total,
            acceptance_rate=round(acceptance_rate, 4),
            correction_count=len(corrections),
            avg_confidence_accepted=round(avg_conf_accepted, 4),
            avg_confidence_rejected=round(avg_conf_rejected, 4),
            top_correction_reasons=top_reasons,
            period_start=cutoff.isoformat(),
            period_end=now.isoformat(),
        )

    def get_content_gaps(
        self, workspace_id: str | None = None
    ) -> list[dict]:
        """Questions where had_answer=False or confidence < 0.4, grouped by pattern."""
        questions = self._questions
        if workspace_id is not None:
            questions = [q for q in questions if q.workspace_id == workspace_id]

        gaps = [
            q for q in questions if not q.had_answer or q.confidence_score < 0.4
        ]

        # Group by archetype (or "unknown")
        archetype_groups: dict[str, list[QuestionAnalytics]] = {}
        for g in gaps:
            key = g.archetype or "unknown"
            archetype_groups.setdefault(key, []).append(g)

        return [
            {
                "archetype": archetype,
                "count": len(items),
                "avg_confidence": round(
                    sum(q.confidence_score for q in items) / len(items), 4
                ),
                "no_answer_count": sum(1 for q in items if not q.had_answer),
                "languages": list({q.language for q in items}),
            }
            for archetype, items in sorted(
                archetype_groups.items(), key=lambda kv: -len(kv[1])
            )
        ]

    def get_source_quality(
        self, workspace_id: str | None = None
    ) -> list[dict]:
        """Per-source acceptance rate derived from feedback records."""
        records = self._feedback
        if workspace_id is not None:
            records = [r for r in records if r.workspace_id == workspace_id]

        source_stats: dict[str, dict[str, int]] = {}
        for r in records:
            for src in r.cited_sources:
                stats = source_stats.setdefault(src, {"accept": 0, "reject": 0})
                if r.signal == "accept":
                    stats["accept"] += 1
                else:
                    stats["reject"] += 1

        results = []
        for source, stats in sorted(source_stats.items()):
            total = stats["accept"] + stats["reject"]
            results.append(
                {
                    "source": source,
                    "total_feedback": total,
                    "accept_count": stats["accept"],
                    "reject_count": stats["reject"],
                    "acceptance_rate": round(stats["accept"] / total, 4) if total else 0.0,
                }
            )

        # Sort by acceptance rate ascending so worst sources surface first
        results.sort(key=lambda r: r["acceptance_rate"])
        return results
