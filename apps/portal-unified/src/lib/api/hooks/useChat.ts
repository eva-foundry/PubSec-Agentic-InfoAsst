import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type { ChatMessage, ChatRequest, SessionCost } from "@/lib/api/types";
import { qk } from "@/lib/api/keys";

export interface ConversationSummary {
  id: string;
  workspace_id: string | null;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface FeedbackSignal {
  conversation_id: string;
  message_id: string;
  signal: "accept" | "reject";
  correction_text?: string;
  reason?: string;
}

export const useConversations = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.chat.conversations(),
    queryFn: () => client.get<ConversationSummary[]>("/v1/eva/conversations"),
  });
};

export const useConversation = (conversationId: string | null) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.chat.conversation(conversationId ?? "__none__"),
    queryFn: () => client.get<{ conversation: ConversationSummary; messages: ChatMessage[] }>(
      `/v1/eva/conversations/${conversationId}`,
    ),
    enabled: !!conversationId,
  });
};

// Backend reads the eva_session_id cookie set by APIMSimulationMiddleware;
// no query parameter. credentials: "include" on the client forwards it.
export const useSessionCost = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.chat.sessionCost(),
    queryFn: () => client.get<SessionCost>("/v1/eva/session/cost"),
  });
};

export const useSubmitFeedback = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FeedbackSignal) => client.post<{ id: string }>("/v1/eva/chat/feedback", body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.chat.conversation(vars.conversation_id) });
    },
  });
};

export interface CompareRequest {
  message: string;
  workspace_id?: string | null;
  model_ids: string[];
}

export const useCompareChat = () => {
  const client = useApiClient();
  return useMutation({
    mutationFn: (body: CompareRequest) =>
      client.post<{ results: Array<{ model_id: string; answer: string; latency_ms: number }> }>(
        "/v1/eva/chat/compare",
        body,
      ),
  });
};

/**
 * streamChat — imperative helper for components that need an async iterable
 * of ChatEvents. Usage:
 *   const client = useApiClient();
 *   for await (const ev of client.streamChat(req, { signal })) { ... }
 * Exposed here as a hook-shaped helper for symmetry, but no React Query —
 * streaming state is component-local.
 */
export const useStreamChat = () => {
  const client = useApiClient();
  return (req: ChatRequest, opts?: { signal?: AbortSignal }) => client.streamChat(req, opts);
};
