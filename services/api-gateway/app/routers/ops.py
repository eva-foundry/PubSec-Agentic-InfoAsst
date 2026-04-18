"""Operations & Support endpoints (Portal 3 - Ops)."""

from __future__ import annotations

from datetime import UTC

from fastapi import APIRouter, Depends, HTTPException

from ..auth import UserContext, get_current_user
from ..stores import audit_store, deployment_store
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


@router.get("/ops/metrics/aiops")
async def aiops_metrics(
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

    return {
        "period": "2026-04-14",
        "conversation_count": conversation_count,
        "total_responses": len(assistant_msgs),
        "avg_confidence": round(avg_confidence, 4),
        "groundedness": round(groundedness, 4),
        "escalation_rate_pct": round(escalation_rate, 2),
        "confidence_calibration": calibration,
        "drift_detected": False,
    }


@router.get("/ops/metrics/liveops")
async def liveops_metrics(
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_ops(user)
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

    return {
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
    return deployment_store.list_all()


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
    return audit_store.query(
        actor=actor,
        action=action,
        decision=decision,
        policy=policy,
        start=start,
        end=end,
        limit=min(max(limit, 1), 1000),
    )
