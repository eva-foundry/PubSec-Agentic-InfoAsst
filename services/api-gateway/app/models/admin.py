"""Pydantic models for admin-specific entities."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Client(BaseModel):
    """A business client onboarded to the EVA DA platform."""

    id: str
    org_name: str
    entra_group_id: str | None = None
    billing_contact: str
    data_classification_level: str = Field(
        default="unclassified",
        description="'unclassified', 'protected_a', 'protected_b'",
    )
    onboarded_at: str = Field(description="ISO timestamp")
    status: str = Field(
        default="active",
        description="'active', 'suspended', 'offboarded'",
    )
    workspace_ids: list[str] = Field(default_factory=list)


class Interview(BaseModel):
    """An onboarding interview capturing client use-case details and AICM assessment."""

    id: str
    client_id: str
    admin_id: str
    use_case_description: str
    data_sources: list[str] = Field(default_factory=list)
    expected_volume: str = ""
    compliance_requirements: str = ""
    aicm_assessment: str = Field(
        default="level_1",
        description="AICM level: 'level_1' (advisory), 'level_2' (decision-informing)",
    )
    archetype_recommendation: str = Field(
        default="default",
        description="Recommended workspace archetype: 'legislation', 'case_law', 'default'",
    )
    created_at: str = Field(description="ISO timestamp")


class ModelConfig(BaseModel):
    """An AI model registered in the platform model registry."""

    id: str
    model_name: str
    provider: str = "azure-openai"
    deployment_name: str = ""
    capabilities: list[str] = Field(default_factory=list)
    classification_ceiling: str = Field(
        default="protected_b",
        description="Max data classification this model may process",
    )
    parameter_overrides: dict = Field(default_factory=dict)
    is_active: bool = True
    access_grants: list[str] = Field(
        default_factory=list,
        description="Entra group IDs or 'all'",
    )
    # Azure deployment metadata (populated from real inventory)
    endpoint: str = ""
    location: str = ""
    sku: str = ""
    capacity: int = 0
    model_version: str = ""
    status: str = Field(
        default="deployed",
        description=(
            "'deployed' (live, callable), 'available' (in catalog, can be deployed), "
            "'provisioned' (reserved capacity, fixed cost)"
        ),
    )
    cost_model: str = Field(
        default="pay-as-you-go",
        description=(
            "'pay-as-you-go' (per-token), 'provisioned' (fixed monthly), "
            "'serverless' (per-request MaaS)"
        ),
    )
    change_history: list[dict] = Field(
        default_factory=list,
        description=(
            "Versioned audit trail: "
            "[{version, action, field, old_value, new_value, author, "
            "rationale, timestamp}]"
        ),
    )


class PromptVersion(BaseModel):
    """A versioned system prompt with activation tracking."""

    id: str
    prompt_name: str
    version: int
    content: str
    author: str
    rationale: str = ""
    created_at: str = Field(description="ISO timestamp")
    is_active: bool = False


class WorkspaceProvisionRequest(BaseModel):
    """Request to provision or confirm provisioning of a workspace."""

    workspace_id: str
    dry_run: bool = True


class WorkspaceProvisionPlan(BaseModel):
    """Provisioning plan returned by a dry-run."""

    resources: list[dict] = Field(default_factory=list)
    estimated_monthly_cost: str = ""
    deployment_time_estimate: str = ""
    infrastructure: dict = Field(default_factory=dict)


class WorkspaceDecommissionPlan(BaseModel):
    """Decommission plan with safety gates."""

    members_to_remove: list[str] = Field(default_factory=list)
    documents_to_delete: int = 0
    index_entries_to_purge: int = 0
    safety_gates: list[str] = Field(default_factory=list)
