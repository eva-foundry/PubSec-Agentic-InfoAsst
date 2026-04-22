"""Seed data for Cosmos DB containers.

Mirrors the in-memory store seed data so the end-to-end walkthrough
works identically in Azure mode.  Called from main.py startup if
Cosmos containers are empty.
"""

from __future__ import annotations

import hashlib
import logging
import random
import uuid
from datetime import UTC, datetime, timedelta

from .cosmos_client import CosmosClientManager

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Per-workspace business prompts
# ---------------------------------------------------------------------------

_BUSINESS_PROMPTS: dict[str, str] = {
    "ws-oas-act": (
        "You are assisting policy analysts navigating the social benefits Act "
        "(Act §) and its regulations. Users need precise section "
        "references. When citing eligibility criteria, always reference the specific "
        "subsection (e.g., s. 3(1), s. 3(2)). Distinguish between full pension "
        "(40+ years residency) and partial pension (10-39 years, pro-rata "
        'calculation). When discussing residency, specify "after age 18" as '
        "required by the Act. Cross-reference the OAS Regulations (C.R.C., c. 1246) "
        "for evidence requirements."
    ),
    "ws-ei-juris": (
        "You are assisting league officials finding player-safety rulings "
        "relevant to specific on-ice incidents. Prioritize the highest authority "
        "level when multiple rulings address the same issue. Map each ruling to "
        "the relevant NHL Rule Book provision (e.g., Rule 42 charging, Rule 48 "
        "illegal check to the head). When multiple rulings conflict, surface the "
        "most recent from the highest authority. Use proper citation format: "
        "[YYYY] DoPS docket number for Department of Player Safety rulings. "
        "Identify the ratio decidendi (key reasoning) in each ruling."
    ),
    "ws-bdm-km": (
        "You are assisting the Benefits Delivery Modernization team with knowledge "
        "management. Help users find relevant policies, procedures, and guidelines "
        "across the document repository. Summarize key points concisely. Flag "
        "any documents that reference outdated processes or superseded policies."
    ),
    "ws-faq": (
        "You are a general FAQ assistant for AIA Domain Assistant. Answer common "
        "questions about workspace features, supported file types, booking "
        "processes, and team management. Keep answers clear and concise. Direct "
        "users to appropriate help resources when needed."
    ),
    "ws-sandbox": (
        "You are a training assistant in the AIA sandbox environment. Help users "
        "learn how to use the platform by answering questions about features, best "
        "practices, and workflows. This is a safe space for experimentation — "
        "encourage exploration."
    ),
}

_INFRASTRUCTURE: dict[str, str] = {
    "search_service": "msub-aia-dev-search",
    "search_endpoint": "https://msub-aia-dev-search.search.windows.net",
    "storage_account": "msubevasharedaihbyya73s",
    "cosmos_account": "msub-sandbox-cosmos-free",
    "openai_service": "msub-aia-dev-openai",
    "openai_deployment": "chat-default",
    "embedding_deployment": "embeddings-default",
    "container_environment": "msub-sandbox-env",
    "key_vault": "msubsandkv202603031449",
    "container_registry": "msubsandacr202603031449",
    "resource_group": "AIA-Sandbox-dev",
    "location": "eastus",
}


async def seed_all_containers(cosmos: CosmosClientManager) -> None:
    """Populate all Cosmos containers with demo walkthrough seed data."""
    await _seed_workspaces(cosmos)
    await _seed_bookings(cosmos)
    await _seed_teams(cosmos)
    await _seed_surveys(cosmos)
    await _seed_clients(cosmos)
    await _seed_model_registry(cosmos)
    await _seed_prompts(cosmos)
    await _seed_telemetry(cosmos)
    await _seed_chat_history(cosmos)
    await _seed_archetypes(cosmos)
    await _seed_deployments(cosmos)
    logger.info("All Cosmos containers seeded successfully.")


async def _seed_archetypes(cosmos: CosmosClientManager) -> None:
    """Seed the five template archetypes into Cosmos."""
    from ..archetype_store import ArchetypeStore

    tmp = ArchetypeStore()
    for a in tmp.list():
        payload = a.model_dump()
        payload["id"] = a.key  # Cosmos needs an `id` property
        await cosmos.upsert("archetypes", payload)
    logger.info("Seeded %d archetypes", len(tmp.list()))


async def _seed_deployments(cosmos: CosmosClientManager) -> None:
    """Seed the three rollback-history deployments into Cosmos."""
    from ..deployment_store import DeploymentStore

    tmp = DeploymentStore()
    for r in tmp.list_all():
        payload = r.model_dump()
        payload["id"] = r.version
        await cosmos.upsert("deployments", payload)
    logger.info("Seeded %d deployments", len(tmp.list_all()))


async def _seed_workspaces(cosmos: CosmosClientManager) -> None:
    workspaces = [
        {
            "id": "ws-oas-act",
            "name": "the social benefits Act Legislation",
            "name_fr": "Legislation sur la Loi sur la SV",
            "description": "sensitive workspace for social benefits Act legislative analysis.",
            "description_fr": (
                "Espace de travail Protege B pour l'analyse legislative de la Loi "
                "sur la securite de la vieillesse."
            ),
            "type": "legislation",
            "status": "active",
            "owner_id": "demo-carol",
            "data_classification": "sensitive",
            "document_capacity": 10,
            "document_count": 4,
            "monthly_cost": 4800.00,
            "cost_centre": "CC-OAS01",
            "infrastructure": _INFRASTRUCTURE,
            "business_prompt": _BUSINESS_PROMPTS["ws-oas-act"],
            "business_prompt_version": 1,
            "business_prompt_history": [
                {
                    "version": 1,
                    "content": _BUSINESS_PROMPTS["ws-oas-act"],
                    "author": "system",
                    "rationale": "Initial",
                    "created_at": "2025-06-01T00:00:00Z",
                }
            ],
            "created_at": "2025-06-01T00:00:00Z",
            "updated_at": "2026-04-01T00:00:00Z",
        },
        {
            "id": "ws-ei-juris",
            "name": "Legal Research",
            "name_fr": "Legal Research de l'AE",
            "description": "sensitive workspace for labor tribunal decisions.",
            "description_fr": (
                "Espace de travail Protege B pour les decisions du tribunal de "
                "l'assurance-emploi."
            ),
            "type": "case_law",
            "status": "active",
            "owner_id": "demo-carol",
            "data_classification": "sensitive",
            "document_capacity": 15,
            "document_count": 6,
            "monthly_cost": 3200.00,
            "cost_centre": "CC-EIJ01",
            "infrastructure": _INFRASTRUCTURE,
            "business_prompt": _BUSINESS_PROMPTS["ws-ei-juris"],
            "business_prompt_version": 1,
            "business_prompt_history": [
                {
                    "version": 1,
                    "content": _BUSINESS_PROMPTS["ws-ei-juris"],
                    "author": "system",
                    "rationale": "Initial",
                    "created_at": "2025-07-15T00:00:00Z",
                }
            ],
            "created_at": "2025-07-15T00:00:00Z",
            "updated_at": "2026-03-20T00:00:00Z",
        },
        {
            "id": "ws-bdm-km",
            "name": "Document Management",
            "name_fr": "Gestion des connaissances BPM",
            "description": "restricted workspace for document search and Q&A.",
            "description_fr": "Espace de travail Protege A pour la recherche de documents BPM.",
            "type": "knowledge_mgmt",
            "status": "active",
            "owner_id": "demo-carol",
            "data_classification": "restricted",
            "document_capacity": 20,
            "document_count": 12,
            "monthly_cost": 2000.00,
            "cost_centre": "CC-BDM01",
            "infrastructure": _INFRASTRUCTURE,
            "business_prompt": _BUSINESS_PROMPTS["ws-bdm-km"],
            "business_prompt_version": 1,
            "business_prompt_history": [],
            "created_at": "2025-08-01T00:00:00Z",
            "updated_at": "2026-04-05T00:00:00Z",
        },
        {
            "id": "ws-faq",
            "name": "General FAQ",
            "name_fr": "FAQ generale",
            "description": "Unclassified workspace for general Q&A.",
            "description_fr": "Espace de travail non classifie pour questions-reponses generales.",
            "type": "faq",
            "status": "active",
            "owner_id": "demo-carol",
            "data_classification": "unclassified",
            "document_capacity": 25,
            "document_count": 1,
            "monthly_cost": 1200.00,
            "cost_centre": "CC-FAQ01",
            "infrastructure": _INFRASTRUCTURE,
            "business_prompt": _BUSINESS_PROMPTS["ws-faq"],
            "business_prompt_version": 1,
            "business_prompt_history": [],
            "created_at": "2025-09-01T00:00:00Z",
            "updated_at": "2026-04-10T00:00:00Z",
        },
        {
            "id": "ws-sandbox",
            "name": "Sandbox / Training",
            "name_fr": "Bac a sable / Formation",
            "description": "Unclassified sandbox workspace for experimentation.",
            "description_fr": "Espace bac a sable non classifie pour l'experimentation.",
            "type": "sandbox",
            "status": "active",
            "owner_id": "demo-carol",
            "data_classification": "unclassified",
            "document_capacity": 50,
            "document_count": 3,
            "monthly_cost": 0.00,
            "cost_centre": "CC-SBX01",
            "infrastructure": _INFRASTRUCTURE,
            "business_prompt": _BUSINESS_PROMPTS["ws-sandbox"],
            "business_prompt_version": 1,
            "business_prompt_history": [],
            "created_at": "2025-03-01T00:00:00Z",
            "updated_at": "2026-03-15T00:00:00Z",
        },
    ]
    for ws in workspaces:
        await cosmos.upsert("workspaces", ws)
    logger.info("Seeded %d workspaces", len(workspaces))


async def _seed_bookings(cosmos: CosmosClientManager) -> None:
    bookings = [
        {
            "id": "bk-alice-oas",
            "workspace_id": "ws-oas-act",
            "requester_id": "demo-alice",
            "status": "active",
            "start_date": "2026-02-01",
            "end_date": "2026-06-30",
            "entry_survey_completed": True,
            "exit_survey_completed": False,
            "created_at": "2026-01-20T00:00:00Z",
            "updated_at": "2026-02-01T00:00:00Z",
        },
        {
            "id": "bk-alice-faq",
            "workspace_id": "ws-faq",
            "requester_id": "demo-alice",
            "status": "completed",
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "entry_survey_completed": True,
            "exit_survey_completed": True,
            "created_at": "2026-02-25T00:00:00Z",
            "updated_at": "2026-03-31T00:00:00Z",
        },
        {
            "id": "bk-eve-ei",
            "workspace_id": "ws-ei-juris",
            "requester_id": "demo-eve",
            "status": "active",
            "start_date": "2026-03-15",
            "end_date": "2026-07-31",
            "entry_survey_completed": True,
            "exit_survey_completed": False,
            "created_at": "2026-03-10T00:00:00Z",
            "updated_at": "2026-03-15T00:00:00Z",
        },
    ]
    for b in bookings:
        await cosmos.upsert("bookings", b)
    logger.info("Seeded %d bookings", len(bookings))


async def _seed_teams(cosmos: CosmosClientManager) -> None:
    teams = [
        {
            "id": "tm-alice-1",
            "booking_id": "bk-alice-oas",
            "workspace_id": "ws-oas-act",
            "user_id": "demo-alice",
            "email": "alice@example.org",
            "name": "Alice Chen",
            "role": "admin",
            "added_at": "2026-02-01T00:00:00Z",
            "added_by": "demo-alice",
        },
        {
            "id": "tm-bob-1",
            "booking_id": "bk-alice-oas",
            "workspace_id": "ws-oas-act",
            "user_id": "demo-bob",
            "email": "bob@example.org",
            "name": "Bob Wilson",
            "role": "reader",
            "added_at": "2026-02-01T00:00:00Z",
            "added_by": "demo-alice",
        },
        {
            "id": "tm-eve-1",
            "booking_id": "bk-alice-oas",
            "workspace_id": "ws-oas-act",
            "user_id": "demo-eve",
            "email": "eve@example.org",
            "name": "Eve Tremblay",
            "role": "contributor",
            "added_at": "2026-02-05T00:00:00Z",
            "added_by": "demo-alice",
        },
        {
            "id": "tm-eve-2",
            "booking_id": "bk-eve-ei",
            "workspace_id": "ws-ei-juris",
            "user_id": "demo-eve",
            "email": "eve@example.org",
            "name": "Eve Tremblay",
            "role": "admin",
            "added_at": "2026-03-15T00:00:00Z",
            "added_by": "demo-eve",
        },
        {
            "id": "tm-alice-2",
            "booking_id": "bk-eve-ei",
            "workspace_id": "ws-ei-juris",
            "user_id": "demo-alice",
            "email": "alice@example.org",
            "name": "Alice Chen",
            "role": "reader",
            "added_at": "2026-03-16T00:00:00Z",
            "added_by": "demo-eve",
        },
    ]
    for t in teams:
        await cosmos.upsert("teams", t)
    logger.info("Seeded %d team members", len(teams))


async def _seed_surveys(cosmos: CosmosClientManager) -> None:
    entries = [
        {
            "id": "es-alice-oas",
            "booking_id": "bk-alice-oas",
            "use_case": "Legislative analysis of social benefits Act provisions",
            "expected_users": 8,
            "expected_data_volume_gb": 2.5,
            "data_classification": "sensitive",
            "business_justification": "OAS adjudicators need AI-assisted search.",
            "completed_at": "2026-01-25T14:30:00Z",
        },
        {
            "id": "es-alice-faq",
            "booking_id": "bk-alice-faq",
            "use_case": "General FAQ for onboarding new team members",
            "expected_users": 15,
            "expected_data_volume_gb": 0.5,
            "data_classification": "unclassified",
            "business_justification": "New hires need self-service access.",
            "completed_at": "2026-02-26T10:00:00Z",
        },
        {
            "id": "es-eve-ei",
            "booking_id": "bk-eve-ei",
            "use_case": "Benefits tribunal decision research and case law analysis",
            "expected_users": 5,
            "expected_data_volume_gb": 4.0,
            "data_classification": "sensitive",
            "business_justification": "Appeals officers require citation-aware search.",
            "completed_at": "2026-03-12T09:15:00Z",
        },
    ]
    for e in entries:
        await cosmos.upsert("surveys-entry", e)

    exits = [
        {
            "id": "xs-alice-faq",
            "booking_id": "bk-alice-faq",
            "satisfaction_rating": 4,
            "objectives_met": True,
            "data_disposition": "archive",
            "feedback": "Good experience overall. Would benefit from better bilingual support.",
            "would_recommend": True,
            "completed_at": "2026-03-31T16:00:00Z",
        },
    ]
    for x in exits:
        await cosmos.upsert("surveys-exit", x)
    logger.info("Seeded %d entry surveys, %d exit surveys", len(entries), len(exits))


async def _seed_clients(cosmos: CosmosClientManager) -> None:
    clients = [
        {
            "id": "client-bdm",
            "org_name": "Benefits Delivery Modernization",
            "entra_group_id": "grp-bdm-001",
            "billing_contact": "bdm-finance@example.org",
            "data_classification_level": "sensitive",
            "onboarded_at": "2026-01-15T00:00:00Z",
            "status": "active",
            "workspace_ids": ["ws-oas-act", "ws-ei-juris", "ws-bdm-km"],
        },
        {
            "id": "client-sco",
            "org_name": "the service provider Operations",
            "entra_group_id": "grp-sco-001",
            "billing_contact": "sco-admin@example.org",
            "data_classification_level": "unclassified",
            "onboarded_at": "2026-03-01T00:00:00Z",
            "status": "active",
            "workspace_ids": ["ws-faq"],
        },
    ]
    for c in clients:
        await cosmos.upsert("clients", c)
    logger.info("Seeded %d clients", len(clients))


async def _seed_model_registry(cosmos: CosmosClientManager) -> None:
    models = [
        {
            "id": "chat-default",
            "model_name": "gpt-5-mini",
            "provider": "azure-openai",
            "deployment_name": "chat-default",
            "capabilities": ["chat", "function-calling", "streaming"],
            "classification_ceiling": "sensitive",
            "parameter_overrides": {"max_completion_tokens": 4096},
            "is_active": True,
            "access_grants": ["all"],
            "endpoint": "https://msub-aia-dev-openai.openai.azure.com/",
            "location": "westus",
            "sku": "GlobalStandard",
            "capacity": 60,
            "model_version": "2025-08-07",
            "status": "deployed",
            "cost_model": "pay-as-you-go",
            "change_history": [],
        },
        {
            "id": "reasoning-premium",
            "model_name": "gpt-5.1",
            "provider": "azure-openai",
            "deployment_name": "reasoning-premium",
            "capabilities": ["chat", "reasoning", "analysis", "function-calling", "streaming"],
            "classification_ceiling": "sensitive",
            "parameter_overrides": {"max_completion_tokens": 8192},
            "is_active": True,
            "access_grants": ["ws-oas-act", "ws-ei-juris"],
            "endpoint": "https://msub-aia-dev-openai.openai.azure.com/",
            "location": "westus",
            "sku": "GlobalStandard",
            "capacity": 40,
            "model_version": "2025-11-13",
            "status": "deployed",
            "cost_model": "pay-as-you-go",
            "change_history": [],
        },
        {
            "id": "embeddings-default",
            "model_name": "text-embedding-3-small",
            "provider": "azure-openai",
            "deployment_name": "embeddings-default",
            "capabilities": ["embeddings"],
            "classification_ceiling": "sensitive",
            "parameter_overrides": {},
            "is_active": True,
            "access_grants": ["all"],
            "endpoint": "https://msub-aia-dev-openai.openai.azure.com/",
            "location": "westus",
            "sku": "Standard",
            "capacity": 80,
            "model_version": "1",
            "status": "deployed",
            "cost_model": "pay-as-you-go",
            "change_history": [],
        },
    ]
    for m in models:
        await cosmos.upsert("model-registry", m)
    logger.info("Seeded %d models in registry", len(models))


async def _seed_prompts(cosmos: CosmosClientManager) -> None:
    now = datetime.now(UTC).isoformat()
    prompts = [
        {
            "id": str(uuid.uuid4()),
            "prompt_name": "rag-system",
            "version": 1,
            "is_active": True,
            "content": (
                "You are AIA, a government AI assistant for Organization. You help users find "
                "information in their workspace documents.\n\nRules:\n"
                "- Answer ONLY from the provided source documents\n"
                "- Cite every claim using [File0], [File1], etc.\n"
                "- If the sources don't contain enough information, say so honestly\n"
                "- Never make claims without citation support\n"
                "- Respond in the same language as the user's question\n"
                "- Be concise but thorough"
            ),
            "author": "system",
            "rationale": "Initial RAG system prompt",
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "prompt_name": "ungrounded-system",
            "version": 1,
            "is_active": True,
            "content": (
                "You are AIA, a government AI assistant for Organization. You provide general "
                "knowledge assistance without access to specific documents.\n\nRules:\n"
                "- Clearly state that your responses are not grounded\n"
                "- Provide helpful, accurate information\n"
                "- Respond in the same language as the user's question"
            ),
            "author": "system",
            "rationale": "Initial ungrounded prompt",
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "prompt_name": "query-rewrite",
            "version": 1,
            "is_active": True,
            "content": (
                "Given a user question and conversation history, generate an optimized "
                "search query. Output ONLY the search query, nothing else."
            ),
            "author": "system",
            "rationale": "Initial query rewrite prompt",
            "created_at": now,
        },
    ]
    for p in prompts:
        await cosmos.upsert("prompt-versions", p)
    logger.info("Seeded %d prompt versions", len(prompts))


async def _seed_telemetry(cosmos: CosmosClientManager) -> None:
    """Generate 60 realistic APIM telemetry records across April 2026."""
    rng = random.Random(42)
    workspaces = ["ws-oas-act", "ws-ei-juris", "ws-faq"]
    workspace_weights = [0.3, 0.5, 0.2]
    deployments = ["chat-default", "reasoning-premium"]
    deployment_weights = [0.7, 0.3]
    clients = ["aia-agentic", "aia-portal", "aia-batch"]
    client_weights = [0.6, 0.3, 0.1]
    model_map = {"chat-default": "gpt-5-mini", "reasoning-premium": "gpt-5.1"}
    pricing = {
        "chat-default": {"prompt": 0.00015, "completion": 0.0006},
        "reasoning-premium": {"prompt": 0.003, "completion": 0.012},
    }

    base = datetime(2026, 4, 1, 8, 0, 0, tzinfo=UTC)
    for i in range(60):
        ws = rng.choices(workspaces, weights=workspace_weights, k=1)[0]
        dep = rng.choices(deployments, weights=deployment_weights, k=1)[0]
        client = rng.choices(clients, weights=client_weights, k=1)[0]
        ts = base + timedelta(
            days=rng.randint(0, 13), hours=rng.randint(0, 9) + 8, minutes=rng.randint(0, 59)
        )
        pt = rng.randint(300, 2000)
        ct = rng.randint(200, 1200)
        p = pricing.get(dep, pricing["chat-default"])
        cost = round((pt / 1000) * p["prompt"] + (ct / 1000) * p["completion"], 6)

        await cosmos.upsert(
            "telemetry",
            {
                "id": str(uuid.UUID(int=rng.getrandbits(128))),
                "correlation_id": str(uuid.UUID(int=rng.getrandbits(128))),
                "timestamp": ts.isoformat(),
                "workspace_id": ws,
                "session_id": f"seed-session-{i // 5}",
                "client_id": client,
                "deployment": dep,
                "model_name": model_map.get(dep, dep),
                "operation": "chat/completions",
                "prompt_tokens": pt,
                "completion_tokens": ct,
                "total_tokens": pt + ct,
                "latency_ms": rng.randint(800, 3000),
                "cost_cad": cost,
                "status_code": 200 if rng.random() > 0.03 else 429,
            },
        )
    logger.info("Seeded 60 telemetry records")


async def _seed_chat_history(cosmos: CosmosClientManager) -> None:
    """Seed 4 past conversations matching the in-memory chat store."""

    def sha(t):
        return hashlib.sha256(t.encode()).hexdigest()

    records = [
        # conv-seed-1: the social benefits Act, high confidence
        {
            "id": "msg-s1-1",
            "message_id": "msg-s1-1",
            "conversation_id": "conv-seed-1",
            "workspace_id": "ws-oas-act",
            "user_id": "demo-alice",
            "role": "user",
            "content_preview": "What are the eligibility requirements for social benefits?",
            "content_hash": sha("What are the eligibility requirements for social benefits?"),
            "citations": [],
            "provenance": None,
            "agent_steps": [],
            "confidence_score": 0.0,
            "model": "gpt-5.1-2026-04",
            "mode": "grounded",
            "created_at": "2026-04-10T09:00:00Z",
        },
        {
            "id": "msg-s1-2",
            "message_id": "msg-s1-2",
            "conversation_id": "conv-seed-1",
            "workspace_id": "ws-oas-act",
            "user_id": "demo-alice",
            "role": "assistant",
            "content_preview": (
                "Based on the social benefits Act, eligibility requires public-sector "
                "residency of at least 10 years after age 18..."
            ),
            "content_hash": sha("oas-eligibility-answer-full"),
            "citations": [{"file": "nhl-cba-excerpt.txt", "page": 1, "section": "Section 3"}],
            "provenance": {"correlation_id": "corr-s1-1", "model": "gpt-5.1-2026-04"},
            "agent_steps": [
                {"id": 1, "tool": "query_rewrite", "status": "complete", "duration_ms": 95},
                {
                    "id": 2,
                    "tool": "search",
                    "status": "complete",
                    "duration_ms": 280,
                    "metadata": {"sources_found": 4},
                },
                {"id": 3, "tool": "cite", "status": "complete", "duration_ms": 45},
                {"id": 4, "tool": "answer", "status": "complete", "duration_ms": 720},
            ],
            "confidence_score": 0.92,
            "model": "gpt-5.1-2026-04",
            "mode": "grounded",
            "created_at": "2026-04-10T09:00:12Z",
        },
        # conv-seed-2: Benefits Juris, medium confidence
        {
            "id": "msg-s2-1",
            "message_id": "msg-s2-1",
            "conversation_id": "conv-seed-2",
            "workspace_id": "ws-ei-juris",
            "user_id": "demo-eve",
            "role": "user",
            "content_preview": (
                "Has the DoPS considered illegal-check cases where the "
                "player had a mitigating play-on circumstance?"
            ),
            "content_hash": sha("illegal-check-mitigating-question"),
            "citations": [],
            "provenance": None,
            "agent_steps": [],
            "confidence_score": 0.0,
            "model": "gpt-5.1-2026-04",
            "mode": "grounded",
            "created_at": "2026-04-11T14:20:00Z",
        },
        {
            "id": "msg-s2-2",
            "message_id": "msg-s2-2",
            "conversation_id": "conv-seed-2",
            "workspace_id": "ws-ei-juris",
            "user_id": "demo-eve",
            "role": "assistant",
            "content_preview": (
                "The Department of Player Safety has addressed illegal-check "
                "rulings with mitigating circumstances in several decisions..."
            ),
            "content_hash": sha("illegal-check-answer-full"),
            "citations": [
                {"file": "dops-ruling-sample.txt", "page": 1, "section": "Analysis"}
            ],
            "provenance": {"correlation_id": "corr-s2-1", "model": "gpt-5.1-2026-04"},
            "agent_steps": [
                {"id": 1, "tool": "query_rewrite", "status": "complete", "duration_ms": 105},
                {
                    "id": 2,
                    "tool": "search",
                    "status": "complete",
                    "duration_ms": 420,
                    "metadata": {"sources_found": 3},
                },
                {"id": 3, "tool": "cite", "status": "complete", "duration_ms": 38},
                {"id": 4, "tool": "answer", "status": "complete", "duration_ms": 850},
            ],
            "confidence_score": 0.62,
            "model": "gpt-5.1-2026-04",
            "mode": "grounded",
            "created_at": "2026-04-11T14:20:18Z",
        },
        # conv-seed-3: low confidence, escalation
        {
            "id": "msg-s3-1",
            "message_id": "msg-s3-1",
            "conversation_id": "conv-seed-3",
            "workspace_id": "ws-oas-act",
            "user_id": "demo-bob",
            "role": "user",
            "content_preview": (
                "Does the the social benefits Act apply to non-residents who lived in the country for 8 years?"
            ),
            "content_hash": sha("non-resident-8-years-question"),
            "citations": [],
            "provenance": None,
            "agent_steps": [],
            "confidence_score": 0.0,
            "model": "gpt-5.1-2026-04",
            "mode": "grounded",
            "created_at": "2026-04-12T10:00:00Z",
        },
        {
            "id": "msg-s3-2",
            "message_id": "msg-s3-2",
            "conversation_id": "conv-seed-3",
            "workspace_id": "ws-oas-act",
            "user_id": "demo-bob",
            "role": "assistant",
            "content_preview": (
                "I was unable to find sufficient information in the available sources..."
            ),
            "content_hash": sha("non-resident-answer-low-confidence"),
            "citations": [{"file": "nhl-cba-excerpt.txt", "page": 1, "section": "Section 3(1)(b)"}],
            "provenance": {
                "correlation_id": "corr-s3-1",
                "model": "gpt-5.1-2026-04",
                "escalation_triggered": True,
                "escalation_reason": "Confidence below threshold (0.35 < 0.50)",
            },
            "agent_steps": [
                {"id": 1, "tool": "query_rewrite", "status": "complete", "duration_ms": 110},
                {
                    "id": 2,
                    "tool": "search",
                    "status": "complete",
                    "duration_ms": 350,
                    "metadata": {"sources_found": 2},
                },
                {"id": 3, "tool": "cite", "status": "complete", "duration_ms": 30},
                {"id": 4, "tool": "answer", "status": "complete", "duration_ms": 900},
            ],
            "confidence_score": 0.35,
            "model": "gpt-5.1-2026-04",
            "mode": "grounded",
            "created_at": "2026-04-12T10:00:22Z",
        },
        # conv-seed-4: ungrounded
        {
            "id": "msg-s4-1",
            "message_id": "msg-s4-1",
            "conversation_id": "conv-seed-4",
            "workspace_id": None,
            "user_id": "demo-alice",
            "role": "user",
            "content_preview": (
                "What is the general process for applying to government government benefits?"
            ),
            "content_hash": sha("general-benefits-question"),
            "citations": [],
            "provenance": None,
            "agent_steps": [],
            "confidence_score": 0.0,
            "model": "gpt-5.1-2026-04",
            "mode": "ungrounded",
            "created_at": "2026-04-13T16:00:00Z",
        },
        {
            "id": "msg-s4-2",
            "message_id": "msg-s4-2",
            "conversation_id": "conv-seed-4",
            "workspace_id": None,
            "user_id": "demo-alice",
            "role": "assistant",
            "content_preview": (
                "Generally, enterprise benefits are administered "
                "through the service provider..."
            ),
            "content_hash": sha("general-benefits-ungrounded-answer"),
            "citations": [],
            "provenance": {"correlation_id": "corr-s4-1", "model": "gpt-5.1-2026-04"},
            "agent_steps": [{"id": 1, "tool": "answer", "status": "complete", "duration_ms": 650}],
            "confidence_score": 0.15,
            "model": "gpt-5.1-2026-04",
            "mode": "ungrounded",
            "created_at": "2026-04-13T16:00:08Z",
        },
    ]
    for r in records:
        await cosmos.upsert("chat-history", r)
    logger.info("Seeded %d chat history records", len(records))
