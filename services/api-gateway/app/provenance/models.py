from __future__ import annotations

from pydantic import BaseModel, Field


class ConfidenceFactors(BaseModel):
    """Breakdown of how overall confidence was computed."""

    retrieval_relevance: float = Field(
        ge=0, le=1, description="Relevance of retrieved documents to the query"
    )
    source_coverage: float = Field(
        ge=0, le=1, description="How well the sources cover the question scope"
    )
    grounding_quality: float = Field(
        ge=0, le=1, description="Degree to which the answer is grounded in sources"
    )


class FreshnessInfo(BaseModel):
    """Temporal validity metadata for cited sources."""

    oldest_source: str | None = Field(
        default=None, description="ISO date of the oldest source consulted"
    )
    newest_source: str | None = Field(
        default=None, description="ISO date of the newest source consulted"
    )
    staleness_warning: bool = Field(
        default=False, description="True if any cited source may be outdated"
    )


class ModelSnapshot(BaseModel):
    """Point-in-time snapshot of the model config active when a query was served.

    Captured at query time so that 6 months later you can see exactly which model,
    with which parameters, enabled by whom, was used for this specific response.
    """

    deployment_name: str = Field(description="Azure deployment name, e.g. 'chat-default'")
    model_name: str = Field(description="Model name, e.g. 'gpt-5-mini'")
    model_version: str = Field(default="", description="Model version, e.g. '2025-08-07'")
    provider: str = Field(
        default="azure-openai",
        description="Provider, e.g. 'azure-openai', 'azure-foundry-serverless'",
    )
    endpoint: str = Field(default="", description="Azure endpoint URL")
    sku: str = Field(default="", description="SKU at query time, e.g. 'GlobalStandard'")
    cost_model: str = Field(default="pay-as-you-go", description="Pricing model at query time")
    parameter_overrides: dict = Field(
        default_factory=dict, description="Active parameter overrides at query time"
    )
    config_version: int = Field(
        default=0, description="Number of changes to this model config at query time"
    )
    last_changed_by: str = Field(default="", description="Who last modified this model config")
    last_changed_at: str = Field(default="", description="When the model config was last modified")


class BehavioralFingerprint(BaseModel):
    """Snapshot of the exact software versions that produced this answer.

    Enables reproducibility audits: given the same fingerprint and inputs,
    the system should produce the same output.
    """

    model: str = Field(description="Model identifier, e.g. 'gpt-5-mini'")
    model_snapshot: ModelSnapshot | None = Field(
        default=None, description="Full model config snapshot at query time"
    )
    prompt_version: str = Field(
        description="Prompt template version, e.g. 'rag-system:v1 + ws-oas-act:v1'"
    )
    corpus_snapshot: str = Field(description="ISO date of the corpus snapshot used for retrieval")
    policy_rules_version: str = Field(description="Guardrail / policy rules version, e.g. 'v1.4'")


class Citation(BaseModel):
    """A single source citation attached to an answer fragment."""

    file: str = Field(description="Blob path or document identifier")
    page: int | None = Field(default=None, description="Page number within the document")
    section: str | None = Field(default=None, description="Section heading or identifier")
    sas_url: str = Field(description="SAS-signed URL for source retrieval")
    last_verified: str | None = Field(
        default=None, description="ISO date when the source was last verified current"
    )
    source_quality_score: float | None = Field(
        default=None, ge=0, le=1, description="Quality score of the source"
    )


class ProvenanceRecord(BaseModel):
    """Full provenance chain for a single assistant response.

    Every answer EVA produces carries one of these, enabling forensic audit,
    confidence disclosure, and AICM compliance.
    """

    correlation_id: str = Field(description="UUID linking all operations for this request")
    agent_id: str = Field(description="Agent that produced the answer, e.g. 'eva-rag-agent'")
    delegation_chain: list[str] = Field(
        default_factory=list,
        description="Ordered list of agents/tools invoked, e.g. ['user-request', 'orchestrator', 'search-tool']",
    )
    sources_consulted: int = Field(
        default=0, ge=0, description="Total sources retrieved before filtering"
    )
    sources_cited: int = Field(default=0, ge=0, description="Sources actually cited in the answer")
    sources_excluded: int = Field(default=0, ge=0, description="Sources retrieved but excluded")
    exclusion_reasons: list[str] = Field(
        default_factory=list, description="Why each excluded source was dropped"
    )
    policies_applied: list[str] = Field(
        default_factory=list,
        description="Guardrail policies enforced, e.g. ['grounding-required', 'protected-b-boundary']",
    )
    confidence: float = Field(ge=0, le=1, description="Overall confidence score for the answer")
    confidence_factors: ConfidenceFactors
    escalation_tier: str = Field(
        description="Escalation classification: 'auto-resolve' | 'flagged-for-review' | 'requires-human-decision'",
    )
    freshness: FreshnessInfo
    behavioral_fingerprint: BehavioralFingerprint
    trace_id: str = Field(description="OpenTelemetry trace ID for distributed tracing")


class ExplainabilityRecord(BaseModel):
    """Human-readable explanation of how the answer was produced.

    Structured for both end-user transparency and auditor review.
    """

    retrieval_summary: str = Field(
        description="e.g. '5 sources retrieved; 3 selected; 1 excluded (superseded)'",
    )
    reasoning_summary: str = Field(
        description="Structured reasoning explanation (not raw chain-of-thought)",
    )
    negative_evidence: list[str] = Field(
        default_factory=list,
        description="What the system looked for but did not find, e.g. ['No amendments found after 2025-12-01']",
    )
    cross_language: str | None = Field(
        default=None,
        description="Cross-language handling, e.g. 'Query in French; sources in English; translated'",
    )


class AgentStep(BaseModel):
    """A single step in the agent's execution, streamed to the UI for transparency."""

    id: int = Field(description="Sequential step identifier within this request")
    tool: str = Field(description="Tool invoked: 'search', 'cite', 'answer', 'translate', etc.")
    status: str = Field(description="Step status: 'running', 'complete', 'error'")
    label_en: str = Field(description="Human-readable step label in English")
    label_fr: str = Field(description="Human-readable step label in French")
    duration_ms: int | None = Field(default=None, description="Execution time in milliseconds")
    metadata: dict | None = Field(
        default=None, description="Tool-specific data, e.g. {'sources_found': 5}"
    )
