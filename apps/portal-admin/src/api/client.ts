// ---------------------------------------------------------------------------
// Portal 2 Admin API client — typed fetch wrappers for EVA admin backend
// ---------------------------------------------------------------------------

const API_BASE = '/v1/eva/admin';
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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`API ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientOnboardingData {
  org_name: string;
  billing_contact_email: string;
  entra_id_group: string;
  data_classification: 'unclassified' | 'protected_a' | 'protected_b';
}

export interface InterviewData {
  client_id: string;
  use_case_description: string;
  data_sources: string;
  expected_volume: 'low' | 'medium' | 'high';
  compliance_requirements: string;
  aicm_assessment_notes: string;
  recommended_archetype: string;
  escalation_tier: string;
}

export interface Client {
  id: string;
  org_name: string;
  billing_contact_email: string;
  entra_id_group: string;
  data_classification: string;
  status: 'active' | 'onboarding' | 'suspended' | 'archived';
  workspaces_count: number;
  query_count: number;
  document_count: number;
  last_active: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: string;
  client_id: string;
  use_case_description: string;
  data_sources: string;
  expected_volume: string;
  compliance_requirements: string;
  aicm_assessment_notes: string;
  recommended_archetype: string;
  escalation_tier: string;
  created_at: string;
}

export interface ProvisionRequest {
  client_id?: string;
  workspace_type: string;
  capacity_limit: number;
  model_id: string;
  escalation_tier: 'auto' | 'review' | 'human';
  chunking_strategy: 'default' | 'legislation' | 'case_law';
}

export interface ProvisionPlan {
  workspace_id: string;
  resources: Array<{ type: string; name: string; status: string }>;
  estimated_cost_monthly: number;
  status: 'pending' | 'provisioning' | 'ready';
}

export interface DecommissionPlan {
  workspace_id: string;
  members_to_remove: number;
  documents_to_delete: number;
  index_entries_to_purge: number;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  type: string;
  client_id: string;
  client_name: string;
  status: 'ready' | 'provisioning' | 'archived';
  health: 'green' | 'amber' | 'red';
  capacity_limit: number;
  document_count: number;
  model_id: string;
  escalation_tier: string;
  chunking_strategy: string;
  created_at: string;
  updated_at: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  deployment: string;
  capabilities: string[];
  classification_ceiling: string;
  active: boolean;
  parameter_overrides: Record<string, unknown>;
  access_grants: Array<{ type: 'workspace' | 'client'; id: string; name: string }>;
}

export interface PromptVersion {
  version: number;
  content: string;
  author: string;
  rationale: string;
  created_at: string;
  is_active: boolean;
}

export interface PromptInfo {
  name: string;
  display_name: string;
  current_version: number;
  versions: PromptVersion[];
}

export interface Booking {
  id: string;
  workspace_id: string;
  workspace_name: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Client / Onboarding
// ---------------------------------------------------------------------------

export async function onboardClient(data: ClientOnboardingData): Promise<Client> {
  return apiFetch<Client>('/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listClients(): Promise<Client[]> {
  return apiFetch<Client[]>('/clients');
}

export async function getClient(id: string): Promise<Client> {
  return apiFetch<Client>(`/clients/${encodeURIComponent(id)}`);
}

export async function submitInterview(data: InterviewData): Promise<Interview> {
  return apiFetch<Interview>('/interviews', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export async function listWorkspaces(): Promise<AdminWorkspace[]> {
  return apiFetch<AdminWorkspace[]>('/workspaces');
}

export async function provisionWorkspace(data: ProvisionRequest, dryRun = false): Promise<ProvisionPlan> {
  const query = dryRun ? '?dry_run=true' : '';
  return apiFetch<ProvisionPlan>(`/workspaces/provision${query}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function decommissionWorkspace(id: string, dryRun = false): Promise<DecommissionPlan> {
  const query = dryRun ? '?dry_run=true' : '';
  return apiFetch<DecommissionPlan>(`/workspaces/${encodeURIComponent(id)}/decommission${query}`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export async function listModels(): Promise<ModelConfig[]> {
  return apiFetch<ModelConfig[]>('/models');
}

export async function toggleModel(id: string, active: boolean): Promise<void> {
  await apiFetch<void>(`/models/${encodeURIComponent(id)}/toggle?is_active=${active}`, {
    method: 'POST',
  });
}

export async function updateModelOverrides(id: string, overrides: Record<string, unknown>): Promise<void> {
  await apiFetch<void>(`/models/${encodeURIComponent(id)}/overrides`, {
    method: 'PUT',
    body: JSON.stringify(overrides),
  });
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export async function listPrompts(): Promise<PromptInfo[]> {
  return apiFetch<PromptInfo[]>('/prompts');
}

export async function rollbackPrompt(name: string, version: number): Promise<void> {
  await apiFetch<void>(`/prompts/${encodeURIComponent(name)}/rollback?target_version=${version}`, {
    method: 'POST',
  });
}

export async function createPromptVersion(
  name: string,
  content: string,
  rationale: string,
): Promise<void> {
  await apiFetch<void>(`/prompts/${encodeURIComponent(name)}/versions`, {
    method: 'POST',
    body: JSON.stringify({ content, rationale }),
  });
}

// ---------------------------------------------------------------------------
// Bookings (admin-level)
// ---------------------------------------------------------------------------

export async function listAllBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>('/bookings');
}

export async function approveBooking(id: string): Promise<void> {
  await apiFetch<void>(`/bookings/${encodeURIComponent(id)}?action=approve`, {
    method: 'PATCH',
  });
}

export async function rejectBooking(id: string, _reason: string): Promise<void> {
  await apiFetch<void>(`/bookings/${encodeURIComponent(id)}?action=reject`, {
    method: 'PATCH',
  });
}
