"""Chat & RAG endpoints."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..auth import UserContext, get_current_user
from ..models.chat import ChatRequest

router = APIRouter()


class FeedbackPayload(BaseModel):
    conversation_id: str
    message_id: str
    rating: str = Field(description="'positive' | 'negative'")
    correction: str | None = None
    comment: str | None = None


async def _mock_stream(user: UserContext, req: ChatRequest) -> AsyncIterator[str]:
    """Yield NDJSON chunks simulating a streamed RAG response."""
    correlation_id = str(uuid.uuid4())
    conversation_id = req.conversation_id or str(uuid.uuid4())
    message_id = str(uuid.uuid4())

    # 1. Provenance start
    yield json.dumps({
        "type": "provenance",
        "correlation_id": correlation_id,
        "agent_id": "eva-rag-agent",
        "sources_consulted": 5,
        "sources_cited": 2,
        "confidence": 0.87,
    }) + "\n"

    # 2. Agent step indicator
    yield json.dumps({
        "type": "agent_step",
        "id": 1,
        "tool": "search",
        "status": "complete",
        "label_en": "Searching knowledge base",
        "label_fr": "Recherche dans la base de connaissances",
        "duration_ms": 320,
    }) + "\n"

    # 3. Content chunk
    yield json.dumps({
        "type": "content",
        "conversation_id": conversation_id,
        "message_id": message_id,
        "delta": f"This is a placeholder response to: '{req.message}'. "
                 "In production, this streams from the agent orchestrator with "
                 "full citations and provenance. [stub]",
        "citations": [
            {
                "file": "oas-act-2024.pdf",
                "page": 12,
                "section": "Section 4.1",
                "sas_url": "https://placeholder.blob.core.windows.net/docs/oas-act-2024.pdf?sv=stub",
            },
        ],
    }) + "\n"

    # 4. Provenance complete
    yield json.dumps({
        "type": "provenance_complete",
        "correlation_id": correlation_id,
        "confidence": 0.87,
        "escalation_tier": "auto-resolve",
        "behavioral_fingerprint": {
            "model": "gpt-5.1-2026-04",
            "prompt_version": "v3.2",
            "corpus_snapshot": "2026-04-10",
            "policy_rules_version": "v1.4",
        },
    }) + "\n"


@router.post("/chat")
async def chat(
    req: ChatRequest,
    user: UserContext = Depends(get_current_user),
) -> StreamingResponse:
    """Stream a RAG-grounded chat response as NDJSON."""
    return StreamingResponse(
        _mock_stream(user, req),
        media_type="application/x-ndjson",
    )


@router.post("/chat/feedback", status_code=201)
async def submit_feedback(
    payload: FeedbackPayload,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Record user feedback (thumbs up/down, correction) for a message."""
    return {
        "id": str(uuid.uuid4()),
        "conversation_id": payload.conversation_id,
        "message_id": payload.message_id,
        "rating": payload.rating,
        "submitted_by": user.user_id,
        "status": "recorded",
    }
