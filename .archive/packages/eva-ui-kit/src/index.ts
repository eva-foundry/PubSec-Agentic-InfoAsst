// ---------------------------------------------------------------------------
// @eva/ui-kit — Public API
// ---------------------------------------------------------------------------

// Hooks
export { useAuth } from './hooks/use-auth';
export type { AuthState, UserContext } from './hooks/use-auth';

export { useI18n } from './hooks/use-i18n';
export type { UseI18nReturn } from './hooks/use-i18n';

export { useNdjsonStream } from './hooks/use-ndjson-stream';
export type {
  UseNdjsonStreamOptions,
  UseNdjsonStreamReturn,
} from './hooks/use-ndjson-stream';

export { useReducedMotion } from './hooks/use-reduced-motion';
export { useFocusOnMount, useReturnFocus } from './hooks/use-focus-management';

// Accessibility components
export { SkipLink } from './components/a11y/SkipLink';
export { LiveRegion } from './components/a11y/LiveRegion';
export { FocusTrap } from './components/a11y/FocusTrap';

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

export { RequestDetailsDrawer } from './components/chat/RequestDetailsDrawer';
export type { RequestDetailsDrawerProps, MessageTelemetry } from './components/chat/RequestDetailsDrawer';

export { ConversationSidebar } from './components/chat/ConversationSidebar';
export type { ConversationSidebarProps, ConversationSummary } from './components/chat/ConversationSidebar';

export { WorkspaceHealthBadge } from './components/chat/WorkspaceHealthBadge';
export type { WorkspaceHealthBadgeProps } from './components/chat/WorkspaceHealthBadge';

export { CompareView } from './components/chat/CompareView';
export type { CompareViewProps, CompareResult } from './components/chat/CompareView';

export { DocumentViewer } from './components/chat/DocumentViewer';
export type { DocumentViewerProps, DocumentContent } from './components/chat/DocumentViewer';

// Layout components
export { CostTicker } from './components/layout/CostTicker';
export type { CostTickerProps } from './components/layout/CostTicker';

export { ToastProvider, useToast } from './components/layout/Toast';
export type { ToastMessage } from './components/layout/Toast';

export { Skeleton, SkeletonText, SkeletonCard } from './components/layout/Skeleton';
export type { SkeletonProps, SkeletonTextProps } from './components/layout/Skeleton';

export { DegradationBanner } from './components/layout/DegradationBanner';
export type { DegradationBannerProps, DegradationLevel } from './components/layout/DegradationBanner';
