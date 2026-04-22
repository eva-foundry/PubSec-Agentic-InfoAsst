from __future__ import annotations

from pydantic import BaseModel, Field

from app.provenance.models import AgentStep, Citation, ExplainabilityRecord, ProvenanceRecord


class ChatMessage(BaseModel):
    """A single message in a conversation."""

    id: str
    conversation_id: str
    workspace_id: str | None = None
    role: str = Field(description="Message author: 'user' or 'assistant'")
    content: str
    citations: list[Citation] = Field(default_factory=list)
    provenance: ProvenanceRecord | None = None
    explainability: ExplainabilityRecord | None = None
    agent_steps: list[AgentStep] = Field(default_factory=list)
    created_at: str = Field(description="ISO timestamp")


class ChatOverrides(BaseModel):
    """Optional parameter overrides for a chat request."""

    top_k: int | None = None
    temperature: float | None = None
    response_length: int | None = None
    suggest_followup: bool | None = None


class ChatRequest(BaseModel):
    """Incoming chat request from the client."""

    message: str
    workspace_id: str | None = None
    conversation_id: str | None = None
    mode: str = Field(
        default="grounded",
        description="'grounded' = RAG with citations; 'ungrounded' = general assistant",
    )
    overrides: ChatOverrides | None = None
