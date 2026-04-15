"""Feedback capture logic — creates records from raw user signals."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

from .models import FeedbackRecord, QuestionAnalytics
from .store import FeedbackStore


class FeedbackCapture:
    """Captures and processes user feedback on agent responses."""

    def __init__(self, store: FeedbackStore) -> None:
        self.store = store

    def capture_feedback(
        self,
        conversation_id: str,
        message_id: str,
        workspace_id: str | None,
        user_id: str,
        signal: str,
        correction_text: str | None,
        reason: str | None,
        original_answer: str,
        cited_sources: list[str],
        confidence_score: float,
        model_version: str,
        prompt_version: str,
    ) -> FeedbackRecord:
        """Create and store a feedback record. Hash the answer for privacy."""
        answer_hash = hashlib.sha256(original_answer.encode("utf-8")).hexdigest()

        record = FeedbackRecord(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            message_id=message_id,
            workspace_id=workspace_id,
            user_id=user_id,
            signal=signal,
            correction_text=correction_text,
            reason=reason,
            original_answer_hash=answer_hash,
            cited_sources=cited_sources,
            confidence_score=confidence_score,
            model_version=model_version,
            prompt_version=prompt_version,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.store.add_feedback(record)
        return record

    def capture_question(
        self,
        workspace_id: str | None,
        archetype: str | None,
        language: str,
        had_answer: bool,
        sources_found: int,
        confidence_score: float,
        escalation_triggered: bool,
    ) -> QuestionAnalytics:
        """Record anonymized question analytics."""
        record = QuestionAnalytics(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            archetype=archetype,
            language=language,
            topic_cluster=None,
            had_answer=had_answer,
            sources_found=sources_found,
            confidence_score=confidence_score,
            escalation_triggered=escalation_triggered,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.store.add_question(record)
        return record
