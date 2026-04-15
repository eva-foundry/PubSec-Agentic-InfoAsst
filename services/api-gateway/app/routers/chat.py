"""Chat & RAG endpoints — wired to the ReAct agent orchestrator."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..agents.orchestrator import AgentOrchestrator
from ..auth import UserContext, get_current_user
from ..models.chat import ChatRequest
from ..tools.cite import CitationTool
from ..tools.registry import ToolRegistry
from ..tools.search import SearchTool
from ..tools.translate import TranslationTool

router = APIRouter()


def _build_registry() -> ToolRegistry:
    """Build and populate the tool registry with all available tools."""
    registry = ToolRegistry()
    registry.register(SearchTool())
    registry.register(CitationTool())
    registry.register(TranslationTool())
    return registry


# Module-level singleton — created once, reused across requests.
_registry = _build_registry()


class FeedbackPayload(BaseModel):
    conversation_id: str
    message_id: str
    rating: str = Field(description="'positive' | 'negative'")
    correction: str | None = None
    comment: str | None = None


async def _orchestrator_stream(
    user: UserContext, req: ChatRequest
) -> AsyncIterator[str]:
    """Run the agent orchestrator and yield NDJSON lines."""
    trace_id = f"trace-{uuid.uuid4()}"
    orchestrator = AgentOrchestrator(
        tool_registry=_registry,
        model_client=None,  # Uses MockModelClient for now
        trace_id=trace_id,
    )

    overrides = req.overrides.model_dump() if req.overrides else None

    async for line in orchestrator.run(
        user_message=req.message,
        conversation_history=[],
        workspace_id=req.workspace_id,
        mode=req.mode,
        overrides=overrides,
    ):
        yield line


@router.post("/chat")
async def chat(
    req: ChatRequest,
    user: UserContext = Depends(get_current_user),
) -> StreamingResponse:
    """Stream a RAG-grounded chat response as NDJSON."""
    return StreamingResponse(
        _orchestrator_stream(user, req),
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
