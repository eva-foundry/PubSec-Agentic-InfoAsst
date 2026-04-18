// Deterministic fixtures for ops/admin/system endpoints consumed by the
// wired pages. Field names match the backend Pydantic models exactly
// (snake_case, no translation at the wire).

import type {
  AIOpsMetrics,
  ArchetypeDefinition,
  AuditEntry,
  CorpusHealth,
  DeploymentRecord,
  DriftMetrics,
  EvalArenaEntry,
  FinOpsSummary,
  LiveOpsMetrics,
  ModelConfig,
  OpsHealth,
  SystemInfo,
} from "@/lib/api/types";

export const FINOPS_FIXTURE: FinOpsSummary = {
  period_days: 30,
  total_cost_cad: 1842.5,
  query_count: 1284,
  avg_latency_ms: 1742,
  avg_tokens: 1180,
  cost_by_workspace: {
    "ws-oas-act": { cost_cad: 920.1, queries: 640, cost_per_query: 1.4377 },
    "ws-ei-juris": { cost_cad: 640.25, queries: 440, cost_per_query: 1.4551 },
    "ws-faq": { cost_cad: 282.15, queries: 204, cost_per_query: 1.3831 },
  },
  cost_by_model: {
    "chat-default": { cost_cad: 1300.4, queries: 1100, model_name: "gpt-5-mini" },
    "reasoning-premium": { cost_cad: 540.2, queries: 180, model_name: "gpt-5.1" },
    "embeddings-default": { cost_cad: 1.9, queries: 4, model_name: "text-embedding-3-small" },
  },
  cost_by_client: {
    "eva-agentic": { cost_cad: 1100, queries: 820 },
    "eva-portal": { cost_cad: 550, queries: 340 },
    "eva-batch": { cost_cad: 192.5, queries: 124 },
  },
  forecast_cad: 1842.5,
  waste_score: 12.4,
  chargeback_coverage: 0.96,
};

export const AIOPS_FIXTURE: AIOpsMetrics = {
  avg_confidence: 0.82,
  groundedness: 0.91,
  calibration_gap: 0.04,
  escalation_rate: 0.07,
};

export const LIVEOPS_FIXTURE: LiveOpsMetrics = {
  uptime_percent: 99.94,
  incident_count: 2,
  sla_breach_count: 0,
};

export const OPS_HEALTH_FIXTURE: OpsHealth = {
  services: [
    { name: "api-gateway", status: "healthy", latency_ms: 42 },
    { name: "orchestrator", status: "healthy", latency_ms: 180 },
    { name: "vector-search", status: "degraded", latency_ms: 540 },
    { name: "document-extraction", status: "healthy", latency_ms: 95 },
  ],
};

export const CORPUS_HEALTH_FIXTURE: CorpusHealth = {
  total_documents: 4821,
  stale_documents: 142,
  orphaned_chunks: 7,
};

export const EVAL_ARENA_FIXTURE: EvalArenaEntry[] = [
  { model_id: "m-gpt51", model_name: "gpt-5.1 + rag-answer v3.4.1", elo_score: 1542, match_count: 115, win_rate: 0.73 },
  { model_id: "m-opus47", model_name: "claude-opus-4.7 + rag-answer v3.4.1", elo_score: 1518, match_count: 115, win_rate: 0.69 },
  { model_id: "m-gpt51-old", model_name: "gpt-5.1 + rag-answer v3.4.0", elo_score: 1486, match_count: 115, win_rate: 0.62 },
];

export const DEPLOYMENTS_FIXTURE: DeploymentRecord[] = [
  { version: "v1.8.2", deployed_at: "2026-04-16T11:48:00Z", deployed_by: "bob", status: "active", notes: "cache shedding under p99>600ms" },
  { version: "v1.8.1", deployed_at: "2026-04-12T08:00:00Z", deployed_by: "alice", status: "rolled-back", notes: "reranker timeout bump" },
  { version: "v1.8.0", deployed_at: "2026-04-09T09:32:00Z", deployed_by: "carol", status: "rolled-back", notes: "initial v1.8 cut" },
];

export const ADMIN_MODELS_FIXTURE: ModelConfig[] = [
  {
    id: "m-gpt-5-mini",
    model_name: "gpt-5-mini",
    provider: "azure-openai",
    deployment_name: "chat-default",
    capabilities: ["chat", "rag"],
    classification_ceiling: "protected_b",
    parameter_overrides: {},
    is_active: true,
    access_grants: ["all"],
    endpoint: "https://eva-openai.openai.azure.com",
    location: "canadacentral",
    sku: "GlobalStandard",
    capacity: 200,
    model_version: "2025-08-07",
    status: "deployed",
    cost_model: "pay-as-you-go",
    change_history: [],
  },
  {
    id: "m-gpt-51",
    model_name: "gpt-5.1",
    provider: "azure-openai",
    deployment_name: "reasoning-premium",
    capabilities: ["chat", "reasoning"],
    classification_ceiling: "protected_b",
    parameter_overrides: { temperature: 0.2 },
    is_active: false,
    access_grants: ["admin-only"],
    endpoint: "https://eva-openai.openai.azure.com",
    location: "canadacentral",
    sku: "GlobalStandard",
    capacity: 50,
    model_version: "2025-11-01",
    status: "provisioned",
    cost_model: "provisioned",
    change_history: [],
  },
];

export const ADMIN_PROMPTS_FIXTURE = [
  { name: "rag-system", active_version: 3 },
  { name: "ungrounded-system", active_version: 1 },
];

export const AUDIT_ENTRIES_FIXTURE: AuditEntry[] = [
  {
    id: "au-0001",
    timestamp: "2026-04-15T09:42:10Z",
    actor: "demo-dave",
    action: "model.toggle",
    target: "m-gpt-51",
    subject: "gpt-5.1",
    decision: "allow",
    policy: "model-registry",
    rationale: "enable reasoning-premium for Legal workspace",
    correlation_id: null,
  },
  {
    id: "au-0002",
    timestamp: "2026-04-13T14:05:41Z",
    actor: "system-guardrail",
    action: "guardrail.decision",
    target: "conv-abc123",
    subject: "prompt-injection-probe",
    decision: "deny",
    policy: "prompt-injection-defense-v1",
    rationale: "matched known-bad pattern",
    correlation_id: null,
  },
];

export const ARCHETYPES_FIXTURE: ArchetypeDefinition[] = [
  {
    key: "kb",
    name: "Knowledge Base",
    name_fr: "Base de connaissances",
    description: "FAQ-style retrieval over a curated corpus.",
    description_fr: "Recuperation de type FAQ sur un corpus organise.",
    assurance: "Advisory",
    cost_band: "$49-$120/mo",
    sample_questions: ["What is the parental leave policy?"],
    sample_questions_fr: ["Quelle est la politique de conge parental?"],
    default_capacity: 25,
  },
  {
    key: "decision",
    name: "Decision Support",
    name_fr: "Aide a la decision",
    description: "Rule-engine-backed answers with mandatory HITL gates.",
    description_fr: "Reponses soutenues par un moteur de regles avec controles humains obligatoires.",
    assurance: "Decision-informing",
    cost_band: "$480-$2.4K/mo",
    sample_questions: ["Approve cross-border data transfer for EU customer?"],
    sample_questions_fr: ["Approuver le transfert de donnees transfrontalier pour un client UE?"],
    default_capacity: 8,
  },
];

export const DRIFT_METRICS_FIXTURE: DriftMetrics = {
  workspace_id: "ws-oas-act",
  window: "7d",
  model: [
    { day: "2026-04-12", psi: 0.11, confidence_delta: -0.01 },
    { day: "2026-04-13", psi: 0.13, confidence_delta: 0.0 },
    { day: "2026-04-14", psi: 0.18, confidence_delta: 0.01 },
    { day: "2026-04-15", psi: 0.22, confidence_delta: -0.02 },
    { day: "2026-04-16", psi: 0.27, confidence_delta: -0.01 },
    { day: "2026-04-17", psi: 0.29, confidence_delta: 0.0 },
    { day: "2026-04-18", psi: 0.32, confidence_delta: 0.01 },
  ],
  prompt: [
    { day: "2026-04-12", lexical_shift: 0.05, token_mix_delta: 0.1 },
    { day: "2026-04-13", lexical_shift: 0.07, token_mix_delta: -0.05 },
    { day: "2026-04-14", lexical_shift: 0.09, token_mix_delta: 0.2 },
    { day: "2026-04-15", lexical_shift: 0.1, token_mix_delta: 0.0 },
    { day: "2026-04-16", lexical_shift: 0.12, token_mix_delta: -0.1 },
    { day: "2026-04-17", lexical_shift: 0.14, token_mix_delta: 0.15 },
    { day: "2026-04-18", lexical_shift: 0.16, token_mix_delta: 0.0 },
  ],
  corpus: [
    { day: "2026-04-12", refresh_count: 4, stale_pct: 0.06 },
    { day: "2026-04-13", refresh_count: 2, stale_pct: 0.07 },
    { day: "2026-04-14", refresh_count: 7, stale_pct: 0.08 },
    { day: "2026-04-15", refresh_count: 3, stale_pct: 0.1 },
    { day: "2026-04-16", refresh_count: 5, stale_pct: 0.13 },
    { day: "2026-04-17", refresh_count: 2, stale_pct: 0.16 },
    { day: "2026-04-18", refresh_count: 6, stale_pct: 0.18 },
  ],
  alerts: [
    {
      type: "model",
      severity: "warning",
      message: "Embedding PSI 0.32 above threshold (0.25)",
      since: "2026-04-16",
    },
    {
      type: "corpus",
      severity: "warning",
      message: "18% of documents past freshness threshold",
      since: "2026-04-14",
    },
  ],
};

export const SYSTEM_INFO_FIXTURE: SystemInfo = {
  version: "0.1.0",
  git_sha: "0eebf44",
  env: "dev",
  features: { streaming: true, demo_auth: true },
};
