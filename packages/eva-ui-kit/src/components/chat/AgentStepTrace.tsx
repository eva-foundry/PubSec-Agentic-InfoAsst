// ---------------------------------------------------------------------------
// AgentStepTrace — animated vertical timeline of agent execution steps
// ---------------------------------------------------------------------------

import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { AgentStep } from '@eva/common';

export interface AgentStepTraceProps {
  steps: AgentStep[];
  isStreaming: boolean;
  language: 'en' | 'fr';
}

const i18n = {
  en: {
    agentSteps: 'Agent steps',
    showSteps: 'Show agent steps',
    hideSteps: 'Hide agent steps',
    running: 'Running',
    complete: 'Complete',
    error: 'Error',
    duration: 'Duration',
  },
  fr: {
    agentSteps: "Etapes de l'agent",
    showSteps: "Afficher les etapes de l'agent",
    hideSteps: "Masquer les etapes de l'agent",
    running: 'En cours',
    complete: 'Termine',
    error: 'Erreur',
    duration: 'Duree',
  },
} as const;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StepIcon({ status }: { status: AgentStep['status'] }) {
  if (status === 'running') {
    return (
      <svg
        className="h-5 w-5 animate-spin text-blue-600"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="47"
          strokeDashoffset="15"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (status === 'complete') {
    return (
      <svg
        className="h-5 w-5 text-green-600"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path
          d="M8 12l2.5 2.5L16 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // error
  return (
    <svg
      className="h-5 w-5 text-red-600"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M15 9l-6 6M9 9l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MetadataSummary({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return null;

  const entries = Object.entries(metadata).filter(
    ([, v]) => v !== null && v !== undefined,
  );
  if (entries.length === 0) return null;

  return (
    <span className="ml-2 text-xs text-gray-500">
      {entries.map(([k, v], i) => (
        <span key={k}>
          {i > 0 && ' · '}
          {String(v)} {k.replace(/_/g, ' ')}
        </span>
      ))}
    </span>
  );
}

export function AgentStepTrace({ steps, isStreaming, language }: AgentStepTraceProps) {
  const t = i18n[language];
  const [collapsed, setCollapsed] = useState(false);
  const regionId = useId();
  const prefersReduced = useReducedMotion();

  if (steps.length === 0) return null;

  const variants = prefersReduced
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
      };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded"
        aria-expanded={!collapsed}
        aria-controls={regionId}
        aria-label={collapsed ? t.showSteps : t.hideSteps}
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        {t.agentSteps} ({steps.length})
      </button>

      {!collapsed && (
        <div
          id={regionId}
          role="log"
          aria-live="polite"
          aria-label={t.agentSteps}
          className="mt-2 border-l-2 border-gray-200 pl-4 space-y-1"
        >
          <AnimatePresence initial={false}>
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ delay: prefersReduced ? 0 : index * 0.05, duration: 0.2 }}
                className="flex items-start gap-2 py-1"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <StepIcon status={step.status} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-gray-800">
                    {language === 'fr' ? step.label_fr : step.label_en}
                  </span>
                  {step.status === 'complete' && step.duration_ms != null && (
                    <span className="ml-2 text-xs text-gray-400">
                      {formatDuration(step.duration_ms)}
                    </span>
                  )}
                  <MetadataSummary metadata={step.metadata} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isStreaming && steps.every((s) => s.status === 'complete') && (
            <div className="flex items-center gap-2 py-1 text-xs text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              {language === 'fr' ? 'En attente...' : 'Waiting...'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
