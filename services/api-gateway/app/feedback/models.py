"""Feedback domain models."""

from __future__ import annotations

from pydantic import BaseModel


class FeedbackRecord(BaseModel):
    id: str
    conversation_id: str
    message_id: str
    workspace_id: str | None
    user_id: str
    signal: str  # "accept" | "reject"
    correction_text: str | None
    reason: str | None
    original_answer_hash: str
    cited_sources: list[str]
    confidence_score: float
    model_version: str
    prompt_version: str
    created_at: str


class QuestionAnalytics(BaseModel):
    id: str
    workspace_id: str | None
    archetype: str | None
    language: str
    topic_cluster: str | None  # Set by async clustering, null initially
    had_answer: bool
    sources_found: int
    confidence_score: float
    escalation_triggered: bool
    created_at: str


class FeedbackSummary(BaseModel):
    total_feedback: int
    acceptance_rate: float
    correction_count: int
    avg_confidence_accepted: float
    avg_confidence_rejected: float
    top_correction_reasons: list[dict]
    period_start: str
    period_end: str
