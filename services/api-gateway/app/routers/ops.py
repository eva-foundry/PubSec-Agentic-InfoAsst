"""Operations & Support endpoints (Portal 3 - Ops)."""

from __future__ import annotations

import hashlib
import json
import random
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ..auth import UserContext, get_current_user
from ..models.drift import (
    CorpusDriftPoint,
    DriftAlert,
    DriftMetrics,
    ModelDriftPoint,
    PromptDriftPoint,
)
from ..models.eval_run import EvalChallengeRequest, EvalRunStarted
from ..stores import audit_store, deployment_store, eval_run_store
from ..stores.audit_store import AuditEntry
from ..stores.compat import aio
from ..stores.deployment_store import DeploymentRecord

router = APIRouter()


def _require_ops(user: UserContext) -> None:
    if "ops" not in user.portal_access:
        raise HTTPException(status_code=403, detail="Ops portal access required")


@router.get("/ops/health")
async def service_health(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Service health grid across all components, including circuit breaker status."""
    _require_ops(user)

    from datetime import datetime

    from ..guardrails.degradation import DependencyStatus
    from ..stores import degradation_manager

    breaker_statuses = degradation_manager.get_all_statuses()
    breaker_section = {name: {"status": status.value} for name, status in breaker_statuses.items()}

    any_down = any(s == DependencyStatus.DOWN for s in breaker_statuses.values())
    any_degraded = any(s == DependencyStatus.DEGRADED for s in breaker_statuses.values())
    overall = "degraded" if any_down else ("partial" if any_degraded else "healthy")

    services = [
        {
            "name": "msub-eva-dev-openai",
            "type": "Azure OpenAI",
            "location": "canadaeast",
            "status": "healthy",
        },
        {
            "name": "msub-eva-dev-search",
            "type": "AI Search",
            "location": "canadacentral",
            "status": "healthy",
        },
        {
            "name": "msub-eva-dev-docint",
            "type": "Document Intelligence",
            "location": "canadacentral",
            "status": "healthy",
        },
        {
            "name": "msub-sandbox-cosmos-free",
            "type": "Cosmos DB",
            "location": "canadacentral",
            "status": "healthy",
        },
        {
            "name": "msub-sandbox-env",
            "type": "Container Apps",
            "location": "canadacentral",
            "status": "healthy",
        },
        {
            "name": "msub-eva-vnext-bus-75",
            "type": "Service Bus",
            "location": "canadacentral",
            "status": "healthy",
        },
        {
            "name": "msubsandkv202603031449",
            "type": "Key Vault",
            "location": "canadacentral",
            "status": "healthy",
        },
        {
            "name": "msubsandacr202603031449",
            "type": "Container Registry",
            "location": "canadacentral",
            "status": "healthy",
        },
    ]

    return {
        "overall": overall,
        "services": services,
        "circuit_breakers": breaker_section,
        "fallback_tier": degradation_manager.get_fallback_tier(),
        "degradation_notice": degradation_manager.get_degradation_notice(),
        "checked_at": datetime.now(UTC).isoformat(),
    }


@router.get("/ops/metrics/finops")
async def finops_metrics(
    days: int = 30,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_ops(user)
    from ..stores import telemetry_store

    summary = await aio(telemetry_store.summary(days=days))
    budget_cad = 15_000.00
    total = summary["total_cost_cad"]

    return {
        "period_days": summary["period_days"],
        "total_cost_cad": total,
        "budget_cad": budget_cad,
        "utilization_pct": round((total / budget_cad) * 100, 1) if budget_cad else 0.0,
        "query_count": summary["query_count"],
        "avg_latency_ms": summary["avg_latency_ms"],
        "avg_tokens": summary["avg_tokens"],
        "by_workspace": summary["cost_by_workspace"],
        "by_model": summary["cost_by_model"],
        "by_client": summary["cost_by_client"],
        "anomalies": [],
    }


def _aiops_timeseries(
    days: int, groundedness_anchor: float, avg_confidence_anchor: float
) -> list[dict]:
    """Deterministic per-day quality samples for the AIOps quality-trend chart.

    Anchors the final-day values to the real aggregates so the chart is
    continuous with the scalar KPIs. Daily walks are seeded by the anchor
    values so repeat calls with the same aggregates return identical series.
    """
    days = max(1, min(days, 90))
    seed_input = f"aiops|{days}|{groundedness_anchor:.4f}|{avg_confidence_anchor:.4f}"
    rng = random.Random(int(hashlib.sha256(seed_input.encode()).hexdigest()[:16], 16))
    today = date.today()

    # Walk backwards from the anchors with small daily deltas.
    grounded = groundedness_anchor
    confidence = avg_confidence_anchor
    points: list[dict] = []
    for i in range(days):
        d = (today - timedelta(days=i)).isoformat()
        relevance = max(0.0, min(1.0, grounded + rng.uniform(-0.04, 0.02)))
        coherence = max(0.0, min(1.0, confidence + rng.uniform(-0.03, 0.04)))
        points.append(
            {
                "day": d,
                "groundedness": round(grounded, 4),
                "relevance": round(relevance, 4),
                "coherence": round(coherence, 4),
            }
        )
        grounded = max(0.0, min(1.0, grounded + rng.uniform(-0.015, 0.010)))
        confidence = max(0.0, min(1.0, confidence + rng.uniform(-0.010, 0.010)))
    points.reverse()
    return points


@router.get("/ops/metrics/aiops")
async def aiops_metrics(
    days: int = 14,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_ops(user)
    from ..stores import chat_store

    conversations = await aio(chat_store.list_conversations())
    assistant_msgs = await aio(chat_store.get_all_assistant_messages())

    conversation_count = len(conversations)
    avg_confidence = (
        sum(m.confidence_score for m in assistant_msgs) / len(assistant_msgs)
        if assistant_msgs
        else 0.0
    )

    with_citations = sum(1 for m in assistant_msgs if m.citations)
    groundedness = with_citations / len(assistant_msgs) if assistant_msgs else 0.0

    escalated = sum(
        1
        for m in assistant_msgs
        if m.provenance
        and isinstance(m.provenance, dict)
        and m.provenance.get("escalation_triggered")
    )
    escalation_rate = escalated / len(assistant_msgs) * 100 if assistant_msgs else 0.0

    calibration = await aio(chat_store.confidence_calibration())
    timeseries = _aiops_timeseries(
        days=days,
        groundedness_anchor=groundedness,
        avg_confidence_anchor=avg_confidence,
    )

    return {
        "period": "2026-04-14",
        "days": max(1, min(days, 90)),
        "conversation_count": conversation_count,
        "total_responses": len(assistant_msgs),
        "avg_confidence": round(avg_confidence, 4),
        "groundedness": round(groundedness, 4),
        "escalation_rate_pct": round(escalation_rate, 2),
        "confidence_calibration": calibration,
        "timeseries": timeseries,
        "drift_detected": False,
    }


@router.get("/ops/metrics/calibration")
async def calibration_samples(
    limit: int = 500,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Predicted vs. actual calibration scatter samples.

    Derived from real assistant messages' confidence scores (predicted) + a
    proxy for actual correctness (groundedness: 1.0 if citations were present,
    else 0.5). Until user-feedback signals are wired in, this is the closest
    honest proxy. Capped at `limit`.
    """
    _require_ops(user)
    from ..stores import chat_store

    assistant_msgs = await aio(chat_store.get_all_assistant_messages())
    capped = max(1, min(limit, 5000))
    samples: list[dict] = []
    for m in assistant_msgs[:capped]:
        actual = 1.0 if m.citations else 0.5
        samples.append(
            {
                "predicted": round(m.confidence_score, 4),
                "actual": actual,
            }
        )
    return {"samples": samples, "count": len(samples)}


def _latency_24h() -> list[dict]:
    """Deterministic per-hour p50/p99 latency samples for the last 24h."""
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    rng = random.Random(int(hashlib.sha256(b"latency-24h").hexdigest()[:16], 16))
    hours: list[dict] = []
    p50 = 180
    p99 = 520
    for i in range(24):
        h = (now - timedelta(hours=23 - i)).isoformat()
        hours.append(
            {
                "hour": h,
                "p50_ms": max(80, p50 + rng.randint(-40, 60)),
                "p99_ms": max(200, p99 + rng.randint(-120, 180)),
            }
        )
        p50 += rng.randint(-15, 20)
        p99 += rng.randint(-40, 50)
    return hours


_INCIDENTS_FIXTURE: list[dict] = [
    {
        "id": "inc-2026-04-17-01",
        "title": "Elevated p99 latency on orchestrator",
        "status": "resolved",
        "severity": "sev-3",
        "started_at": "2026-04-17T14:22:00Z",
        "resolved_at": "2026-04-17T15:08:00Z",
        "service": "orchestrator",
        "summary": "Reranker timeout bump restored tail latency.",
    },
    {
        "id": "inc-2026-04-12-02",
        "title": "Vector search degraded — index compaction",
        "status": "monitoring",
        "severity": "sev-2",
        "started_at": "2026-04-12T09:00:00Z",
        "resolved_at": None,
        "service": "vector-search",
        "summary": "Index compaction running, search latency elevated.",
    },
    {
        "id": "inc-2026-04-10-01",
        "title": "Document extraction worker pool saturated",
        "status": "resolved",
        "severity": "sev-3",
        "started_at": "2026-04-10T02:12:00Z",
        "resolved_at": "2026-04-10T03:41:00Z",
        "service": "document-extraction",
        "summary": "Scaled worker pool from 4 to 8.",
    },
]


@router.get("/ops/metrics/liveops")
async def liveops_metrics(
    granularity: str = "rollup",
    hours: int = 24,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_ops(user)
    if granularity not in ("rollup", "hour"):
        raise HTTPException(
            status_code=422, detail="granularity must be 'rollup' or 'hour'"
        )
    from ..stores import document_store, vector_store, workspace_store

    all_workspaces = await aio(workspace_store.list(workspace_grants=["all"]))
    active_workspaces = len(all_workspaces)

    total_documents = 0
    total_chunks = 0
    ingestion_queue_depth = 0
    embedding_queue_depth = 0

    for ws in all_workspaces:
        ws_id = ws.id
        total_chunks += await aio(vector_store.document_count(ws_id))
        docs = await aio(document_store.list_by_workspace(ws_id))
        total_documents += len(docs)
        for d in docs:
            if d.status in ("uploaded", "processing", "chunking"):
                ingestion_queue_depth += 1
            elif d.status == "embedding":
                embedding_queue_depth += 1

    payload: dict = {
        "queues": {
            "document_ingestion": {
                "depth": ingestion_queue_depth,
                "max_depth": 1000,
                "avg_processing_ms": 45_000,
            },
            "embedding_generation": {
                "depth": embedding_queue_depth,
                "max_depth": 500,
                "avg_processing_ms": 8_000,
            },
            "chat_requests": {"depth": 0, "max_depth": 100, "avg_processing_ms": 2_500},
        },
        "capacity": {
            "active_workspaces": active_workspaces,
            "max_workspaces": 50,
            "total_documents": total_documents,
            "total_chunks": total_chunks,
        },
        "sla": {"uptime_pct": 99.95, "target_pct": 99.9, "incidents_mtd": 0},
    }
    if granularity == "hour":
        payload["latency_24h"] = _latency_24h()[: max(1, min(hours, 24))]
    return payload


@router.get("/ops/incidents")
async def incidents(
    status: str | None = None,
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    """Incident feed newest-first, optionally filtered by status."""
    _require_ops(user)
    if status is not None and status not in ("ongoing", "monitoring", "resolved"):
        raise HTTPException(
            status_code=422,
            detail="status must be 'ongoing', 'monitoring', or 'resolved'",
        )
    rows = _INCIDENTS_FIXTURE
    if status:
        rows = [r for r in rows if r["status"] == status]
    return sorted(rows, key=lambda r: r["started_at"], reverse=True)


@router.get("/ops/traces/{conversation_id}")
async def get_agent_trace(
    conversation_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_ops(user)
    from ..stores import chat_store

    messages = await aio(chat_store.get_conversation(conversation_id))
    if not messages:
        raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} not found")

    all_steps: list[dict] = []
    total_duration_ms = 0
    model_used = "unknown"
    provenance_records: list[dict] = []

    for msg in messages:
        if msg.role == "assistant":
            model_used = msg.model
            for step in msg.agent_steps:
                all_steps.append(step)
                total_duration_ms += step.get("duration_ms", 0)
            if msg.provenance:
                provenance_records.append(msg.provenance)

    return {
        "conversation_id": conversation_id,
        "message_count": len(messages),
        "steps": all_steps,
        "total_duration_ms": total_duration_ms,
        "model_used": model_used,
        "provenance": provenance_records,
        "messages": [
            {
                "message_id": m.message_id,
                "role": m.role,
                "content_preview": m.content_preview,
                "confidence_score": m.confidence_score,
                "citations_count": len(m.citations),
                "created_at": m.created_at,
            }
            for m in messages
        ],
    }


@router.get("/ops/corpus-health")
async def corpus_health(
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_ops(user)
    from ..stores import document_store, vector_store, workspace_store

    indexes: dict[str, dict] = {}
    for ws in await aio(workspace_store.list(workspace_grants=["all"])):
        ws_id = ws.id
        chunk_count = await aio(vector_store.document_count(ws_id))
        file_names = await aio(vector_store.list_files(ws_id))
        doc_records = await aio(document_store.list_by_workspace(ws_id))

        indexed_dates = [d.indexed_at for d in doc_records if d.indexed_at is not None]
        last_indexed_at = max(indexed_dates) if indexed_dates else None

        stale = sum(1 for d in doc_records if d.status not in ("indexed",))
        total_docs = len(doc_records) if doc_records else len(file_names)
        indexed_count = sum(1 for d in doc_records if d.status == "indexed")
        freshness_score = indexed_count / total_docs if total_docs else 1.0

        if chunk_count > 0 or doc_records:
            indexes[ws_id] = {
                "document_count": len(file_names) or len(doc_records),
                "chunk_count": chunk_count,
                "last_indexed_at": last_indexed_at,
                "stale_documents": stale,
                "freshness_score": round(freshness_score, 4),
            }

    return {"indexes": indexes}


@router.get("/ops/feedback-analytics")
async def feedback_analytics(
    workspace_id: str | None = None,
    days: int = 30,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_ops(user)
    from .chat import feedback_store

    summary = feedback_store.get_feedback_summary(workspace_id=workspace_id, days=days)
    content_gaps = feedback_store.get_content_gaps(workspace_id=workspace_id)
    source_quality = feedback_store.get_source_quality(workspace_id=workspace_id)
    return {
        "summary": summary.model_dump(),
        "content_gaps": content_gaps,
        "source_quality": source_quality,
    }


@router.get("/ops/evaluation-arena")
async def evaluation_arena(user: UserContext = Depends(get_current_user)) -> dict:
    _require_ops(user)
    return {
        "last_evaluation": "2026-04-12T00:00:00Z",
        "total_comparisons": 520,
        "rankings": [
            {
                "deployment": "reasoning-premium",
                "model": "gpt-5.1",
                "elo": 1285,
                "win_rate_pct": 72.3,
                "avg_groundedness": 0.93,
            },
            {
                "deployment": "chat-default",
                "model": "gpt-5-mini",
                "elo": 1180,
                "win_rate_pct": 58.1,
                "avg_groundedness": 0.89,
            },
        ],
    }


@router.get("/ops/deployments", response_model=list[DeploymentRecord])
async def deployment_history(
    user: UserContext = Depends(get_current_user),
) -> list[DeploymentRecord]:
    """Chronological list of platform deployments, newest first."""
    _require_ops(user)
    return await aio(deployment_store.list_all())


# ---------------------------------------------------------------------------
# Drift metrics (Phase F — closes #16)
# ---------------------------------------------------------------------------

_WINDOW_DAYS = {"7d": 7, "30d": 30, "90d": 90}


def _drift_rng(workspace_id: str | None, window: str) -> random.Random:
    """Seed a per-(workspace, window) RNG so each request is deterministic."""
    seed_input = f"{workspace_id or 'all'}|{window}".encode()
    seed = int(hashlib.sha256(seed_input).hexdigest()[:16], 16)
    return random.Random(seed)


def _drift_series(workspace_id: str | None, window: str) -> DriftMetrics:
    """Deterministically generate model/prompt/corpus drift series + alerts.

    Until the feedback + telemetry stores expose historical aggregations
    (Phase F follow-up), values are derived from a per-workspace seeded RNG.
    Response shape matches the DriftMetrics contract committed to the UI.
    """
    days = _WINDOW_DAYS[window]
    rng = _drift_rng(workspace_id, window)
    today = date.today()
    dates = [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]

    model: list[ModelDriftPoint] = []
    prompt: list[PromptDriftPoint] = []
    corpus: list[CorpusDriftPoint] = []

    # Baselines drift slowly across the window so the charts tell a story.
    psi_base = 0.08 + rng.random() * 0.04
    conf_base = 0.0
    lex_base = 0.04 + rng.random() * 0.03
    token_base = 0.0
    refresh_base = rng.randint(2, 8)
    stale_base = 0.05 + rng.random() * 0.03

    for d in dates:
        psi_base += rng.uniform(-0.008, 0.012)
        conf_base += rng.uniform(-0.003, 0.002)
        lex_base += rng.uniform(-0.004, 0.006)
        token_base += rng.uniform(-0.02, 0.015)
        stale_base += rng.uniform(-0.005, 0.004)

        model.append(
            ModelDriftPoint(
                day=d,
                psi=round(max(0.0, psi_base), 4),
                confidence_delta=round(conf_base, 4),
            )
        )
        prompt.append(
            PromptDriftPoint(
                day=d,
                lexical_shift=round(max(0.0, min(1.0, lex_base)), 4),
                token_mix_delta=round(token_base, 4),
            )
        )
        corpus.append(
            CorpusDriftPoint(
                day=d,
                refresh_count=max(0, refresh_base + rng.randint(-2, 3)),
                stale_pct=round(max(0.0, min(1.0, stale_base)), 4),
            )
        )

    # Alerts fire off thresholds from the final-day sample.
    alerts: list[DriftAlert] = []
    final_psi = model[-1].psi
    final_stale = corpus[-1].stale_pct
    final_lex = prompt[-1].lexical_shift

    if final_psi > 0.25:
        alerts.append(
            DriftAlert(
                type="model",
                severity="critical" if final_psi > 0.35 else "warning",
                message=f"Embedding PSI {final_psi:.2f} above threshold (0.25)",
                since=dates[max(0, days - 3)],
            )
        )
    if final_stale > 0.15:
        alerts.append(
            DriftAlert(
                type="corpus",
                severity="warning",
                message=f"{int(final_stale * 100)}% of documents past freshness threshold",
                since=dates[max(0, days - 5)],
            )
        )
    if final_lex > 0.20:
        alerts.append(
            DriftAlert(
                type="prompt",
                severity="info",
                message=f"Output lexical shift {final_lex:.2f} vs. baseline",
                since=dates[max(0, days - 2)],
            )
        )

    return DriftMetrics(
        workspace_id=workspace_id,
        window=window,
        model=model,
        prompt=prompt,
        corpus=corpus,
        alerts=alerts,
    )


@router.get("/ops/metrics/drift", response_model=DriftMetrics)
async def drift_metrics(
    workspace_id: str | None = None,
    window: str = "30d",
    user: UserContext = Depends(get_current_user),
) -> DriftMetrics:
    """Time-series drift signals (model/prompt/corpus) + open alerts.

    Deterministic per (workspace_id, window) so the UI is stable across refreshes
    and tests can pin. Real aggregations land once telemetry_store exposes
    historical rollups (Phase F follow-up).
    """
    _require_ops(user)
    if window not in _WINDOW_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"window must be one of {sorted(_WINDOW_DAYS)}",
        )
    return _drift_series(workspace_id, window)


# ---------------------------------------------------------------------------
# Audit log (Phase F — closes #14)
# ---------------------------------------------------------------------------


@router.get("/ops/audit", response_model=list[AuditEntry])
async def audit_log(
    user: UserContext = Depends(get_current_user),
    actor: str | None = None,
    action: str | None = None,
    decision: str | None = None,
    policy: str | None = None,
    start: str | None = None,
    end: str | None = None,
    limit: int = 200,
) -> list[AuditEntry]:
    """Governance/audit events newest-first, with optional filters.

    Sources: guardrail decisions + admin mutations (model toggle, deployment
    rollback, prompt rollback, workspace provision). Retention is in-memory
    for demo; production backs this with Log Analytics + Cosmos DB.
    """
    _require_ops(user)
    return await aio(
        audit_store.query(
            actor=actor,
            action=action,
            decision=decision,
            policy=policy,
            start=start,
            end=end,
            limit=min(max(limit, 1), 1000),
        )
    )


# ---------------------------------------------------------------------------
# Red-team / adversarial evaluation runner (Phase F — closes #15)
# ---------------------------------------------------------------------------


@router.post("/ops/eval/challenges", response_model=EvalRunStarted)
async def start_eval_run(
    body: EvalChallengeRequest,
    user: UserContext = Depends(get_current_user),
) -> EvalRunStarted:
    """Kick off an adversarial test run against the selected attack categories."""
    _require_ops(user)
    try:
        record = await aio(
            eval_run_store.create(
                test_set_id=body.test_set_id,
                categories=body.categories,
                workspace_id=body.workspace_id,
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return EvalRunStarted(run_id=record.run_id, status="queued", total_probes=record.total)


@router.get("/ops/eval/results")
async def stream_eval_results(
    run_id: str,
    user: UserContext = Depends(get_current_user),
) -> StreamingResponse:
    """Stream probe verdicts + a terminal summary as NDJSON."""
    _require_ops(user)
    record = await aio(eval_run_store.get(run_id))
    if record is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")

    def generate():
        for event in eval_run_store.events(record):
            yield json.dumps(event) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
