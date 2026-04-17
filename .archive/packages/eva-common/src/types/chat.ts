// ---------------------------------------------------------------------------
// Chat Data Models
// TypeScript equivalents of services/api-gateway/app/models/chat.py
// ---------------------------------------------------------------------------

import type {
  AgentStep,
  Citation,
  ExplainabilityRecord,
  ProvenanceRecord,
} from './provenance';

export interface ChatMessage {
  /** Unique message identifier. */
  id: string;
  /** Conversation this message belongs to. */
  conversation_id: string;
  /** Workspace context (null for workspace-less conversations). */
  workspace_id: string | null;
  /** Message author. */
  role: 'user' | 'assistant';
  /** Message text content. */
  content: string;
  /** Source citations attached to this message. */
  citations: Citation[];
  /** Full provenance chain (assistant messages only). */
  provenance: ProvenanceRecord | null;
  /** Human-readable explanation of how the answer was produced. */
  explainability: ExplainabilityRecord | null;
  /** Agent execution steps shown during streaming. */
  agent_steps: AgentStep[];
  /** ISO timestamp. */
  created_at: string;
}

export interface ChatRequest {
  /** User's message text. */
  message: string;
  /** Workspace to scope retrieval to (null = global). */
  workspace_id: string | null;
  /** Existing conversation to continue (null = new conversation). */
  conversation_id: string | null;
  /** Grounded = RAG with citations; ungrounded = general assistant. */
  mode: 'grounded' | 'ungrounded';
  /** Optional parameter overrides. */
  overrides?: ChatOverrides;
}

export interface ChatOverrides {
  /** Number of sources to retrieve. */
  top_k?: number;
  /** LLM temperature. */
  temperature?: number;
  /** Target response length hint. */
  response_length?: number;
  /** Whether to suggest follow-up questions. */
  suggest_followup?: boolean;
}

// ---------------------------------------------------------------------------
// NDJSON stream event types
// ---------------------------------------------------------------------------

export interface TelemetryEvent {
  model?: string;
  tokens_prompt?: number;
  tokens_completion?: number;
  tokens_total?: number;
  latency_ms?: number;
  estimated_cost_cad?: number;
}

export type StreamEvent =
  | { provenance: { correlation_id: string; trace_id: string } }
  | { agent_step: AgentStep }
  | { content: string }
  | { provenance_complete: Partial<ProvenanceRecord> }
  | { explainability: ExplainabilityRecord }
  | { telemetry: TelemetryEvent }
  | { error: { code: string; message: string } };
