"""In-memory chat history store — records conversations for AIOps tracing.

Seeded with realistic past conversations across workspaces.
In production this would be backed by Cosmos DB.
"""

from __future__ import annotations

import hashlib
import random
import uuid
from collections import defaultdict

from pydantic import BaseModel, Field


class ChatHistoryRecord(BaseModel):
    """Single message within a conversation — privacy-safe (no full content)."""

    conversation_id: str
    message_id: str
    workspace_id: str | None
    user_id: str
    role: str  # "user" | "assistant"
    content_preview: str  # first 200 chars
    content_hash: str  # SHA-256 of full content
    citations: list[dict] = Field(default_factory=list)
    provenance: dict | None = None
    agent_steps: list[dict] = Field(default_factory=list)
    confidence_score: float = 0.0
    model: str = "gpt-5.1-2026-04"
    mode: str = "grounded"  # "grounded" | "ungrounded"
    created_at: str = ""


class ConversationSummary(BaseModel):
    """Lightweight summary for conversation list views."""

    conversation_id: str
    workspace_id: str | None
    user_id: str
    title: str  # first user message truncated to 50 chars
    message_count: int
    last_message_at: str
    avg_confidence: float
    mode: str


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _preview(text: str, limit: int = 200) -> str:
    return text[:limit]


class ChatStore:
    """In-memory chat history store with seed data."""

    def __init__(self) -> None:
        self._records: list[ChatHistoryRecord] = []
        self._seed()

    # ------------------------------------------------------------------
    # Seed data
    # ------------------------------------------------------------------

    def _seed(self) -> None:
        """Pre-populate 4 past conversations with varied confidence and workspaces."""
        rng = random.Random(99)

        # ---- conv-seed-1: 4 messages in ws-oas-act, high confidence ----
        conv1 = "conv-seed-1"
        self._records.extend([
            ChatHistoryRecord(
                conversation_id=conv1, message_id="msg-s1-1",
                workspace_id="ws-oas-act", user_id="demo-alice",
                role="user",
                content_preview=_preview("What are the eligibility requirements for Old Age Security?"),
                content_hash=_sha256("What are the eligibility requirements for Old Age Security?"),
                citations=[], provenance=None, agent_steps=[],
                confidence_score=0.0, model="gpt-5.1-2026-04", mode="grounded",
                created_at="2026-04-10T09:00:00Z",
            ),
            ChatHistoryRecord(
                conversation_id=conv1, message_id="msg-s1-2",
                workspace_id="ws-oas-act", user_id="demo-alice",
                role="assistant",
                content_preview=_preview(
                    "Based on the Old Age Security Act, eligibility requires Canadian residency "
                    "of at least 10 years after age 18 for a partial pension, or 40 years for a full pension [1]. "
                    "The applicant must be 65 years of age or older [1]."
                ),
                content_hash=_sha256("oas-eligibility-answer-full"),
                citations=[
                    {"file": "oas-act-excerpt.txt", "page": 1, "section": "Section 3"},
                ],
                provenance={"correlation_id": "corr-s1-1", "model": "gpt-5.1-2026-04"},
                agent_steps=[
                    {"id": 1, "tool": "query_rewrite", "status": "complete", "duration_ms": 95},
                    {"id": 2, "tool": "search", "status": "complete", "duration_ms": 280, "metadata": {"sources_found": 4}},
                    {"id": 3, "tool": "cite", "status": "complete", "duration_ms": 45},
                    {"id": 4, "tool": "answer", "status": "complete", "duration_ms": 720},
                ],
                confidence_score=0.92, model="gpt-5.1-2026-04", mode="grounded",
                created_at="2026-04-10T09:00:12Z",
            ),
            ChatHistoryRecord(
                conversation_id=conv1, message_id="msg-s1-3",
                workspace_id="ws-oas-act", user_id="demo-alice",
                role="user",
                content_preview=_preview("What about partial pension calculation?"),
                content_hash=_sha256("What about partial pension calculation?"),
                citations=[], provenance=None, agent_steps=[],
                confidence_score=0.0, model="gpt-5.1-2026-04", mode="grounded",
                created_at="2026-04-10T09:01:30Z",
            ),
            ChatHistoryRecord(
                conversation_id=conv1, message_id="msg-s1-4",
                workspace_id="ws-oas-act", user_id="demo-alice",
                role="assistant",
                content_preview=_preview(
                    "The partial pension is calculated as 1/40th of the full pension for each complete year "
                    "of residence in Canada after the age of 18 [1]. A minimum of 10 years of residence is required [1]."
                ),
                content_hash=_sha256("oas-partial-pension-answer-full"),
                citations=[
                    {"file": "oas-act-excerpt.txt", "page": 1, "section": "Section 3(2)"},
                    {"file": "oas-regulations-excerpt.txt", "page": 2, "section": "Part II"},
                ],
                provenance={"correlation_id": "corr-s1-2", "model": "gpt-5.1-2026-04"},
                agent_steps=[
                    {"id": 1, "tool": "query_rewrite", "status": "complete", "duration_ms": 88},
                    {"id": 2, "tool": "search", "status": "complete", "duration_ms": 310, "metadata": {"sources_found": 5}},
                    {"id": 3, "tool": "cite", "status": "complete", "duration_ms": 52},
                    {"id": 4, "tool": "answer", "status": "complete", "duration_ms": 680},
                ],
                confidence_score=0.85, model="gpt-5.1-2026-04", mode="grounded",
                created_at="2026-04-10T09:01:45Z",
            ),
        ])

        # ---- conv-seed-2: 2 messages in ws-ei-juris, medium confidence ----
        conv2 = "conv-seed-2"
        self._records.extend([
            ChatHistoryRecord(
                conversation_id=conv2, message_id="msg-s2-1",
                workspace_id="ws-ei-juris", user_id="demo-eve",
                role="user",
                content_preview=_preview("Has the SST considered voluntary departure cases where the claimant had just cause?"),
                content_hash=_sha256("voluntary-departure-just-cause-question"),
                citations=[], provenance=None, agent_steps=[],
                confidence_score=0.0, model="gpt-5.1-2026-04", mode="grounded",
                created_at="2026-04-11T14:20:00Z",
            ),
            ChatHistoryRecord(
                conversation_id=conv2, message_id="msg-s2-2",
                workspace_id="ws-ei-juris", user_id="demo-eve",
                role="assistant",
                content_preview=_preview(
                    "The Social Security Tribunal has addressed voluntary departure with just cause in several "
                    "decisions. In the sample decision provided, the Tribunal examined whether the claimant had "
                    "exhausted reasonable alternatives before leaving employment [1]."
                ),
                content_hash=_sha256("voluntary-departure-answer-full"),
                citations=[
                    {"file": "ei-tribunal-decision-sample.txt", "page": 1, "section": "Analysis"},
                ],
                provenance={"correlation_id": "corr-s2-1", "model": "gpt-5.1-2026-04"},
                agent_steps=[
                    {"id": 1, "tool": "query_rewrite", "status": "complete", "duration_ms": 105},
                    {"id": 2, "tool": "search", "status": "complete", "duration_ms": 420, "metadata": {"sources_found": 3}},
                    {"id": 3, "tool": "cite", "status": "complete", "duration_ms": 38},
                    {"id": 4, "tool": "answer", "status": "complete", "duration_ms": 850},
                ],
                confidence_score=0.62, model="gpt-5.1-2026-04", mode="grounded",
                created_at="2026-04-11T14:20:18Z",
            ),
        ])

        # ---- conv-seed-3: 3 messages in ws-oas-act, low confidence, escalation ----
        conv3 = "conv-seed-3"
        self._records.extend([
            ChatHistoryRecord(
                conversation_id=conv3, message_id="msg-s3-1",
                workspace_id="ws-oas-act", user_id="demo-bob",
                role="user",
                content_preview=_preview("Does the OAS Act apply to non-residents who lived in Canada for 8 years?"),
                content_hash=_sha256("non-resident-8-years-question"),
                citations=[], provenance=None, agent_steps=[],
                confidence_score=0.0, model="gpt-5.1-2026-04", mode="grounded",
                created_at="2026-04-12T10:00:00Z",
            ),
            ChatHistoryRecord(
                conversation_id=conv3, message_id="msg-s3-2",
                workspace_id="ws-oas-act", user_id="demo-bob",
                role="assistant",
                content_preview=_preview(
                    "I was unable to find sufficient information in the available sources to fully address "
                    "this question. The sources indicate a minimum 10-year residency requirement, but the "
                    "specific case of 8 years with non-resident status is not directly addressed."
                ),
                content_hash=_sha256("non-resident-answer-low-confidence"),
                citations=[
                    {"file": "oas-act-excerpt.txt", "page": 1, "section": "Section 3(1)(b)"},
                ],
                provenance={
                    "correlation_id": "corr-s3-1",
                    "model": "gpt-5.1-2026-04",
                    "escalation_triggered": True,
                    "escalation_reason": "Confidence below threshold (0.35 < 0.50)",
                },
                agent_steps=[
                    {"id": 1, "tool": "query_rewrite", "status": "complete", "duration_ms": 110},
                    {"id": 2, "tool": "search", "status": "complete", "duration_ms": 350, "metadata": {"sources_found": 2}},
                    {"id": 3, "tool": "cite", "status": "complete", "duration_ms": 30},
                    {"id": 4, "tool": "answer", "status": "complete", "duration_ms": 900},
                ],
                confidence_score=0.35, model="gpt-5.1-2026-04", mode="grounded",
                created_at="2026-04-12T10:00:22Z",
            ),
            ChatHistoryRecord(
                conversation_id=conv3, message_id="msg-s3-3",
                workspace_id="ws-oas-act", user_id="demo-bob",
                role="user",
                content_preview=_preview("Can you check the regulations as well for international agreements?"),
                content_hash=_sha256("check-regulations-international-agreements"),
                citations=[], provenance=None, agent_steps=[],
                confidence_score=0.0, model="gpt-5.1-2026-04", mode="grounded",
                created_at="2026-04-12T10:02:00Z",
            ),
        ])

        # ---- conv-seed-4: 2 messages ungrounded (no workspace), confidence 0.15 ----
        conv4 = "conv-seed-4"
        self._records.extend([
            ChatHistoryRecord(
                conversation_id=conv4, message_id="msg-s4-1",
                workspace_id=None, user_id="demo-alice",
                role="user",
                content_preview=_preview("What is the general process for applying to government benefits in Canada?"),
                content_hash=_sha256("general-benefits-question"),
                citations=[], provenance=None, agent_steps=[],
                confidence_score=0.0, model="gpt-5.1-2026-04", mode="ungrounded",
                created_at="2026-04-13T16:00:00Z",
            ),
            ChatHistoryRecord(
                conversation_id=conv4, message_id="msg-s4-2",
                workspace_id=None, user_id="demo-alice",
                role="assistant",
                content_preview=_preview(
                    "Generally, Canadian government benefits are administered through Service Canada. "
                    "The process typically involves submitting an application online or in person. "
                    "Please note this answer is not grounded in official ESDC documents."
                ),
                content_hash=_sha256("general-benefits-ungrounded-answer"),
                citations=[],
                provenance={"correlation_id": "corr-s4-1", "model": "gpt-5.1-2026-04"},
                agent_steps=[
                    {"id": 1, "tool": "answer", "status": "complete", "duration_ms": 650},
                ],
                confidence_score=0.15, model="gpt-5.1-2026-04", mode="ungrounded",
                created_at="2026-04-13T16:00:08Z",
            ),
        ])

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------

    def add(self, record: ChatHistoryRecord) -> None:
        """Append a chat history record."""
        self._records.append(record)

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def list_conversations(
        self,
        workspace_id: str | None = None,
        user_id: str | None = None,
    ) -> list[ConversationSummary]:
        """Return summarised conversation list, most recent first."""
        # Group records by conversation_id
        convos: dict[str, list[ChatHistoryRecord]] = defaultdict(list)
        for r in self._records:
            if workspace_id is not None and r.workspace_id != workspace_id:
                continue
            if user_id is not None and r.user_id != user_id:
                continue
            convos[r.conversation_id].append(r)

        summaries: list[ConversationSummary] = []
        for cid, msgs in convos.items():
            msgs_sorted = sorted(msgs, key=lambda m: m.created_at)
            first_user = next((m for m in msgs_sorted if m.role == "user"), None)
            title = first_user.content_preview[:50] if first_user else "Untitled"

            assistant_msgs = [m for m in msgs_sorted if m.role == "assistant"]
            avg_conf = (
                sum(m.confidence_score for m in assistant_msgs) / len(assistant_msgs)
                if assistant_msgs else 0.0
            )
            mode = msgs_sorted[0].mode

            summaries.append(ConversationSummary(
                conversation_id=cid,
                workspace_id=msgs_sorted[0].workspace_id,
                user_id=msgs_sorted[0].user_id,
                title=title,
                message_count=len(msgs_sorted),
                last_message_at=msgs_sorted[-1].created_at,
                avg_confidence=round(avg_conf, 4),
                mode=mode,
            ))

        # Most recent first
        summaries.sort(key=lambda s: s.last_message_at, reverse=True)
        return summaries

    def get_conversation(self, conversation_id: str) -> list[ChatHistoryRecord]:
        """Return all messages for a conversation, ordered chronologically."""
        msgs = [r for r in self._records if r.conversation_id == conversation_id]
        msgs.sort(key=lambda m: m.created_at)
        return msgs

    def get_all_assistant_messages(self) -> list[ChatHistoryRecord]:
        """Return all assistant messages (for ops metrics computation)."""
        return [r for r in self._records if r.role == "assistant"]

    def get_traces(
        self,
        workspace_id: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Return recent assistant messages with their agent steps for trace views."""
        assistant_msgs = [r for r in self._records if r.role == "assistant"]
        if workspace_id is not None:
            assistant_msgs = [r for r in assistant_msgs if r.workspace_id == workspace_id]
        assistant_msgs.sort(key=lambda m: m.created_at, reverse=True)

        return [
            {
                "conversation_id": m.conversation_id,
                "message_id": m.message_id,
                "workspace_id": m.workspace_id,
                "confidence_score": m.confidence_score,
                "agent_steps": m.agent_steps,
                "citations_count": len(m.citations),
                "model": m.model,
                "mode": m.mode,
                "created_at": m.created_at,
            }
            for m in assistant_msgs[:limit]
        ]

    def confidence_calibration(self) -> list[dict]:
        """Bucket assistant messages by confidence range, compute stats per bucket."""
        assistant_msgs = [r for r in self._records if r.role == "assistant"]
        if not assistant_msgs:
            return []

        buckets = [
            ("0.0-0.2", 0.0, 0.2),
            ("0.2-0.4", 0.2, 0.4),
            ("0.4-0.6", 0.4, 0.6),
            ("0.6-0.8", 0.6, 0.8),
            ("0.8-1.0", 0.8, 1.0),
        ]

        result: list[dict] = []
        for label, lo, hi in buckets:
            in_bucket = [
                m for m in assistant_msgs
                if lo <= m.confidence_score < hi or (hi == 1.0 and m.confidence_score == 1.0)
            ]
            if not in_bucket:
                result.append({
                    "range": label,
                    "count": 0,
                    "avg_confidence": 0.0,
                    "with_citations_pct": 0.0,
                })
                continue

            avg_conf = sum(m.confidence_score for m in in_bucket) / len(in_bucket)
            with_citations = sum(1 for m in in_bucket if m.citations)
            result.append({
                "range": label,
                "count": len(in_bucket),
                "avg_confidence": round(avg_conf, 4),
                "with_citations_pct": round(with_citations / len(in_bucket) * 100, 1),
            })

        return result
