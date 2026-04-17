// ---------------------------------------------------------------------------
// Ops API client — all endpoints for Portal 3 command centers
// ---------------------------------------------------------------------------

const API_BASE = '/v1/eva';
const AUTH_STORAGE_KEY = 'eva-auth-user';

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      return { 'x-demo-user-email': user.email };
    }
  } catch {
    // noop
  }
  return {};
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'down';
  latency_p99_ms: number;
  error_rate_pct?: number;
  note?: string;
  last_checked?: string;
}

export interface ServiceHealthData {
  overall: 'healthy' | 'degraded' | 'down';
  services: Record<string, ServiceStatus>;
  checked_at: string;
}

export interface WorkspaceCost {
  cost_cad: number;
  queries: number;
  cost_per_query: number;
}

export interface FinOpsData {
  period: string;
  total_cost_cad: number;
  budget_cad: number;
  utilization_pct: number;
  by_workspace: Record<string, WorkspaceCost>;
  anomalies: string[];
}

export interface ModelPerformance {
  avg_latency_ms: number;
  error_rate_pct: number;
}

export interface AIOpsData {
  period: string;
  groundedness: number;
  relevance: number;
  coherence: number;
  citation_accuracy: number;
  avg_confidence: number;
  escalation_rate_pct: number;
  drift_detected: boolean;
  model_performance: Record<string, ModelPerformance>;
}

export interface QueueInfo {
  depth: number;
  max_depth: number;
  avg_processing_ms: number;
}

export interface LiveOpsData {
  queues: Record<string, QueueInfo>;
  capacity: {
    active_workspaces: number;
    max_workspaces: number;
    total_documents: number;
    total_chunks: number;
  };
  sla: {
    uptime_pct: number;
    target_pct: number;
    incidents_mtd: number;
  };
}

export interface TraceStep {
  id: number;
  tool: string;
  status: string;
  duration_ms: number;
  input_hash: string;
  output_hash: string;
  metadata?: Record<string, unknown>;
}

export interface AgentTraceData {
  conversation_id: string;
  trace_id: string;
  steps: TraceStep[];
  total_duration_ms: number;
  model_used: string;
}

export interface CorpusIndex {
  document_count: number;
  chunk_count: number;
  last_indexed_at: string;
  stale_documents: number;
  freshness_score: number;
}

export interface CorpusHealthData {
  name: string;
  document_count: number;
  chunk_count: number;
  last_indexed_at: string;
  stale_documents: number;
  freshness_score: number;
}

export interface FeedbackSummary {
  total_feedbacks: number;
  positive_count: number;
  negative_count: number;
  correction_count: number;
  avg_rating: number;
  top_correction_patterns: Array<{ pattern: string; count: number }>;
}

export interface ContentGap {
  topic: string;
  query_count: number;
  confidence_avg: number;
}

export interface SourceQuality {
  source: string;
  acceptance_rate_pct: number;
  correction_rate_pct: number;
  quality_score: number;
  sample_size: number;
}

export interface FeedbackAnalyticsData {
  summary: FeedbackSummary;
  content_gaps: ContentGap[];
  source_quality: SourceQuality[];
}

export interface EloRanking {
  model: string;
  elo: number;
  win_rate_pct: number;
  avg_groundedness: number;
  archetype?: string;
  matches_played?: number;
}

export interface EvaluationArenaData {
  last_evaluation: string;
  total_comparisons: number;
  rankings: EloRanking[];
}

export interface DeploymentRecord {
  component: string;
  version: string;
  deployed_at: string;
  deployed_by: string;
  status: 'success' | 'failed' | 'rolled-back';
}

export interface DeploymentData {
  current: Record<string, string>;
  recent_deployments: DeploymentRecord[];
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getServiceHealth(): Promise<ServiceHealthData> {
  return fetchJson<ServiceHealthData>('/ops/health');
}

export async function getFinOpsMetrics(days: number = 30): Promise<FinOpsData> {
  return fetchJson<FinOpsData>(`/ops/metrics/finops?days=${days}`);
}

export async function getAIOpsMetrics(): Promise<AIOpsData> {
  return fetchJson<AIOpsData>('/ops/metrics/aiops');
}

export async function getLiveOpsMetrics(): Promise<LiveOpsData> {
  return fetchJson<LiveOpsData>('/ops/metrics/liveops');
}

export async function getAgentTrace(conversationId: string): Promise<AgentTraceData> {
  return fetchJson<AgentTraceData>(`/ops/traces/${encodeURIComponent(conversationId)}`);
}

export async function getCorpusHealth(): Promise<CorpusHealthData[]> {
  const raw = await fetchJson<{ indexes: Record<string, CorpusIndex> }>('/ops/corpus-health');
  return Object.entries(raw.indexes).map(([name, data]) => ({ name, ...data }));
}

export async function getFeedbackAnalytics(
  workspaceId?: string,
  days: number = 30,
): Promise<FeedbackAnalyticsData> {
  const params = new URLSearchParams({ days: String(days) });
  if (workspaceId) params.set('workspace_id', workspaceId);
  return fetchJson<FeedbackAnalyticsData>(`/ops/feedback-analytics?${params}`);
}

export async function getEvaluationArena(): Promise<EvaluationArenaData> {
  return fetchJson<EvaluationArenaData>('/ops/evaluation-arena');
}

export async function getDeployments(): Promise<DeploymentData> {
  return fetchJson<DeploymentData>('/ops/deployments');
}
