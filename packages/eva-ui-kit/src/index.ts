// ---------------------------------------------------------------------------
// @eva/ui-kit — Public API
// ---------------------------------------------------------------------------

// Hooks
export { useAuth } from './hooks/use-auth';
export type { AuthState, UserContext } from './hooks/use-auth';

export { useNdjsonStream } from './hooks/use-ndjson-stream';
export type {
  UseNdjsonStreamOptions,
  UseNdjsonStreamReturn,
} from './hooks/use-ndjson-stream';

// Chat components
export { AgentStepTrace } from './components/chat/AgentStepTrace';
export type { AgentStepTraceProps } from './components/chat/AgentStepTrace';

export { ProvenanceBadge } from './components/chat/ProvenanceBadge';
export type { ProvenanceBadgeProps } from './components/chat/ProvenanceBadge';

export { CitationViewer } from './components/chat/CitationViewer';
export type { CitationViewerProps } from './components/chat/CitationViewer';

export { ChatInput } from './components/chat/ChatInput';
export type { ChatInputProps } from './components/chat/ChatInput';

export { ChatMessage } from './components/chat/ChatMessage';
export type { ChatMessageProps } from './components/chat/ChatMessage';

export { FeedbackCapture } from './components/chat/FeedbackCapture';
export type { FeedbackCaptureProps } from './components/chat/FeedbackCapture';
