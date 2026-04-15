"""Tests for the feedback capture backend."""

from __future__ import annotations

import hashlib

from fastapi.testclient import TestClient

from app.feedback import FeedbackCapture, FeedbackStore
from app.main import app

client = TestClient(app)


# ── Unit tests: FeedbackCapture + FeedbackStore ────────────────────


def _make_capture() -> tuple[FeedbackStore, FeedbackCapture]:
    store = FeedbackStore()
    capture = FeedbackCapture(store=store)
    return store, capture


def test_capture_feedback_accept():
    store, capture = _make_capture()
    record = capture.capture_feedback(
        conversation_id="conv-1",
        message_id="msg-1",
        workspace_id="ws-oas-act",
        user_id="alice",
        signal="accept",
        correction_text=None,
        reason=None,
        original_answer="The OAS Act applies to...",
        cited_sources=["doc-a.pdf", "doc-b.pdf"],
        confidence_score=0.92,
        model_version="gpt-5.1",
        prompt_version="v3.2",
    )
    assert record.signal == "accept"
    assert record.correction_text is None
    assert record.confidence_score == 0.92
    # 15 seeded + 1 new = 16
    assert len(store._feedback) == 16


def test_capture_feedback_reject_with_correction():
    store, capture = _make_capture()
    record = capture.capture_feedback(
        conversation_id="conv-2",
        message_id="msg-2",
        workspace_id="ws-ei-juris",
        user_id="bob",
        signal="reject",
        correction_text="The correct section is 54(1), not 54(2).",
        reason="citation_incorrect",
        original_answer="Section 54(2) states...",
        cited_sources=["ei-act.pdf"],
        confidence_score=0.65,
        model_version="gpt-5.1",
        prompt_version="v3.2",
    )
    assert record.signal == "reject"
    assert record.correction_text == "The correct section is 54(1), not 54(2)."
    assert record.reason == "citation_incorrect"


def test_answer_hash_is_sha256():
    _store, capture = _make_capture()
    answer = "The OAS Act applies to persons aged 65 and older."
    record = capture.capture_feedback(
        conversation_id="conv-3",
        message_id="msg-3",
        workspace_id=None,
        user_id="carol",
        signal="accept",
        correction_text=None,
        reason=None,
        original_answer=answer,
        cited_sources=[],
        confidence_score=0.88,
        model_version="gpt-5.1",
        prompt_version="v3.2",
    )
    expected_hash = hashlib.sha256(answer.encode("utf-8")).hexdigest()
    assert record.original_answer_hash == expected_hash


def test_feedback_summary_calculation():
    store, capture = _make_capture()

    # 3 accepts (confidence 0.9, 0.8, 0.7) + 2 rejects (confidence 0.4, 0.3)
    for i, (sig, conf, reason) in enumerate(
        [
            ("accept", 0.9, None),
            ("accept", 0.8, None),
            ("accept", 0.7, None),
            ("reject", 0.4, "answer_incomplete"),
            ("reject", 0.3, "citation_incorrect"),
        ]
    ):
        capture.capture_feedback(
            conversation_id=f"conv-{i}",
            message_id=f"msg-{i}",
            workspace_id="ws-test",
            user_id="tester",
            signal=sig,
            correction_text="fix" if sig == "reject" else None,
            reason=reason,
            original_answer=f"answer-{i}",
            cited_sources=[],
            confidence_score=conf,
            model_version="gpt-5.1",
            prompt_version="v3.2",
        )

    summary = store.get_feedback_summary(workspace_id="ws-test")
    assert summary.total_feedback == 5
    assert summary.acceptance_rate == 0.6  # 3/5
    assert summary.correction_count == 2
    assert abs(summary.avg_confidence_accepted - 0.8) < 0.01  # (0.9+0.8+0.7)/3
    assert abs(summary.avg_confidence_rejected - 0.35) < 0.01  # (0.4+0.3)/2
    assert len(summary.top_correction_reasons) == 2


def test_content_gaps_detection():
    store, capture = _make_capture()

    # Question with no answer
    capture.capture_question(
        workspace_id="ws-test",
        archetype="legislation",
        language="en",
        had_answer=False,
        sources_found=0,
        confidence_score=0.0,
        escalation_triggered=True,
    )
    # Question with low confidence
    capture.capture_question(
        workspace_id="ws-test",
        archetype="legislation",
        language="fr",
        had_answer=True,
        sources_found=2,
        confidence_score=0.25,
        escalation_triggered=False,
    )
    # Good question (should NOT be a gap)
    capture.capture_question(
        workspace_id="ws-test",
        archetype="faq",
        language="en",
        had_answer=True,
        sources_found=5,
        confidence_score=0.95,
        escalation_triggered=False,
    )

    gaps = store.get_content_gaps(workspace_id="ws-test")
    assert len(gaps) == 1  # Only "legislation" archetype has gaps
    assert gaps[0]["archetype"] == "legislation"
    assert gaps[0]["count"] == 2
    assert gaps[0]["no_answer_count"] == 1
    assert set(gaps[0]["languages"]) == {"en", "fr"}


def test_source_quality_aggregation():
    store, capture = _make_capture()

    # Source A: 2 accepts, 1 reject -> 66.67% acceptance
    # Source B: 1 accept, 0 reject -> 100% acceptance
    for sig in ["accept", "accept", "reject"]:
        capture.capture_feedback(
            conversation_id="c",
            message_id="m",
            workspace_id="ws-test",
            user_id="u",
            signal=sig,
            correction_text=None,
            reason=None,
            original_answer="a",
            cited_sources=["source-a.pdf"],
            confidence_score=0.8,
            model_version="gpt-5.1",
            prompt_version="v3.2",
        )

    capture.capture_feedback(
        conversation_id="c2",
        message_id="m2",
        workspace_id="ws-test",
        user_id="u",
        signal="accept",
        correction_text=None,
        reason=None,
        original_answer="b",
        cited_sources=["source-b.pdf"],
        confidence_score=0.9,
        model_version="gpt-5.1",
        prompt_version="v3.2",
    )

    quality = store.get_source_quality(workspace_id="ws-test")
    assert len(quality) == 2

    # Sorted by acceptance_rate ascending (worst first)
    worst = quality[0]
    assert worst["source"] == "source-a.pdf"
    assert worst["total_feedback"] == 3
    assert worst["accept_count"] == 2
    assert worst["reject_count"] == 1
    assert abs(worst["acceptance_rate"] - 0.6667) < 0.001

    best = quality[1]
    assert best["source"] == "source-b.pdf"
    assert best["acceptance_rate"] == 1.0


def test_capture_question_analytics():
    store, capture = _make_capture()
    record = capture.capture_question(
        workspace_id="ws-oas-act",
        archetype="legislation",
        language="en",
        had_answer=True,
        sources_found=3,
        confidence_score=0.85,
        escalation_triggered=False,
    )
    assert record.workspace_id == "ws-oas-act"
    assert record.archetype == "legislation"
    assert record.topic_cluster is None  # Not yet clustered
    assert record.had_answer is True
    # 20 seeded + 1 new = 21
    assert len(store._questions) == 21


# ── API endpoint test ──────────────────────────────────────────────


def test_feedback_api_endpoint_returns_201():
    response = client.post(
        "/v1/eva/chat/feedback",
        json={
            "conversation_id": "conv-api-1",
            "message_id": "msg-api-1",
            "signal": "accept",
            "original_answer": "Test answer",
            "confidence_score": 0.9,
        },
        headers={"x-demo-user-email": "alice@demo.gc.ca"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["signal"] == "accept"
    assert data["status"] == "recorded"
    assert "id" in data
