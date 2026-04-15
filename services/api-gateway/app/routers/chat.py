"""Chat & RAG endpoints — wired to the ReAct agent orchestrator."""

from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..agents.azure_client import AzureOpenAIModelClient
from ..agents.embedding_client import AzureEmbeddingClient, MockEmbeddingClient
from ..agents.orchestrator import AgentOrchestrator
from ..auth import UserContext, get_current_user
from ..config import get_settings
from ..feedback import FeedbackCapture, FeedbackStore
from ..models.chat import ChatRequest
from ..stores import chat_store, telemetry_store, vector_store
from ..stores.chat_store import ChatHistoryRecord
from ..tools.cite import CitationTool
from ..tools.registry import ToolRegistry
from ..tools.search import SearchTool
from ..tools.translate import TranslationTool

router = APIRouter()

# Conditionally create real Azure OpenAI client (falls back to MockModelClient if unset)
_settings = get_settings()
_model_client = None
if _settings.azure_openai_endpoint and _settings.azure_openai_api_key:
    _model_client = AzureOpenAIModelClient(
        endpoint=_settings.azure_openai_endpoint,
        api_key=_settings.azure_openai_api_key,
        deployment=_settings.azure_openai_deployment,
        api_version=_settings.azure_openai_api_version,
    )

# Create embedding client for search
_embedding_client = None
if _settings.azure_openai_endpoint and _settings.azure_openai_api_key:
    _embedding_client = AzureEmbeddingClient(
        endpoint=_settings.azure_openai_endpoint,
        api_key=_settings.azure_openai_api_key,
        deployment=_settings.azure_openai_embedding_deployment,
    )
else:
    _embedding_client = MockEmbeddingClient()


def _build_registry() -> ToolRegistry:
    """Build and populate the tool registry with all available tools."""
    registry = ToolRegistry()
    registry.register(SearchTool(vector_store=vector_store, embedding_client=_embedding_client))
    registry.register(CitationTool())
    registry.register(TranslationTool())
    return registry


# Module-level singletons — created once, reused across requests.
_registry = _build_registry()
feedback_store = FeedbackStore()
feedback_capture = FeedbackCapture(store=feedback_store)


class FeedbackPayload(BaseModel):
    conversation_id: str
    message_id: str
    signal: str = Field(description="'accept' | 'reject'")
    correction_text: str | None = None
    reason: str | None = None
    original_answer: str = ""
    cited_sources: list[str] = Field(default_factory=list)
    confidence_score: float = 0.0
    model_version: str = "unknown"
    prompt_version: str = "unknown"
    workspace_id: str | None = None


async def _orchestrator_stream(
    user: UserContext, req: ChatRequest
) -> AsyncIterator[str]:
    """Run the agent orchestrator, yield NDJSON lines, and record to chat_store."""
    trace_id = f"trace-{uuid.uuid4()}"
    conversation_id = req.conversation_id or str(uuid.uuid4())
    orchestrator = AgentOrchestrator(
        tool_registry=_registry,
        model_client=_model_client,
        trace_id=trace_id,
    )

    overrides = req.overrides.model_dump() if req.overrides else None
    now = datetime.now(timezone.utc).isoformat()

    # Record the user message
    user_msg_id = f"msg-{uuid.uuid4().hex[:8]}"
    chat_store.add(ChatHistoryRecord(
        conversation_id=conversation_id,
        message_id=user_msg_id,
        workspace_id=req.workspace_id,
        user_id=user.user_id,
        role="user",
        content_preview=req.message[:200],
        content_hash=hashlib.sha256(req.message.encode()).hexdigest(),
        citations=[],
        provenance=None,
        agent_steps=[],
        confidence_score=0.0,
        model="gpt-5.1-2026-04",
        mode=req.mode,
        created_at=now,
    ))

    # Collect streamed data for recording the assistant response
    full_content = ""
    agent_steps: list[dict] = []
    citations: list[dict] = []
    provenance: dict | None = None
    confidence_score = 0.0

    async for line in orchestrator.run(
        user_message=req.message,
        conversation_history=[],
        workspace_id=req.workspace_id,
        mode=req.mode,
        overrides=overrides,
    ):
        yield line

        # Parse the NDJSON line to capture data for the history record
        try:
            event = json.loads(line.strip())
        except (json.JSONDecodeError, ValueError):
            continue

        if "content" in event:
            full_content += event["content"]
        elif "agent_step" in event:
            step = event["agent_step"]
            if step.get("status") == "complete":
                agent_steps.append(step)
        elif "provenance_complete" in event:
            prov = event["provenance_complete"]
            provenance = prov
            # Extract confidence directly (float 0-1)
            conf_val = prov.get("confidence", 0)
            if isinstance(conf_val, (int, float)):
                confidence_score = float(conf_val)
            # Build citation summaries from provenance metadata
            cited_count = prov.get("sources_cited", 0)
            if cited_count > 0:
                # Reconstruct minimal citation info from agent steps
                for step in agent_steps:
                    if step.get("tool") == "cite":
                        meta = step.get("metadata", {})
                        citations = [
                            {"index": i + 1, "resolved": True}
                            for i in range(meta.get("citations_resolved", cited_count))
                        ]
                        break

    # Record the assistant message
    assistant_msg_id = f"msg-{uuid.uuid4().hex[:8]}"
    assistant_now = datetime.now(timezone.utc).isoformat()
    chat_store.add(ChatHistoryRecord(
        conversation_id=conversation_id,
        message_id=assistant_msg_id,
        workspace_id=req.workspace_id,
        user_id=user.user_id,
        role="assistant",
        content_preview=full_content[:200],
        content_hash=hashlib.sha256(full_content.encode()).hexdigest(),
        citations=citations,
        provenance=provenance,
        agent_steps=agent_steps,
        confidence_score=round(confidence_score, 4),
        model="gpt-5.1-2026-04",
        mode=req.mode,
        created_at=assistant_now,
    ))


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


@router.get("/conversations")
async def list_conversations(
    workspace_id: str | None = None,
    user_id: str | None = None,
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    """Return conversation summaries (seeded + live)."""
    summaries = chat_store.list_conversations(
        workspace_id=workspace_id, user_id=user_id,
    )
    return [s.model_dump() for s in summaries]


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    """Return all messages for a specific conversation."""
    messages = chat_store.get_conversation(conversation_id)
    return [m.model_dump() for m in messages]


@router.get("/session/cost")
async def get_session_cost(request: Request) -> dict:
    """Return accumulated cost for the current browser session."""
    session_id = request.cookies.get("eva_session_id")
    if not session_id:
        return {"session_id": None, "cost_cad": 0.0, "queries": 0}
    return telemetry_store.session_cost(session_id)


@router.post("/chat/feedback", status_code=201)
async def submit_feedback(
    payload: FeedbackPayload,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Record user feedback (thumbs up/down, correction) for a message."""
    record = feedback_capture.capture_feedback(
        conversation_id=payload.conversation_id,
        message_id=payload.message_id,
        workspace_id=payload.workspace_id,
        user_id=user.user_id,
        signal=payload.signal,
        correction_text=payload.correction_text,
        reason=payload.reason,
        original_answer=payload.original_answer,
        cited_sources=payload.cited_sources,
        confidence_score=payload.confidence_score,
        model_version=payload.model_version,
        prompt_version=payload.prompt_version,
    )
    return {
        "id": record.id,
        "conversation_id": record.conversation_id,
        "message_id": record.message_id,
        "signal": record.signal,
        "submitted_by": user.user_id,
        "status": "recorded",
    }
