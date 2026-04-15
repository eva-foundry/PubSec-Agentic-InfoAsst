from __future__ import annotations

from pydantic import BaseModel, Field


class Workspace(BaseModel):
    """An EVA DA workspace — a managed index with RBAC, cost recovery, and lifecycle."""

    id: str
    name: str
    name_fr: str = ""
    description: str = ""
    description_fr: str = ""
    type: str = Field(default="standard", description="'standard', 'premium', 'sandbox', 'restricted', 'shared'")
    status: str = Field(default="draft", description="'draft', 'pending_approval', 'active', 'suspended', 'archived'")
    owner_id: str = Field(description="Entra ID of the workspace owner")
    data_classification: str = Field(
        default="unclassified",
        description="'unclassified', 'protected_a', 'protected_b'",
    )
    document_capacity: int = Field(default=0, ge=0)
    document_count: int = Field(default=0, ge=0)
    monthly_cost: float = Field(default=0.0, ge=0)
    cost_centre: str = ""
    created_at: str = Field(description="ISO timestamp")
    updated_at: str = Field(description="ISO timestamp")

    # Per-workspace business prompt (domain-specific context for the LLM)
    business_prompt: str = ""
    business_prompt_version: int = 1
    business_prompt_history: list[dict] = Field(
        default_factory=list,
        description="Version history: [{version, content, author, rationale, created_at}]",
    )


class Booking(BaseModel):
    """A workspace booking request with survey lifecycle."""

    id: str
    workspace_id: str
    requester_id: str
    status: str = Field(default="pending", description="'pending', 'confirmed', 'active', 'completed', 'cancelled'")
    start_date: str = Field(description="ISO date")
    end_date: str = Field(description="ISO date")
    entry_survey_completed: bool = False
    exit_survey_completed: bool = False
    created_at: str = Field(description="ISO timestamp")
    updated_at: str = Field(description="ISO timestamp")


class TeamMember(BaseModel):
    """A user's membership in a workspace."""

    id: str
    workspace_id: str
    user_id: str
    email: str
    name: str
    role: str = Field(default="reader", description="'reader', 'contributor', 'admin'")
    added_at: str = Field(description="ISO timestamp")
    added_by: str


class EntrySurvey(BaseModel):
    """Entry survey completed before workspace provisioning."""

    id: str
    booking_id: str
    use_case: str
    expected_users: int = Field(ge=0)
    expected_data_volume_gb: float = Field(ge=0)
    data_classification: str = Field(
        default="unclassified",
        description="'unclassified', 'protected_a', 'protected_b'",
    )
    business_justification: str
    completed_at: str = Field(description="ISO timestamp")


class ExitSurvey(BaseModel):
    """Exit survey completed when a booking ends."""

    id: str
    booking_id: str
    satisfaction_rating: int = Field(ge=1, le=5)
    objectives_met: bool
    data_disposition: str = Field(description="'keep', 'archive', 'delete'")
    feedback: str = ""
    would_recommend: bool = True
    completed_at: str = Field(description="ISO timestamp")


class Document(BaseModel):
    """A document uploaded to a workspace for ingestion and indexing."""

    id: str
    workspace_id: str
    filename: str
    content_type: str
    size_bytes: int = Field(ge=0)
    status: str = Field(
        default="uploading",
        description="'uploading', 'processing', 'indexed', 'failed', 'deleted'",
    )
    chunk_count: int = Field(default=0, ge=0)
    data_classification: str = Field(
        default="unclassified",
        description="'unclassified', 'protected_a', 'protected_b'",
    )
    uploaded_by: str
    uploaded_at: str = Field(description="ISO timestamp")
    processed_at: str | None = None
    error_message: str | None = None
