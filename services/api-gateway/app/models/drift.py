from __future__ import annotations

from pydantic import BaseModel, Field


class ModelDriftPoint(BaseModel):
    """One daily sample of embedding-distribution drift vs. the rolling baseline."""

    day: str = Field(description="ISO date (YYYY-MM-DD)")
    psi: float = Field(description="Population Stability Index, 0.0-1.0+")
    confidence_delta: float = Field(
        description="Signed change in avg response confidence vs. baseline",
    )


class PromptDriftPoint(BaseModel):
    """One daily sample of prompt/output shift."""

    day: str
    lexical_shift: float = Field(
        description="0.0-1.0; Jaccard distance of top-K tokens vs. baseline",
    )
    token_mix_delta: float = Field(description="Signed change in tokens-per-response vs. baseline")


class CorpusDriftPoint(BaseModel):
    """One daily sample of corpus refresh cadence + staleness."""

    day: str
    refresh_count: int = Field(description="Documents re-indexed that day", ge=0)
    stale_pct: float = Field(description="% of documents > freshness threshold, 0.0-1.0")


class DriftAlert(BaseModel):
    """An open drift alert surfaced on the AIOps dashboard."""

    type: str = Field(description="'model', 'prompt', or 'corpus'")
    severity: str = Field(description="'info', 'warning', 'critical'")
    message: str
    since: str = Field(description="ISO date the alert first triggered")


class DriftMetrics(BaseModel):
    """Time-series drift signals for a workspace over a rolling window."""

    workspace_id: str | None = None
    window: str = Field(description="'7d', '30d', or '90d'")
    model: list[ModelDriftPoint]
    prompt: list[PromptDriftPoint]
    corpus: list[CorpusDriftPoint]
    alerts: list[DriftAlert]
