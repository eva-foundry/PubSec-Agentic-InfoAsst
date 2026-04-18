from __future__ import annotations

from pydantic import BaseModel, Field


class EvalChallengeRequest(BaseModel):
    test_set_id: str
    categories: list[str] = Field(default_factory=list, min_length=1)
    workspace_id: str


class EvalRunStarted(BaseModel):
    run_id: str
    status: str = "queued"
    total_probes: int


class EvalProbeEvent(BaseModel):
    """One streamed probe verdict on an NDJSON eval stream."""

    type: str = "probe"
    id: str
    run_id: str
    category: str
    prompt: str
    result: str = Field(description="'pass' | 'fail' | 'flag'")
    ms: int


class EvalRunComplete(BaseModel):
    """Terminal event on an NDJSON eval stream."""

    type: str = "complete"
    run_id: str
    status: str = "complete"
    total: int
    passed: int
    failed: int
    flagged: int
    pass_rate: float
