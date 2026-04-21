"""System info & provenance endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import UserContext, get_current_user

router = APIRouter()


@router.get("/system/info")
async def system_info(
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Return current model versions, prompt versions, and system metadata."""
    return {
        "system": "AIA",
        "version": "0.1.0",
        "models": {
            "primary": {"name": "gpt-5.1", "version": "2026-04", "provider": "Azure OpenAI"},
            "secondary": {"name": "gpt-5-mini", "version": "2026-03", "provider": "Azure OpenAI"},
        },
        "prompts": {
            "rag-system": "v3.2",
            "guardrail-check": "v1.4",
            "translation": "v2.0",
        },
        "guardrail_rules_version": "v1.4",
        "corpus_snapshot": "2026-04-10",
        "environment": "development",
    }


@router.get("/provenance/{correlation_id}")
async def get_provenance(
    correlation_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    """Return the full provenance chain for a correlation ID."""
    # In production this queries Cosmos DB / Application Insights
    return {
        "correlation_id": correlation_id,
        "created_at": "2026-04-14T11:30:00Z",
        "agent_id": "aia-rag-agent",
        "delegation_chain": [
            "user-request",
            "orchestrator",
            "search-tool",
            "reranker",
            "answer-generator",
        ],
        "sources_consulted": 5,
        "sources_cited": 2,
        "sources_excluded": 3,
        "exclusion_reasons": [
            "Low relevance score (0.32)",
            "Superseded by newer document",
            "Classification ceiling exceeded",
        ],
        "policies_applied": ["grounding-required", "sensitive-boundary", "bilingual-check"],
        "confidence": 0.87,
        "confidence_factors": {
            "retrieval_relevance": 0.90,
            "source_coverage": 0.82,
            "grounding_quality": 0.89,
        },
        "escalation_tier": "auto-resolve",
        "freshness": {
            "oldest_source": "2024-01-15",
            "newest_source": "2026-03-20",
            "staleness_warning": False,
        },
        "behavioral_fingerprint": {
            "model": "gpt-5.1-2026-04",
            "prompt_version": "v3.2",
            "corpus_snapshot": "2026-04-10",
            "policy_rules_version": "v1.4",
        },
        "trace_id": "otel-abc123def456",
        "explainability": {
            "retrieval_summary": (
                "5 sources retrieved; 2 selected; "
                "3 excluded (low relevance, superseded, classification)"
            ),
            "reasoning_summary": (
                "Answer synthesized from OAS Act Section 4.1 and related regulations"
            ),
            "negative_evidence": ["No amendments found after 2025-12-01"],
            "cross_language": None,
        },
    }
