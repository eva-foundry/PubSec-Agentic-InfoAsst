"""In-memory feedback store with analytics queries."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime, timedelta

from .models import FeedbackRecord, FeedbackSummary, QuestionAnalytics


class FeedbackStore:
    def __init__(self) -> None:
        self._feedback: list[FeedbackRecord] = []
        self._questions: list[QuestionAnalytics] = []
        self._seed()

    def _seed(self) -> None:
        """Pre-populate with feedback and question analytics for the demo walkthrough."""
        # 15 FeedbackRecords: 10 accept, 5 reject across ws-oas-act and ws-ei-juris
        feedback_seed = [
            # --- ws-oas-act: 6 accept, 3 reject ---
            FeedbackRecord(
                id="fb-001",
                conversation_id="conv-oas-01",
                message_id="msg-001",
                workspace_id="ws-oas-act",
                user_id="demo-alice",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="a1b2c3d4e5f6",
                cited_sources=["nhl-cba-excerpt.txt"],
                confidence_score=0.92,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-01T10:00:00Z",
            ),
            FeedbackRecord(
                id="fb-002",
                conversation_id="conv-oas-02",
                message_id="msg-002",
                workspace_id="ws-oas-act",
                user_id="demo-alice",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="b2c3d4e5f6a1",
                cited_sources=["nhl-cba-excerpt.txt", "nhl-bylaws-excerpt.txt"],
                confidence_score=0.88,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-02T11:00:00Z",
            ),
            FeedbackRecord(
                id="fb-003",
                conversation_id="conv-oas-03",
                message_id="msg-003",
                workspace_id="ws-oas-act",
                user_id="demo-bob",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="c3d4e5f6a1b2",
                cited_sources=["nhl-cba-excerpt.txt"],
                confidence_score=0.85,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-03T09:30:00Z",
            ),
            FeedbackRecord(
                id="fb-004",
                conversation_id="conv-oas-04",
                message_id="msg-004",
                workspace_id="ws-oas-act",
                user_id="demo-alice",
                signal="reject",
                correction_text="Section 3(2) specifies 1/40th per year of residence, not 1/10th.",
                reason="incorrect_citation",
                original_answer_hash="d4e5f6a1b2c3",
                cited_sources=["nhl-cba-excerpt.txt"],
                confidence_score=0.45,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-04T14:00:00Z",
            ),
            FeedbackRecord(
                id="fb-005",
                conversation_id="conv-oas-05",
                message_id="msg-005",
                workspace_id="ws-oas-act",
                user_id="demo-eve",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="e5f6a1b2c3d4",
                cited_sources=["nhl-bylaws-excerpt.txt"],
                confidence_score=0.91,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-05T10:15:00Z",
            ),
            FeedbackRecord(
                id="fb-006",
                conversation_id="conv-oas-06",
                message_id="msg-006",
                workspace_id="ws-oas-act",
                user_id="demo-bob",
                signal="reject",
                correction_text=(
                    "The answer omitted the residency requirement in subsection 3(1)(b)."
                ),
                reason="incomplete_answer",
                original_answer_hash="f6a1b2c3d4e5",
                cited_sources=["nhl-cba-excerpt.txt"],
                confidence_score=0.38,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-06T11:30:00Z",
            ),
            FeedbackRecord(
                id="fb-007",
                conversation_id="conv-oas-07",
                message_id="msg-007",
                workspace_id="ws-oas-act",
                user_id="demo-alice",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="a7b7c7d7e7f7",
                cited_sources=["nhl-cba-excerpt.txt", "nhl-bylaws-excerpt.txt"],
                confidence_score=0.95,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-07T08:45:00Z",
            ),
            FeedbackRecord(
                id="fb-008",
                conversation_id="conv-oas-08",
                message_id="msg-008",
                workspace_id="ws-oas-act",
                user_id="demo-eve",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="b8c8d8e8f8a8",
                cited_sources=["nhl-bylaws-excerpt.txt"],
                confidence_score=0.82,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-08T13:00:00Z",
            ),
            FeedbackRecord(
                id="fb-009",
                conversation_id="conv-oas-09",
                message_id="msg-009",
                workspace_id="ws-oas-act",
                user_id="demo-alice",
                signal="reject",
                correction_text=(
                    "The referenced regulation was repealed in 2024. "
                    "Current version applies different rules."
                ),
                reason="outdated_information",
                original_answer_hash="c9d9e9f9a9b9",
                cited_sources=["nhl-bylaws-excerpt.txt"],
                confidence_score=0.30,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-09T15:20:00Z",
            ),
            # --- ws-ei-juris: 4 accept, 2 reject ---
            FeedbackRecord(
                id="fb-010",
                conversation_id="conv-ei-01",
                message_id="msg-010",
                workspace_id="ws-ei-juris",
                user_id="demo-eve",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="ea1b2c3d4e5f",
                cited_sources=["dops-ruling-sample.txt"],
                confidence_score=0.89,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-01T09:00:00Z",
            ),
            FeedbackRecord(
                id="fb-011",
                conversation_id="conv-ei-02",
                message_id="msg-011",
                workspace_id="ws-ei-juris",
                user_id="demo-eve",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="eb2c3d4e5f6a",
                cited_sources=["nhl-rulebook-excerpt.txt", "dops-ruling-sample.txt"],
                confidence_score=0.87,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-03T10:30:00Z",
            ),
            FeedbackRecord(
                id="fb-012",
                conversation_id="conv-ei-03",
                message_id="msg-012",
                workspace_id="ws-ei-juris",
                user_id="demo-alice",
                signal="reject",
                correction_text=(
                    "The ruling cited was from the NHL Commissioner, not the DoPS initial decision."
                ),
                reason="wrong_section_cited",
                original_answer_hash="ec3d4e5f6a1b",
                cited_sources=["dops-ruling-sample.txt"],
                confidence_score=0.42,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-05T14:45:00Z",
            ),
            FeedbackRecord(
                id="fb-013",
                conversation_id="conv-ei-04",
                message_id="msg-013",
                workspace_id="ws-ei-juris",
                user_id="demo-eve",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="ed4e5f6a1b2c",
                cited_sources=["nhl-rulebook-excerpt.txt"],
                confidence_score=0.93,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-07T11:00:00Z",
            ),
            FeedbackRecord(
                id="fb-014",
                conversation_id="conv-ei-05",
                message_id="msg-014",
                workspace_id="ws-ei-juris",
                user_id="demo-alice",
                signal="accept",
                correction_text=None,
                reason=None,
                original_answer_hash="ee5f6a1b2c3d",
                cited_sources=["nhl-rulebook-excerpt.txt", "dops-ruling-sample.txt"],
                confidence_score=0.78,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-09T09:15:00Z",
            ),
            FeedbackRecord(
                id="fb-015",
                conversation_id="conv-ei-06",
                message_id="msg-015",
                workspace_id="ws-ei-juris",
                user_id="demo-eve",
                signal="reject",
                correction_text=(
                    "Answer missed the claimant's hours of insurable employment "
                    "context from the prior decision."
                ),
                reason="missing_context",
                original_answer_hash="ef6a1b2c3d4e",
                cited_sources=["dops-ruling-sample.txt"],
                confidence_score=0.35,
                model_version="gpt-5.1",
                prompt_version="v3.2",
                created_at="2026-04-10T16:30:00Z",
            ),
        ]
        for fb in feedback_seed:
            self._feedback.append(fb)

        # 20 QuestionAnalytics: 15 had_answer=True, 5 had_answer=False; 15 en, 5 fr; 3 escalated
        questions_seed = [
            QuestionAnalytics(
                id="qa-001",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=3,
                confidence_score=0.91,
                escalation_triggered=False,
                created_at="2026-04-01T10:05:00Z",
            ),
            QuestionAnalytics(
                id="qa-002",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=2,
                confidence_score=0.85,
                escalation_triggered=False,
                created_at="2026-04-02T11:10:00Z",
            ),
            QuestionAnalytics(
                id="qa-003",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=4,
                confidence_score=0.78,
                escalation_triggered=False,
                created_at="2026-04-03T09:35:00Z",
            ),
            QuestionAnalytics(
                id="qa-004",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="fr",
                topic_cluster=None,
                had_answer=True,
                sources_found=2,
                confidence_score=0.72,
                escalation_triggered=False,
                created_at="2026-04-04T14:05:00Z",
            ),
            QuestionAnalytics(
                id="qa-005",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="en",
                topic_cluster=None,
                had_answer=False,
                sources_found=0,
                confidence_score=0.0,
                escalation_triggered=True,
                created_at="2026-04-05T10:20:00Z",
            ),
            QuestionAnalytics(
                id="qa-006",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=3,
                confidence_score=0.88,
                escalation_triggered=False,
                created_at="2026-04-06T11:35:00Z",
            ),
            QuestionAnalytics(
                id="qa-007",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="fr",
                topic_cluster=None,
                had_answer=False,
                sources_found=0,
                confidence_score=0.0,
                escalation_triggered=True,
                created_at="2026-04-07T08:50:00Z",
            ),
            QuestionAnalytics(
                id="qa-008",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=5,
                confidence_score=0.94,
                escalation_triggered=False,
                created_at="2026-04-08T13:05:00Z",
            ),
            QuestionAnalytics(
                id="qa-009",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=2,
                confidence_score=0.65,
                escalation_triggered=False,
                created_at="2026-04-09T15:25:00Z",
            ),
            QuestionAnalytics(
                id="qa-010",
                workspace_id="ws-oas-act",
                archetype="legislation",
                language="fr",
                topic_cluster=None,
                had_answer=False,
                sources_found=1,
                confidence_score=0.15,
                escalation_triggered=False,
                created_at="2026-04-10T10:00:00Z",
            ),
            QuestionAnalytics(
                id="qa-011",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=4,
                confidence_score=0.89,
                escalation_triggered=False,
                created_at="2026-04-01T09:05:00Z",
            ),
            QuestionAnalytics(
                id="qa-012",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=3,
                confidence_score=0.83,
                escalation_triggered=False,
                created_at="2026-04-03T10:35:00Z",
            ),
            QuestionAnalytics(
                id="qa-013",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=2,
                confidence_score=0.76,
                escalation_triggered=False,
                created_at="2026-04-05T14:50:00Z",
            ),
            QuestionAnalytics(
                id="qa-014",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="fr",
                topic_cluster=None,
                had_answer=True,
                sources_found=3,
                confidence_score=0.81,
                escalation_triggered=False,
                created_at="2026-04-06T09:00:00Z",
            ),
            QuestionAnalytics(
                id="qa-015",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="en",
                topic_cluster=None,
                had_answer=False,
                sources_found=0,
                confidence_score=0.0,
                escalation_triggered=True,
                created_at="2026-04-07T11:05:00Z",
            ),
            QuestionAnalytics(
                id="qa-016",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=5,
                confidence_score=0.92,
                escalation_triggered=False,
                created_at="2026-04-08T14:00:00Z",
            ),
            QuestionAnalytics(
                id="qa-017",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=2,
                confidence_score=0.70,
                escalation_triggered=False,
                created_at="2026-04-09T09:20:00Z",
            ),
            QuestionAnalytics(
                id="qa-018",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="fr",
                topic_cluster=None,
                had_answer=False,
                sources_found=0,
                confidence_score=0.0,
                escalation_triggered=False,
                created_at="2026-04-10T16:35:00Z",
            ),
            QuestionAnalytics(
                id="qa-019",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=3,
                confidence_score=0.86,
                escalation_triggered=False,
                created_at="2026-04-11T10:00:00Z",
            ),
            QuestionAnalytics(
                id="qa-020",
                workspace_id="ws-ei-juris",
                archetype="case_law",
                language="en",
                topic_cluster=None,
                had_answer=True,
                sources_found=4,
                confidence_score=0.90,
                escalation_triggered=False,
                created_at="2026-04-12T11:30:00Z",
            ),
        ]
        for q in questions_seed:
            self._questions.append(q)

    # -- Writes ----------------------------------------------------------

    def add_feedback(self, record: FeedbackRecord) -> None:
        self._feedback.append(record)

    def add_question(self, record: QuestionAnalytics) -> None:
        self._questions.append(record)

    # -- Reads -----------------------------------------------------------

    def get_feedback_by_workspace(self, workspace_id: str) -> list[FeedbackRecord]:
        return [r for r in self._feedback if r.workspace_id == workspace_id]

    def get_questions_by_workspace(self, workspace_id: str) -> list[QuestionAnalytics]:
        return [q for q in self._questions if q.workspace_id == workspace_id]

    # -- Analytics -------------------------------------------------------

    def get_feedback_summary(
        self,
        workspace_id: str | None = None,
        days: int = 30,
    ) -> FeedbackSummary:
        """Compute acceptance rate, avg confidence, and top correction reasons."""
        now = datetime.now(UTC)
        cutoff = now - timedelta(days=days)

        records = self._feedback
        if workspace_id is not None:
            records = [r for r in records if r.workspace_id == workspace_id]

        records = [r for r in records if datetime.fromisoformat(r.created_at) >= cutoff]

        total = len(records)
        accepted = [r for r in records if r.signal == "accept"]
        rejected = [r for r in records if r.signal == "reject"]
        corrections = [r for r in records if r.correction_text is not None]

        acceptance_rate = len(accepted) / total if total else 0.0
        avg_conf_accepted = (
            sum(r.confidence_score for r in accepted) / len(accepted) if accepted else 0.0
        )
        avg_conf_rejected = (
            sum(r.confidence_score for r in rejected) / len(rejected) if rejected else 0.0
        )

        reason_counter: Counter[str] = Counter()
        for r in records:
            if r.reason:
                reason_counter[r.reason] += 1

        top_reasons = [
            {"reason": reason, "count": count} for reason, count in reason_counter.most_common(10)
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

    def get_content_gaps(self, workspace_id: str | None = None) -> list[dict]:
        """Questions where had_answer=False or confidence < 0.4, grouped by pattern."""
        questions = self._questions
        if workspace_id is not None:
            questions = [q for q in questions if q.workspace_id == workspace_id]

        gaps = [q for q in questions if not q.had_answer or q.confidence_score < 0.4]

        # Group by archetype (or "unknown")
        archetype_groups: dict[str, list[QuestionAnalytics]] = {}
        for g in gaps:
            key = g.archetype or "unknown"
            archetype_groups.setdefault(key, []).append(g)

        return [
            {
                "archetype": archetype,
                "count": len(items),
                "avg_confidence": round(sum(q.confidence_score for q in items) / len(items), 4),
                "no_answer_count": sum(1 for q in items if not q.had_answer),
                "languages": list({q.language for q in items}),
            }
            for archetype, items in sorted(archetype_groups.items(), key=lambda kv: -len(kv[1]))
        ]

    def get_source_quality(self, workspace_id: str | None = None) -> list[dict]:
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
            results.append({
                "source": source,
                "total_feedback": total,
                "accept_count": stats["accept"],
                "reject_count": stats["reject"],
                "acceptance_rate": round(stats["accept"] / total, 4) if total else 0.0,
            })

        # Sort by acceptance rate ascending so worst sources surface first
        results.sort(key=lambda r: r["acceptance_rate"])
        return results
