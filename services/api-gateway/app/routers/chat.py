"""Chat & RAG endpoints — wired to the ReAct agent orchestrator."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

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
from ..stores import telemetry_store, vector_store
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
    """Run the agent orchestrator and yield NDJSON lines."""
    trace_id = f"trace-{uuid.uuid4()}"
    orchestrator = AgentOrchestrator(
        tool_registry=_registry,
        model_client=_model_client,  # Real Azure client or None (MockModelClient fallback)
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
