// ---------------------------------------------------------------------------
// ChatMessage — single chat message bubble (user or assistant)
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import type { ChatMessage as ChatMessageType, Citation, TelemetryEvent } from '@eva/common';
import { AgentStepTrace } from './AgentStepTrace';
import { ProvenanceBadge } from './ProvenanceBadge';
import { CitationViewer } from './CitationViewer';
import { FeedbackCapture } from './FeedbackCapture';
import { RequestDetailsDrawer } from './RequestDetailsDrawer';
import type { MessageTelemetry } from './RequestDetailsDrawer';

export interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  language: 'en' | 'fr';
  telemetry?: MessageTelemetry | null;
  onFeedback?: (signal: 'accept' | 'reject', correction?: string) => void;
  onCitationClick?: (citation: Citation) => void;
}

/**
 * Renders markdown-like content with inline citation superscripts.
 *
 * Recognises [^N] citation markers and converts them to clickable superscripts.
 * Renders basic markdown: **bold**, *italic*, `code`, and line breaks.
 */
function renderContent(
  content: string,
  onCitationClick?: (citation: Citation) => void,
  citations?: Citation[],
) {
  // Split on citation markers [^N]
  const parts = content.split(/(\[\^\d+\])/g);

  return parts.map((part, i) => {
    const citMatch = part.match(/^\[\^(\d+)\]$/);
    if (citMatch) {
      const citIndex = parseInt(citMatch[1], 10) - 1;
      const citation = citations?.[citIndex];
      return (
        <button
          key={i}
          type="button"
          onClick={() => citation && onCitationClick?.(citation)}
          className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold align-super ml-0.5 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={`Citation ${citMatch[1]}`}
        >
          {citMatch[1]}
        </button>
      );
    }

    // Basic inline markdown rendering
    return <MarkdownSpan key={i} text={part} />;
  });
}

function MarkdownSpan({ text }: { text: string }) {
  // Process **bold**, *italic*, `code`, and newlines
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\n)/g);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          return <strong key={i}>{seg.slice(2, -2)}</strong>;
        }
        if (seg.startsWith('*') && seg.endsWith('*')) {
          return <em key={i}>{seg.slice(1, -1)}</em>;
        }
        if (seg.startsWith('`') && seg.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono text-gray-800">
              {seg.slice(1, -1)}
            </code>
          );
        }
        if (seg === '\n') {
          return <br key={i} />;
        }
        return <span key={i}>{seg}</span>;
      })}
    </>
  );
}

export function ChatMessage({
  message,
  isStreaming = false,
  language,
  telemetry,
  onFeedback,
  onCitationClick,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const renderedContent = useMemo(
    () =>
      isAssistant
        ? renderContent(message.content, onCitationClick, message.citations)
        : null,
    [isAssistant, message.content, message.citations, onCitationClick],
  );

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      role="article"
      aria-label={`${message.role === 'user' ? 'You' : 'EVA'}`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] ${
          isUser
            ? 'rounded-2xl rounded-br-md bg-blue-700 px-4 py-3 text-white'
            : 'rounded-2xl rounded-bl-md bg-white border border-gray-200 px-4 py-3 text-gray-900 shadow-sm'
        }`}
      >
        {/* Message content */}
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed">
            <div className="prose prose-sm max-w-none">
              {renderedContent}
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 animate-pulse rounded-sm" aria-hidden="true" />
              )}
            </div>

            {/* Agent step trace */}
            {message.agent_steps.length > 0 && (
              <AgentStepTrace
                steps={message.agent_steps}
                isStreaming={isStreaming}
                language={language}
              />
            )}

            {/* Citations */}
            {message.citations.length > 0 && !isStreaming && (
              <CitationViewer
                citations={message.citations}
                onCitationClick={onCitationClick}
              />
            )}

            {/* Provenance badge */}
            {message.provenance && (
              <ProvenanceBadge
                provenance={message.provenance}
                isStreaming={isStreaming}
              />
            )}

            {/* Feedback */}
            {!isStreaming && onFeedback && (
              <FeedbackCapture onFeedback={onFeedback} />
            )}

            {/* Request details drawer */}
            {!isStreaming && (message.provenance || telemetry) && (
              <RequestDetailsDrawer
                provenance={message.provenance}
                telemetry={telemetry}
                workspaceId={message.workspace_id}
                language={language}
              />
            )}
          </div>
        )}

        {/* Timestamp */}
        <time
          dateTime={message.created_at}
          className={`block mt-1.5 text-[10px] ${isUser ? 'text-blue-200' : 'text-gray-400'}`}
        >
          {new Date(message.created_at).toLocaleTimeString(language === 'fr' ? 'fr-CA' : 'en-CA', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
    </div>
  );
}
