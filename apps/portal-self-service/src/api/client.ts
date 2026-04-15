// ---------------------------------------------------------------------------
// Portal 1 API client — typed fetch wrappers for EVA backend
// ---------------------------------------------------------------------------

import type { Workspace } from '@eva/common';

const API_BASE = '/v1/eva';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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

    const token = localStorage.getItem('eva-auth-user');
    if (token) {
      try {
        const user = JSON.parse(token);
        xhr.setRequestHeader('x-user-id', user.user_id);
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

  const res = await fetch(`${API_BASE}/documents/status?${params.toString()}`);
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
  });
  if (!res.ok) {
    throw new Error(`Resubmit failed: ${res.status}`);
  }
}
