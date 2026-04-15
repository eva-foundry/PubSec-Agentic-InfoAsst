"""Operations & Support endpoints (Portal 3 - Ops)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..auth import UserContext, get_current_user

router = APIRouter()


def _require_ops(user: UserContext) -> None:
    if "ops" not in user.portal_access:
        raise HTTPException(status_code=403, detail="Ops portal access required")


@router.get("/ops/health")
async def service_health(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Service health grid across all components."""
    _require_ops(user)
    return {
        "overall": "healthy",
        "services": {
            "api_gateway": {"status": "healthy", "latency_p99_ms": 45},
            "agent_orchestrator": {"status": "healthy", "latency_p99_ms": 1200},
            "ai_search": {"status": "healthy", "latency_p99_ms": 180},
            "document_intelligence": {"status": "healthy", "latency_p99_ms": 3500},
            "azure_openai": {"status": "healthy", "latency_p99_ms": 800},
            "cosmos_db": {"status": "healthy", "latency_p99_ms": 12},
            "redis_cache": {"status": "healthy", "latency_p99_ms": 2},
            "service_bus": {"status": "degraded", "latency_p99_ms": 450, "note": "Queue depth elevated"},
        },
        "checked_at": "2026-04-14T12:00:00Z",
    }


@router.get("/ops/metrics/finops")
async def finops_metrics(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """FinOps cost attribution and budget metrics."""
    _require_ops(user)
    return {
        "period": "2026-04",
        "total_cost_cad": 12_450.00,
        "budget_cad": 15_000.00,
        "utilization_pct": 83.0,
        "by_workspace": {
            "ws-oas-act": {"cost_cad": 4_200.00, "queries": 3_420, "cost_per_query": 1.23},
            "ws-ei-juris": {"cost_cad": 6_800.00, "queries": 8_910, "cost_per_query": 0.76},
            "ws-general-faq": {"cost_cad": 1_450.00, "queries": 2_100, "cost_per_query": 0.69},
        },
        "anomalies": [],
    }


@router.get("/ops/metrics/aiops")
async def aiops_metrics(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """RAG quality and model performance metrics."""
    _require_ops(user)
    return {
        "period": "2026-04-14",
        "groundedness": 0.91,
        "relevance": 0.88,
        "coherence": 0.94,
        "citation_accuracy": 0.96,
        "avg_confidence": 0.85,
        "escalation_rate_pct": 4.2,
        "drift_detected": False,
        "model_performance": {
            "gpt-5.1": {"avg_latency_ms": 780, "error_rate_pct": 0.1},
            "gpt-5-mini": {"avg_latency_ms": 320, "error_rate_pct": 0.05},
        },
    }


@router.get("/ops/metrics/liveops")
async def liveops_metrics(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Queue depths, capacity, and SLA tracking."""
    _require_ops(user)
    return {
        "queues": {
            "document_ingestion": {"depth": 12, "max_depth": 1000, "avg_processing_ms": 45_000},
            "embedding_generation": {"depth": 3, "max_depth": 500, "avg_processing_ms": 8_000},
            "chat_requests": {"depth": 0, "max_depth": 100, "avg_processing_ms": 2_500},
        },
        "capacity": {
            "active_workspaces": 3,
            "max_workspaces": 50,
            "total_documents": 1555,
            "total_chunks": 42_300,
        },
        "sla": {
            "uptime_pct": 99.95,
            "target_pct": 99.9,
            "incidents_mtd": 0,
        },
    }


@router.get("/ops/traces/{conversation_id}")
async def get_agent_trace(
    conversation_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Return the full agent execution trace for a conversation."""
    _require_ops(user)
    return {
        "conversation_id": conversation_id,
        "trace_id": "otel-abc123def456",
        "steps": [
            {"id": 1, "tool": "planner", "status": "complete", "duration_ms": 120, "input_hash": "a1b2", "output_hash": "c3d4"},
            {"id": 2, "tool": "search", "status": "complete", "duration_ms": 320, "input_hash": "e5f6", "output_hash": "g7h8", "metadata": {"sources_found": 5}},
            {"id": 3, "tool": "reranker", "status": "complete", "duration_ms": 85, "input_hash": "i9j0", "output_hash": "k1l2", "metadata": {"sources_kept": 3}},
            {"id": 4, "tool": "answer", "status": "complete", "duration_ms": 780, "input_hash": "m3n4", "output_hash": "o5p6"},
        ],
        "total_duration_ms": 1305,
        "model_used": "gpt-5.1-2026-04",
    }


@router.get("/ops/corpus-health")
async def corpus_health(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Index freshness and corpus integrity metrics."""
    _require_ops(user)
    return {
        "indexes": {
            "ws-oas-act": {
                "document_count": 87,
                "chunk_count": 2_450,
                "last_indexed_at": "2026-04-10T14:35:00Z",
                "stale_documents": 2,
                "freshness_score": 0.94,
            },
            "ws-ei-juris": {
                "document_count": 1423,
                "chunk_count": 38_200,
                "last_indexed_at": "2026-04-12T09:45:00Z",
                "stale_documents": 0,
                "freshness_score": 0.99,
            },
        },
    }


@router.get("/ops/feedback-analytics")
async def feedback_analytics(
    workspace_id: str | None = None,
    days: int = 30,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Correction patterns, content gaps, and source quality analysis."""
    _require_ops(user)

    from .chat import feedback_store

    summary = feedback_store.get_feedback_summary(
        workspace_id=workspace_id, days=days
    )
    content_gaps = feedback_store.get_content_gaps(workspace_id=workspace_id)
    source_quality = feedback_store.get_source_quality(workspace_id=workspace_id)

    return {
        "summary": summary.model_dump(),
        "content_gaps": content_gaps,
        "source_quality": source_quality,
    }


@router.get("/ops/evaluation-arena")
async def evaluation_arena(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Model comparison Elo rankings from evaluation arena."""
    _require_ops(user)
    return {
        "last_evaluation": "2026-04-12T00:00:00Z",
        "total_comparisons": 520,
        "rankings": [
            {"model": "gpt-5.1", "elo": 1285, "win_rate_pct": 72.3, "avg_groundedness": 0.93},
            {"model": "gpt-5-mini", "elo": 1180, "win_rate_pct": 58.1, "avg_groundedness": 0.89},
        ],
    }


@router.get("/ops/deployments")
async def deployment_history(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Deployment history and current versions."""
    _require_ops(user)
    return {
        "current": {
            "api_gateway": "0.1.0",
            "agent_orchestrator": "0.1.0",
            "ingestion_pipeline": "0.1.0",
            "prompt_version": "v3.2",
            "guardrail_rules": "v1.4",
        },
        "recent_deployments": [
            {"component": "api_gateway", "version": "0.1.0", "deployed_at": "2026-04-14T08:00:00Z", "deployed_by": "ci-pipeline", "status": "success"},
            {"component": "prompt_version", "version": "v3.2", "deployed_at": "2026-04-01T10:00:00Z", "deployed_by": "demo-dave", "status": "success"},
        ],
    }
