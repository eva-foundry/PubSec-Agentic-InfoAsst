// ---------------------------------------------------------------------------
// Portal 1 API client — typed fetch wrappers for EVA backend
// ---------------------------------------------------------------------------

import type { Workspace, Booking, TeamMember } from '@eva/common';

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
// Workspace & Chat
// ---------------------------------------------------------------------------

/** Fetch workspaces the current user has access to. */
export async function fetchWorkspaces(): Promise<Workspace[]> {
  return apiFetch<Workspace[]>('/workspaces');
}

/** Submit accept/reject feedback for a conversation message. */
export async function submitFeedback(
  conversationId: string,
  signal: 'accept' | 'reject',
  correction?: string,
): Promise<void> {
  await apiFetch<void>(`/conversations/${conversationId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ signal, correction }),
  });
}

/** Fetch conversation history. */
export async function fetchConversations(
  workspaceId?: string,
): Promise<{ id: string; title: string; created_at: string }[]> {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : '';
  return apiFetch(`/conversations${query}`);
}

/** The chat endpoint URL (used by the NDJSON stream hook, not this client). */
export const CHAT_API_URL = `${API_BASE}/chat`;

// ---------------------------------------------------------------------------
// Document Upload & Status
// ---------------------------------------------------------------------------

export interface StatusFilters {
  timeRange?: '4h' | '12h' | '24h' | '7d' | '30d';
  status?: 'all' | 'processing' | 'complete' | 'error';
  workspaceId?: string;
}

export interface DocumentStatusRecord {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  state: string;
  workspace_id: string;
  uploaded_by: string;
  uploaded_at: string;
  processed_at: string | null;
  error_message: string | null;
  status_history: Array<{
    timestamp: string;
    state: string;
    message: string;
  }>;
}

/**
 * Upload files to a workspace via multipart FormData.
 * POST /v1/eva/documents/upload
 *
 * Uses XMLHttpRequest for upload progress tracking.
 */
export async function uploadDocuments(
  workspaceId: string,
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<void> {
  const formData = new FormData();
  formData.append('workspace_id', workspaceId);
  for (const file of files) {
    formData.append('files', file);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/documents/upload`);

    const token = localStorage.getItem(AUTH_STORAGE_KEY);
    if (token) {
      try {
        const user = JSON.parse(token);
        xhr.setRequestHeader('x-demo-user-email', user.email);
      } catch {
        // noop
      }
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.send(formData);
  });
}

/**
 * Upload a single document to a workspace's knowledge base (legacy).
 */
export async function uploadDocument(workspaceId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/documents`, {
    method: 'POST',
    body: formData,
    headers: { ...getAuthHeaders() },
    // No Content-Type header -- browser sets multipart boundary
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Upload failed: ${detail}`);
  }
}

/**
 * Fetch document statuses for a workspace.
 * GET /v1/eva/documents/status
 */
export async function getDocumentStatuses(
  workspaceId: string,
  filters?: StatusFilters,
): Promise<DocumentStatusRecord[]> {
  const params = new URLSearchParams({ workspace_id: workspaceId });

  if (filters?.timeRange) params.set('time_range', filters.timeRange);
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);

  const res = await fetch(`${API_BASE}/documents/status?${params.toString()}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch statuses: ${res.status}`);
  }
  return res.json();
}

/**
 * Delete a document and its index entries.
 * DELETE /v1/eva/documents/:id
 */
export async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(`Delete failed: ${res.status}`);
  }
}

/**
 * Resubmit a failed document for reprocessing.
 * POST /v1/eva/documents/:id/resubmit
 */
export async function resubmitDocument(docId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(docId)}/resubmit`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(`Resubmit failed: ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Workspace Catalog
// ---------------------------------------------------------------------------

/** Catalog workspace representation with display-specific fields. */
export interface CatalogWorkspace {
  id: string;
  name: string;
  name_fr: string;
  description: string;
  description_fr: string;
  type: string;
  features: string[];
  features_fr: string[];
  capacity: number;
  pricePerWeek: number;
  data_classification: string;
}

/** Fetch workspace catalog for browsing and booking. */
export async function fetchWorkspaceCatalog(): Promise<CatalogWorkspace[]> {
  return apiFetch<CatalogWorkspace[]>('/workspaces');
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export interface CreateBookingRequest {
  workspace_id: string;
  start_date: string;
  end_date: string;
}

/** Create a new workspace booking. */
export async function createBooking(data: CreateBookingRequest): Promise<Booking> {
  return apiFetch<Booking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Fetch all bookings for the current user. */
export async function getBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>('/bookings');
}

/** Update a booking's fields. */
export async function updateBooking(id: string, updates: Partial<Booking>): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** Cancel a booking. */
export async function cancelBooking(id: string): Promise<void> {
  await apiFetch<void>(`/bookings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Team Members
// ---------------------------------------------------------------------------

/** Fetch team members for a booking. */
export async function getTeamMembers(bookingId: string): Promise<TeamMember[]> {
  return apiFetch<TeamMember[]>(`/bookings/${encodeURIComponent(bookingId)}/team`);
}

/** Add a team member to a booking. */
export async function addTeamMember(
  bookingId: string,
  member: { name: string; email: string; role: string },
): Promise<TeamMember> {
  return apiFetch<TeamMember>(`/bookings/${encodeURIComponent(bookingId)}/team`, {
    method: 'POST',
    body: JSON.stringify(member),
  });
}

/** Remove a team member from a booking. */
export async function removeTeamMember(bookingId: string, userId: string): Promise<void> {
  await apiFetch<void>(
    `/bookings/${encodeURIComponent(bookingId)}/team/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}

// ---------------------------------------------------------------------------
// Surveys
// ---------------------------------------------------------------------------

export interface EntrySurveyPayload {
  booking_id: string;
  use_case: string;
  expected_benefits: string;
  target_metrics: string;
  team_size: number;
  document_types: string[];
  ai_features: string[];
  data_classification: string;
}

export interface ExitSurveyPayload {
  booking_id: string;
  actual_results: string;
  goals_achieved: 'yes' | 'partial' | 'no';
  lessons_learned: string;
  blockers?: string;
  suggestions?: string;
  rating: number;
  department: string;
  cost_center: string;
  approver_name: string;
  approver_email: string;
}

/** Submit an entry survey for a booking. */
export async function submitEntrySurvey(data: EntrySurveyPayload): Promise<void> {
  await apiFetch<void>('/surveys/entry', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Submit an exit survey for a booking. */
export async function submitExitSurvey(data: ExitSurveyPayload): Promise<void> {
  await apiFetch<void>('/surveys/exit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
