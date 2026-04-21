// Deterministic NDJSON event sequence that mirrors the shape emitted by
// services/api-gateway/app/agents/orchestrator.py (grounded mode). Field
// names and nesting match the wire format asserted by
// services/api-gateway/tests/test_orchestrator.py.

import type { ChatEvent } from "@/lib/api/types";

const CORR = "corr-0000-0000-0000";
const CONV = "conv-0000-0000-0001";
const MSG = "msg-0000-0000-0002";

export const CHAT_FIXTURE_EVENTS: ChatEvent[] = [
  {
    type: "provenance",
    correlation_id: CORR,
    trace_id: "trace-abc",
    conversation_id: CONV,
    message_id: MSG,
  },
  {
    type: "agent_step",
    id: 1,
    tool: "query_rewrite",
    status: "running",
    label_en: "Clarifying query",
    label_fr: "Clarification de la requête",
    duration_ms: null,
    metadata: null,
  },
  {
    type: "agent_step",
    id: 1,
    tool: "query_rewrite",
    status: "complete",
    label_en: "Clarifying query",
    label_fr: "Clarification de la requête",
    duration_ms: 42,
    metadata: null,
  },
  {
    type: "agent_step",
    id: 2,
    tool: "search",
    status: "running",
    label_en: "Searching sources",
    label_fr: "Recherche dans les sources",
    duration_ms: null,
    metadata: null,
  },
  {
    type: "agent_step",
    id: 2,
    tool: "search",
    status: "complete",
    label_en: "Searching sources",
    label_fr: "Recherche dans les sources",
    duration_ms: 118,
    metadata: { sources_found: 3 },
  },
  {
    type: "agent_step",
    id: 3,
    tool: "cite",
    status: "complete",
    label_en: "Resolving citations",
    label_fr: "Résolution des citations",
    duration_ms: 8,
    metadata: { citations_resolved: 2 },
  },
  {
    type: "citations",
    citations: [
      {
        file: "oas-act.pdf",
        page: 12,
        section: "Section 4",
        sas_url: "https://example.blob.core.windows.net/oas-act.pdf?sv=test",
        last_verified: "2026-04-10",
        source_quality_score: 0.92,
      },
      {
        file: "regulations-2023.pdf",
        page: 3,
        section: null,
        sas_url: "https://example.blob.core.windows.net/regulations-2023.pdf?sv=test",
        last_verified: "2026-04-01",
        source_quality_score: 0.81,
      },
    ],
  },
  {
    type: "agent_step",
    id: 4,
    tool: "answer",
    status: "running",
    label_en: "Generating answer",
    label_fr: "Génération de la réponse",
    duration_ms: null,
    metadata: null,
  },
  { type: "content", delta: "Old Age Security ", conversation_id: CONV, message_id: MSG },
  { type: "content", delta: "benefits are paid ", conversation_id: CONV, message_id: MSG },
  { type: "content", delta: "monthly.", conversation_id: CONV, message_id: MSG },
  {
    type: "agent_step",
    id: 4,
    tool: "answer",
    status: "complete",
    label_en: "Generating answer",
    label_fr: "Génération de la réponse",
    duration_ms: 612,
    metadata: { answer_length: 36 },
  },
  {
    type: "provenance_complete",
    provenance: {
      correlation_id: CORR,
      agent_id: "eva-rag-agent",
      delegation_chain: ["user-request", "orchestrator", "search-tool"],
      sources_consulted: 5,
      sources_cited: 2,
      sources_excluded: 3,
      exclusion_reasons: ["superseded", "low-relevance", "superseded"],
      policies_applied: ["grounding-required", "sensitive-boundary"],
      confidence: 0.87,
      confidence_factors: {
        retrieval_relevance: 0.9,
        source_coverage: 0.85,
        grounding_quality: 0.87,
      },
      escalation_tier: "auto-resolve",
      freshness: {
        oldest_source: "2026-03-01",
        newest_source: "2026-04-10",
        staleness_warning: false,
      },
      behavioral_fingerprint: {
        model: "gpt-5-mini",
        model_snapshot: null,
        prompt_version: "rag-system:v1 + ws-oas-act:v1",
        corpus_snapshot: "2026-04-15",
        policy_rules_version: "v1.4",
      },
      trace_id: "trace-abc",
    },
    explainability: {
      retrieval_summary: "5 sources retrieved; 2 cited; 3 excluded (2 superseded, 1 low-relevance)",
      reasoning_summary: "Identified OAS monthly benefit from the OAS Act s.4 and cross-checked the 2023 regulations.",
      negative_evidence: ["No amendments found after 2026-04-10"],
      cross_language: null,
    },
  },
];

export const DEMO_USERS_FIXTURE = [
  {
    user_id: "demo-alice",
    email: "alice@example.org",
    name: "Alice Chen",
    role: "contributor",
    portal_access: ["self-service"],
    workspace_grants: ["ws-oas-act"],
    data_classification_level: "sensitive",
    language: "en",
  },
  {
    user_id: "demo-carol",
    email: "carol@example.org",
    name: "Carol Martinez",
    role: "admin",
    portal_access: ["self-service", "admin"],
    workspace_grants: ["all"],
    data_classification_level: "sensitive",
    language: "en",
  },
  {
    user_id: "demo-dave",
    email: "dave@example.org",
    name: "Dave Thompson",
    role: "admin",
    portal_access: ["self-service", "admin", "ops"],
    workspace_grants: ["all"],
    data_classification_level: "sensitive",
    language: "en",
  },
];

export const WORKSPACES_FIXTURE = [
  {
    id: "ws-oas-act",
    name: "OAS Act (Legislation)",
    name_fr: "Loi sur la SV (Législation)",
    description: "Old Age Security Act corpus",
    description_fr: "Corpus de la Loi sur la sécurité de la vieillesse",
    type: "legislation",
    status: "active",
    owner_id: "demo-carol",
    data_classification: "sensitive",
    document_capacity: 1000,
    document_count: 42,
    monthly_cost: 120,
    cost_centre: "example-org",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-04-10T00:00:00Z",
    infrastructure: {},
    business_prompt: "",
    business_prompt_version: 1,
    business_prompt_history: [],
  },
];

export const CONVERSATIONS_FIXTURE: unknown[] = [];
