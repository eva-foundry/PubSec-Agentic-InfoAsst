// Hand-curated mirrors of backend Pydantic models. Field names match snake_case
// on the wire; do not translate to camelCase here — keep the boundary thin.

// ---------- auth ----------

export type Role = "reader" | "contributor" | "admin";
export type Classification = "unclassified" | "protected_a" | "protected_b";
export type Lang = "en" | "fr";
export type PortalKey = "self-service" | "admin" | "ops";

export interface UserContext {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  portal_access: PortalKey[];
  workspace_grants: string[];
  data_classification_level: Classification;
  language: Lang;
}

// ---------- provenance ----------

export interface ConfidenceFactors {
  retrieval_relevance: number;
  source_coverage: number;
  grounding_quality: number;
}

export interface FreshnessInfo {
  oldest_source: string | null;
  newest_source: string | null;
  staleness_warning: boolean;
}

export interface ModelSnapshot {
  deployment_name: string;
  model_name: string;
  model_version: string;
  provider: string;
  endpoint: string;
  sku: string;
  cost_model: string;
  parameter_overrides: Record<string, unknown>;
  config_version: number;
  last_changed_by: string;
  last_changed_at: string;
}

export interface BehavioralFingerprint {
  model: string;
  model_snapshot: ModelSnapshot | null;
  prompt_version: string;
  corpus_snapshot: string;
  policy_rules_version: string;
}

export interface Citation {
  file: string;
  page: number | null;
  section: string | null;
  sas_url: string;
  last_verified: string | null;
  source_quality_score: number | null;
}

export type EscalationTier = "auto-resolve" | "flagged-for-review" | "requires-human-decision";

export interface ProvenanceRecord {
  correlation_id: string;
  agent_id: string;
  delegation_chain: string[];
  sources_consulted: number;
  sources_cited: number;
  sources_excluded: number;
  exclusion_reasons: string[];
  policies_applied: string[];
  confidence: number;
  confidence_factors: ConfidenceFactors;
  escalation_tier: EscalationTier;
  freshness: FreshnessInfo;
  behavioral_fingerprint: BehavioralFingerprint;
  trace_id: string;
}

export interface ExplainabilityRecord {
  retrieval_summary: string;
  reasoning_summary: string;
  negative_evidence: string[];
  cross_language: string | null;
}

export interface AgentStep {
  id: number;
  tool: string;
  status: "running" | "complete" | "error";
  label_en: string;
  label_fr: string;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
}

// ---------- chat ----------

export interface ChatOverrides {
  top_k?: number;
  temperature?: number;
  response_length?: number;
  suggest_followup?: boolean;
}

export interface ChatRequest {
  message: string;
  workspace_id?: string | null;
  conversation_id?: string | null;
  mode?: "grounded" | "ungrounded";
  overrides?: ChatOverrides;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  workspace_id: string | null;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  provenance: ProvenanceRecord | null;
  explainability: ExplainabilityRecord | null;
  agent_steps: AgentStep[];
  created_at: string;
}

// Discriminated union over NDJSON chat stream events.
// Wire shape mirrors app/agents/orchestrator.py exactly.
export type ChatEvent =
  | ChatProvenanceEvent
  | ChatAgentStepEvent
  | ChatContentEvent
  | ChatCitationsEvent
  | ChatDegradationEvent
  | ChatProvenanceCompleteEvent;

export interface ChatProvenanceEvent {
  type: "provenance";
  correlation_id: string;
  trace_id: string;
  conversation_id: string;
  message_id: string;
}

export interface ChatAgentStepEvent extends AgentStep {
  type: "agent_step";
}

export interface ChatContentEvent {
  type: "content";
  delta: string;
  conversation_id?: string;
  message_id?: string;
}

export interface ChatCitationsEvent {
  type: "citations";
  citations: Citation[];
}

// The backend nests the degradation payload under a `degradation` key.
// Fields inside are open (status + service always, notice_en/fr when
// the dependency can degrade gracefully).
export interface ChatDegradationEvent {
  type: "degradation";
  degradation: {
    status: "partial" | "unavailable" | string;
    service: string;
    notice_en?: string;
    notice_fr?: string;
  };
}

export interface ChatProvenanceCompleteEvent {
  type: "provenance_complete";
  provenance: ProvenanceRecord;
  explainability?: ExplainabilityRecord;
}

// ---------- workspace portal ----------

export interface Workspace {
  id: string;
  name: string;
  name_fr: string;
  description: string;
  description_fr: string;
  type: string;
  status: "draft" | "pending_approval" | "active" | "suspended" | "archived";
  owner_id: string;
  data_classification: Classification;
  document_capacity: number;
  document_count: number;
  monthly_cost: number;
  cost_centre: string;
  created_at: string;
  updated_at: string;
  infrastructure: Record<string, unknown>;
  business_prompt: string;
  business_prompt_version: number;
  business_prompt_history: Array<Record<string, unknown>>;
  archetype?: string;
}

export interface Booking {
  id: string;
  workspace_id: string;
  requester_id: string;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled";
  start_date: string;
  end_date: string;
  entry_survey_completed: boolean;
  exit_survey_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  email: string;
  name: string;
  role: Role;
  added_at: string;
  added_by: string;
}

export interface EntrySurvey {
  id: string;
  booking_id: string;
  use_case: string;
  expected_users: number;
  expected_data_volume_gb: number;
  data_classification: Classification;
  business_justification: string;
  completed_at: string;
}

export interface ExitSurvey {
  id: string;
  booking_id: string;
  satisfaction_rating: number;
  objectives_met: boolean;
  data_disposition: "keep" | "archive" | "delete";
  feedback: string;
  would_recommend: boolean;
  completed_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: "uploading" | "processing" | "indexed" | "failed" | "deleted";
  chunk_count: number;
  data_classification: Classification;
  uploaded_by: string;
  uploaded_at: string;
  processed_at: string | null;
  error_message: string | null;
}

// ---------- admin ----------

export type AICMLevel = "level_1" | "level_2";

export interface Client {
  id: string;
  org_name: string;
  entra_group_id: string | null;
  billing_contact: string;
  data_classification_level: Classification;
  onboarded_at: string;
  status: "active" | "suspended" | "offboarded";
  workspace_ids: string[];
}

export interface Interview {
  id: string;
  client_id: string;
  admin_id: string;
  use_case_description: string;
  data_sources: string[];
  expected_volume: string;
  compliance_requirements: string;
  aicm_assessment: AICMLevel;
  archetype_recommendation: "legislation" | "case_law" | "default" | string;
  created_at: string;
}

export interface ModelConfig {
  id: string;
  model_name: string;
  provider: string;
  deployment_name: string;
  capabilities: string[];
  classification_ceiling: Classification;
  parameter_overrides: Record<string, unknown>;
  is_active: boolean;
  access_grants: string[];
  endpoint: string;
  location: string;
  sku: string;
  capacity: number;
  model_version: string;
  status: "deployed" | "available" | "provisioned";
  cost_model: "pay-as-you-go" | "provisioned" | "serverless";
  change_history: Array<Record<string, unknown>>;
}

export interface PromptVersion {
  id: string;
  prompt_name: string;
  version: number;
  content: string;
  author: string;
  rationale: string;
  created_at: string;
  is_active: boolean;
}

export interface WorkspaceProvisionPlan {
  resources: Array<Record<string, unknown>>;
  estimated_monthly_cost: string;
  deployment_time_estimate: string;
  infrastructure: Record<string, unknown>;
}

export interface WorkspaceDecommissionPlan {
  members_to_remove: string[];
  documents_to_delete: number;
  index_entries_to_purge: number;
  safety_gates: string[];
}

// ---------- feedback / ops ----------

export interface FeedbackRecord {
  id: string;
  conversation_id: string;
  message_id: string;
  workspace_id: string | null;
  user_id: string;
  signal: "accept" | "reject";
  correction_text: string | null;
  reason: string | null;
  original_answer_hash: string;
  cited_sources: string[];
  confidence_score: number;
  model_version: string;
  prompt_version: string;
  created_at: string;
}

export interface FeedbackSummary {
  total_feedback: number;
  acceptance_rate: number;
  correction_count: number;
  avg_confidence_accepted: number;
  avg_confidence_rejected: number;
  top_correction_reasons: Array<Record<string, unknown>>;
  period_start: string;
  period_end: string;
}

export interface FinOpsBreakdownEntry {
  cost_cad: number;
  queries: number;
  cost_per_query?: number;
  model_name?: string;
}

export interface FinOpsSummary {
  period_days: number;
  total_cost_cad: number;
  query_count: number;
  avg_latency_ms: number;
  avg_tokens: number;
  // Backend nests each breakdown; a flat map would lose queries + cost_per_query.
  cost_by_workspace: Record<string, FinOpsBreakdownEntry>;
  cost_by_model: Record<string, FinOpsBreakdownEntry>;
  cost_by_client: Record<string, FinOpsBreakdownEntry>;
  forecast_cad: number;
  waste_score: number;
  chargeback_coverage: number;
}

export interface SessionCost {
  session_id: string;
  cost_cad: number;
  queries: number;
}

export interface AIOpsMetrics {
  avg_confidence: number;
  groundedness: number;
  calibration_gap: number;
  escalation_rate: number;
  [k: string]: unknown;
}

export interface LiveOpsMetrics {
  uptime_percent: number;
  incident_count: number;
  sla_breach_count: number;
  [k: string]: unknown;
}

export interface OpsHealth {
  services: Array<{
    name: string;
    status: "healthy" | "degraded" | "down";
    latency_ms?: number;
    [k: string]: unknown;
  }>;
}

export interface CorpusHealth {
  total_documents: number;
  stale_documents: number;
  orphaned_chunks: number;
  [k: string]: unknown;
}

export interface EvalArenaEntry {
  model_id: string;
  model_name: string;
  elo_score: number;
  match_count: number;
  win_rate: number;
  [k: string]: unknown;
}

export interface DeploymentRecord {
  version: string;
  deployed_at: string;
  deployed_by: string;
  status: "pending" | "active" | "rolled-back";
  notes: string;
  [k: string]: unknown;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  correlation_id: string | null;
  [k: string]: unknown;
}

export interface SystemInfo {
  version: string;
  git_sha: string;
  env: string;
  features: Record<string, boolean>;
  [k: string]: unknown;
}
