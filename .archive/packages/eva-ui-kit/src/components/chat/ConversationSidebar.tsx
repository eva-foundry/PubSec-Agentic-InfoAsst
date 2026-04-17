// ---------------------------------------------------------------------------
// ConversationSidebar — past conversations list with new-chat action
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  workspace_id?: string | null;
  workspace_name?: string;
  workspace_color?: string;
  confidence?: number | null;
}

export interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  language: 'en' | 'fr';
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ---------------------------------------------------------------------------
// Bilingual labels
// ---------------------------------------------------------------------------

const L = {
  en: {
    newChat: 'New Chat',
    conversations: 'Conversations',
    empty: 'No conversations yet',
    collapse: 'Collapse sidebar',
    expand: 'Expand sidebar',
  },
  fr: {
    newChat: 'Nouveau clavardage',
    conversations: 'Conversations',
    empty: 'Aucune conversation',
    collapse: 'Reduire le panneau',
    expand: 'Ouvrir le panneau',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function relativeDate(iso: string, language: 'en' | 'fr'): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return language === 'fr' ? "a l'instant" : 'just now';
  if (diffMin < 60) return `${diffMin}m ${language === 'fr' ? 'il y a' : 'ago'}`;
  if (diffHr < 24) return `${diffHr}h ${language === 'fr' ? 'il y a' : 'ago'}`;
  if (diffDay === 1) return language === 'fr' ? 'hier' : 'yesterday';
  if (diffDay < 7) return `${diffDay}d ${language === 'fr' ? 'il y a' : 'ago'}`;

  return new Date(iso).toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

function confidenceColor(confidence: number | null | undefined): string {
  if (confidence == null) return 'bg-gray-300';
  if (confidence >= 0.7) return 'bg-green-500';
  if (confidence >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
  language,
  collapsed = false,
  onToggleCollapse,
}: ConversationSidebarProps) {
  const t = L[language];
  const prefersReduced = useReducedMotion();

  const sorted = useMemo(
    () =>
      [...conversations].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [conversations],
  );

  // Collapsed state (mobile toggle)
  if (collapsed) {
    return (
      <div className="flex-shrink-0 border-r border-gray-200 bg-white">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-full w-10 items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={t.expand}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <aside
      className="flex w-[280px] flex-shrink-0 flex-col border-r border-gray-200 bg-white"
      aria-label={t.conversations}
    >
      {/* Header with new chat + collapse */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-2 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t.newChat}
        </button>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={t.collapse}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Divider label */}
      <div className="px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {t.conversations}
        </span>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto" role="listbox" aria-label={t.conversations}>
        {sorted.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-gray-400">{t.empty}</p>
        )}

        <AnimatePresence initial={false}>
          {sorted.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <motion.button
                key={conv.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(conv.id)}
                initial={prefersReduced ? false : { opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: 0.15 }}
                className={`group flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'border-l-2 border-blue-600 bg-blue-50'
                    : 'border-l-2 border-transparent hover:bg-gray-50'
                }`}
              >
                {/* Title */}
                <span className={`text-sm leading-snug ${isActive ? 'font-medium text-blue-900' : 'text-gray-800'}`}>
                  {truncate(conv.title, 40)}
                </span>

                {/* Meta row */}
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  {/* Date */}
                  <time dateTime={conv.created_at}>{relativeDate(conv.created_at, language)}</time>

                  {/* Workspace badge */}
                  {conv.workspace_name && (
                    <>
                      <span aria-hidden="true" className="text-gray-300">|</span>
                      <span className="flex items-center gap-1">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${conv.workspace_color ?? 'bg-gray-400'}`}
                          aria-hidden="true"
                        />
                        <span className="truncate max-w-[80px]">{conv.workspace_name}</span>
                      </span>
                    </>
                  )}

                  {/* Confidence dot */}
                  <span
                    className={`ml-auto inline-block h-1.5 w-1.5 rounded-full ${confidenceColor(conv.confidence)}`}
                    aria-label={`confidence: ${conv.confidence != null ? (conv.confidence * 100).toFixed(0) + '%' : 'unknown'}`}
                  />
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </aside>
  );
}
