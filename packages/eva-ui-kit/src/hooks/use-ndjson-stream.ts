// ---------------------------------------------------------------------------
// useNdjsonStream — React hook for consuming NDJSON streams from the chat API
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from 'react';
import type {
  AgentStep,
  ChatRequest,
  ExplainabilityRecord,
  ProvenanceRecord,
  StreamEvent,
  TelemetryEvent,
} from '@eva/common';

export interface UseNdjsonStreamOptions {
  onStep?: (step: AgentStep) => void;
  onContent?: (content: string) => void;
  onProvenance?: (provenance: Partial<ProvenanceRecord>) => void;
  onExplainability?: (record: ExplainabilityRecord) => void;
  onTelemetry?: (telemetry: TelemetryEvent) => void;
  onError?: (error: { code: string; message: string }) => void;
}

export interface UseNdjsonStreamReturn {
  send: (request: ChatRequest) => Promise<void>;
  cancel: () => void;
  isStreaming: boolean;
  content: string;
  steps: AgentStep[];
  provenance: Partial<ProvenanceRecord> | null;
  telemetry: TelemetryEvent | null;
  error: string | null;
}

/**
 * Consumes an NDJSON stream from POST /v1/eva/chat.
 *
 * Each line is a JSON object matching the StreamEvent union.  The hook
 * accumulates content, tracks agent steps, and surfaces provenance once the
 * stream completes.
 */
export function useNdjsonStream(
  apiUrl: string,
  options?: UseNdjsonStreamOptions,
): UseNdjsonStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [content, setContent] = useState('');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [provenance, setProvenance] = useState<Partial<ProvenanceRecord> | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (request: ChatRequest) => {
      // Cancel any in-flight request
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      // Reset state for new request
      setContent('');
      setSteps([]);
      setProvenance(null);
      setTelemetry(null);
      setError(null);
      setIsStreaming(true);

      try {
        // Read auth user from localStorage for demo auth header
        const authHeaders: Record<string, string> = {};
        try {
          const raw = localStorage.getItem('eva-auth-user');
          if (raw) {
            const user = JSON.parse(raw);
            if (user.email) authHeaders['x-demo-user-email'] = user.email;
          }
        } catch {
          // noop
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => response.statusText);
          const errMsg = `HTTP ${response.status}: ${detail}`;
          setError(errMsg);
          optionsRef.current?.onError?.({ code: `HTTP_${response.status}`, message: errMsg });
          setIsStreaming(false);
          return;
        }

        if (!response.body) {
          setError('Response body is null — streaming not supported.');
          setIsStreaming(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(trimmed) as StreamEvent;
            } catch {
              // Malformed line — skip
              continue;
            }

            dispatch(event);
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim()) as StreamEvent;
            dispatch(event);
          } catch {
            // Incomplete final line — ignore
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Cancelled by user — not an error
          return;
        }
        const msg = err instanceof Error ? err.message : 'Unknown stream error';
        setError(msg);
        optionsRef.current?.onError?.({ code: 'STREAM_ERROR', message: msg });
      } finally {
        setIsStreaming(false);
      }
    },
    [apiUrl],
  );

  function dispatch(event: StreamEvent) {
    if ('agent_step' in event) {
      const step = event.agent_step;
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.id === step.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = step;
          return next;
        }
        return [...prev, step];
      });
      optionsRef.current?.onStep?.(step);
    } else if ('content' in event) {
      setContent((prev) => prev + event.content);
      optionsRef.current?.onContent?.(event.content);
    } else if ('provenance_complete' in event) {
      setProvenance(event.provenance_complete);
      optionsRef.current?.onProvenance?.(event.provenance_complete);
    } else if ('explainability' in event) {
      optionsRef.current?.onExplainability?.(event.explainability);
    } else if ('telemetry' in event) {
      setTelemetry(event.telemetry);
      optionsRef.current?.onTelemetry?.(event.telemetry);
    } else if ('error' in event) {
      setError(event.error.message);
      optionsRef.current?.onError?.(event.error);
    }
    // 'provenance' (initial trace header) is informational — no state update needed
  }

  return { send, cancel, isStreaming, content, steps, provenance, telemetry, error };
}
