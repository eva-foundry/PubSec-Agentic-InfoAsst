// ---------------------------------------------------------------------------
// ChatPage — the main Portal 1 customer-facing chat experience
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ChatMessage as ChatMessageType, Citation, TelemetryEvent, Workspace } from '@eva/common';
import { useAuth } from '@eva/ui-kit';
import {
  ChatInput,
  ChatMessage,
  ConversationSidebar,
  WorkspaceHealthBadge,
  useNdjsonStream,
  useToast,
} from '@eva/ui-kit';
import type { ConversationSummary, MessageTelemetry } from '@eva/ui-kit';
import { CHAT_API_URL, fetchWorkspaces, fetchConversations, getConversation, submitFeedback } from '../api/client';

type Lang = 'en' | 'fr';
type ChatMode = 'grounded' | 'ungrounded';

const i18n = {
  en: {
    title: 'EVA Assistant',
    subtitle: 'Government of Canada',
    selectWorkspace: 'Select a workspace',
    noWorkspace: 'No workspace (general)',
    grounded: 'Grounded',
    ungrounded: 'Ungrounded',
    groundedDesc: 'Answers with citations from workspace documents',
    ungroundedDesc: 'General assistant mode',
    placeholder: 'Ask EVA a question...',
    emptyTitle: 'How can I help you today?',
    emptySubtitle: 'Ask a question about your workspace documents or get general assistance.',
    example1: 'Summarize the key findings from the latest report',
    example2: 'What are the eligibility criteria for this program?',
    example3: 'Explain the approval process step by step',
    streaming: 'EVA is thinking...',
    errorTitle: 'Something went wrong',
    signIn: 'Sign in to continue',
    language: 'Langue',
    skipToChat: 'Skip to chat',
  },
  fr: {
    title: 'Assistant EVA',
    subtitle: 'Gouvernement du Canada',
    selectWorkspace: 'Choisir un espace de travail',
    noWorkspace: "Aucun espace (general)",
    grounded: 'Ancre',
    ungrounded: 'Non ancre',
    groundedDesc: "Reponses avec citations des documents de l'espace",
    ungroundedDesc: 'Mode assistant general',
    placeholder: 'Posez une question a EVA...',
    emptyTitle: 'Comment puis-je vous aider?',
    emptySubtitle: "Posez une question sur les documents de votre espace ou obtenez de l'aide generale.",
    example1: 'Resumez les conclusions cles du dernier rapport',
    example2: "Quels sont les criteres d'admissibilite a ce programme?",
    example3: "Expliquez le processus d'approbation etape par etape",
    streaming: 'EVA reflechit...',
    errorTitle: 'Une erreur est survenue',
    signIn: 'Connectez-vous pour continuer',
    language: 'Language',
    skipToChat: 'Aller au chat',
  },
} as const;

export default function ChatPage() {
  // ---- Auth ----
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // ---- UI state ----
  const lang: Lang = (user?.language as Lang) ?? 'en';
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('grounded');
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Conversation sidebar state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Telemetry per message (keyed by message id)
  const [telemetryMap, setTelemetryMap] = useState<Record<string, MessageTelemetry>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRegionId = useId();
  const workspaceLabelId = useId();
  const modeLabelId = useId();
  const t = i18n[lang];

  // ---- NDJSON stream ----
  const {
    send,
    cancel: _cancel,
    isStreaming,
    content: streamContent,
    steps: streamSteps,
    provenance: streamProvenance,
    telemetry: streamTelemetry,
    error: streamError,
  } = useNdjsonStream(CHAT_API_URL, {
    onError: (err) => {
      console.error('[ChatPage] Stream error:', err);
    },
  });

  // ---- Load workspaces ----
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchWorkspaces()
      .then((ws) => {
        // Filter by user workspace grants if available
        const granted = user?.workspace_grants ?? [];
        const filtered = granted.length > 0
          ? ws.filter((w) => granted.includes(w.id))
          : ws;
        setWorkspaces(filtered);
      })
      .catch((err) => console.error('[ChatPage] Failed to fetch workspaces:', err));
  }, [isAuthenticated, user?.workspace_grants]);

  // ---- Load conversations for sidebar ----
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchConversations()
      .then((convs) => {
        setConversations(
          convs.map((c) => ({
            id: c.id,
            title: c.title,
            created_at: c.created_at,
            workspace_id: c.workspace_id ?? null,
            workspace_name: c.workspace_name,
            confidence: c.confidence ?? null,
          })),
        );
      })
      .catch((err) => console.error('[ChatPage] Failed to fetch conversations:', err));
  }, [isAuthenticated]);

  // ---- Load a conversation from sidebar ----
  const handleSelectConversation = useCallback(
    async (id: string) => {
      try {
        const data = await getConversation(id);
        setMessages(data.messages);
        setConversationId(id);
      } catch (err) {
        console.error('[ChatPage] Failed to load conversation:', err);
      }
    },
    [],
  );

  // ---- New Chat from sidebar ----
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  // ---- Scroll to bottom when messages change ----
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent, streamSteps]);

  // ---- Build streaming assistant message ----
  const streamingMessage: ChatMessageType | null = isStreaming || streamContent
    ? {
        id: '__streaming__',
        conversation_id: conversationId ?? '',
        workspace_id: selectedWorkspaceId,
        role: 'assistant',
        content: streamContent,
        citations: [],
        provenance: streamProvenance as ChatMessageType['provenance'],
        explainability: null,
        agent_steps: streamSteps,
        created_at: new Date().toISOString(),
      }
    : null;

  // ---- Send message ----
  const handleSend = useCallback(
    async (text: string, _files?: File[]) => {
      // Add user message to list
      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        conversation_id: conversationId ?? '',
        workspace_id: selectedWorkspaceId,
        role: 'user',
        content: text,
        citations: [],
        provenance: null,
        explainability: null,
        agent_steps: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        await send({
          message: text,
          workspace_id: selectedWorkspaceId,
          conversation_id: conversationId,
          mode: chatMode,
        });
      } catch {
        // Error already handled by the hook
      }
    },
    [conversationId, selectedWorkspaceId, chatMode, send],
  );

  // ---- When streaming completes, persist the assistant message ----
  useEffect(() => {
    if (!isStreaming && streamContent && streamingMessage) {
      const msgId = crypto.randomUUID();
      const finalMsg: ChatMessageType = {
        ...streamingMessage,
        id: msgId,
      };
      setMessages((prev) => [...prev, finalMsg]);

      // Store telemetry for this message
      if (streamTelemetry) {
        setTelemetryMap((prev) => ({ ...prev, [msgId]: streamTelemetry }));
      }

      // Set conversation ID from first response if we don't have one yet
      if (!conversationId && finalMsg.provenance?.correlation_id) {
        const newConvId = finalMsg.provenance.correlation_id;
        setConversationId(newConvId);
        // Add to sidebar conversations
        setConversations((prev) => [
          {
            id: newConvId,
            title: messages.length > 0 ? messages[0].content : finalMsg.content,
            created_at: finalMsg.created_at,
            workspace_id: selectedWorkspaceId,
            confidence: finalMsg.provenance?.confidence ?? null,
          },
          ...prev,
        ]);
      }
    }
    // Only trigger when streaming stops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // ---- Feedback ----
  const handleFeedback = useCallback(
    (signal: 'accept' | 'reject', correction?: string) => {
      if (conversationId) {
        submitFeedback(conversationId, signal, correction)
          .then(() => {
            toast.success(lang === 'fr' ? 'Commentaire enregistre' : 'Feedback recorded');
          })
          .catch((err) => {
            console.error('[ChatPage] Feedback error:', err);
            toast.error(lang === 'fr' ? "Erreur lors de l'envoi" : 'Failed to submit feedback');
          });
      }
    },
    [conversationId, lang, toast],
  );

  // ---- Citation click ----
  const handleCitationClick = useCallback((citation: Citation) => {
    if (citation.sas_url) {
      window.open(citation.sas_url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // ---- Example question click ----
  const handleExampleClick = useCallback(
    (question: string) => {
      handleSend(question);
    },
    [handleSend],
  );

  // ---- Selected workspace details (for health badge) ----
  const selectedWorkspace = workspaces.find((ws) => ws.id === selectedWorkspaceId);

  // ---- Render ----
  return (
    <div className="flex" style={{ height: 'calc(100vh - 57px)' }}>
      {/* ---- Conversation Sidebar ---- */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={conversationId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        language={lang}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      {/* ---- Main chat column ---- */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* ---- Chat toolbar ---- */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
            <div className="flex items-center gap-4">
              {/* Workspace selector */}
              <div>
                <label id={workspaceLabelId} className="sr-only">
                  {t.selectWorkspace}
                </label>
                <select
                  aria-labelledby={workspaceLabelId}
                  value={selectedWorkspaceId ?? ''}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value || null)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">{t.noWorkspace}</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {lang === 'fr' ? ws.name_fr : ws.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chat mode toggle */}
              <div role="radiogroup" aria-labelledby={modeLabelId} className="flex rounded-lg border border-gray-300 overflow-hidden">
                <span id={modeLabelId} className="sr-only">Chat mode</span>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chatMode === 'grounded'}
                  onClick={() => setChatMode('grounded')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    chatMode === 'grounded'
                      ? 'bg-blue-700 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  title={t.groundedDesc}
                >
                  {t.grounded}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chatMode === 'ungrounded'}
                  onClick={() => setChatMode('ungrounded')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 ${
                    chatMode === 'ungrounded'
                      ? 'bg-blue-700 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  title={t.ungroundedDesc}
                >
                  {t.ungrounded}
                </button>
              </div>
            </div>
          </div>

          {/* Workspace health badge */}
          {selectedWorkspace && (
            <div className="mx-auto max-w-5xl px-4 pb-2">
              <WorkspaceHealthBadge
                documentCount={(selectedWorkspace as Workspace & { document_count?: number }).document_count ?? 0}
                lastRefreshed={(selectedWorkspace as Workspace & { last_refreshed?: string }).last_refreshed ?? new Date().toISOString()}
                freshnessStatus="good"
                language={lang}
              />
            </div>
          )}
        </div>

        {/* ---- Chat area ---- */}
        <div
          id={chatRegionId}
          className="flex-1 overflow-y-auto"
          role="log"
          aria-live="polite"
          aria-label={t.title}
        >
          <div className="mx-auto max-w-3xl px-4 py-6">
            {/* Empty state */}
            {messages.length === 0 && !streamingMessage && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{t.emptyTitle}</h2>
                <p className="text-sm text-gray-500 mb-8 max-w-md">{t.emptySubtitle}</p>

                <div className="grid gap-3 sm:grid-cols-3 w-full max-w-xl">
                  {[t.example1, t.example2, t.example3].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => handleExampleClick(example)}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                language={lang}
                telemetry={telemetryMap[msg.id] ?? null}
                onFeedback={msg.role === 'assistant' ? handleFeedback : undefined}
                onCitationClick={handleCitationClick}
              />
            ))}

            {/* Streaming message */}
            {streamingMessage && (
              <ChatMessage
                message={streamingMessage}
                isStreaming={isStreaming}
                language={lang}
                telemetry={streamTelemetry}
                onCitationClick={handleCitationClick}
              />
            )}

            {/* Error display */}
            {streamError && !isStreaming && (
              <div className="mx-auto my-4 max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                <p className="font-medium">{t.errorTitle}</p>
                <p className="mt-1 text-xs text-red-600">{streamError}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ---- Input ---- */}
        <div className="flex-shrink-0 mx-auto w-full max-w-3xl">
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming || !isAuthenticated}
            placeholder={isAuthenticated ? t.placeholder : t.signIn}
          />
        </div>
      </div>
    </div>
  );
}
