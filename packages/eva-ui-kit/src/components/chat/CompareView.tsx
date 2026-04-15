// ---------------------------------------------------------------------------
// CompareView -- split-pane comparison of grounded vs ungrounded answers
// ---------------------------------------------------------------------------

import { motion } from 'framer-motion';
import type { Citation } from '@eva/common';

type Lang = 'en' | 'fr';

export interface CompareResult {
  mode: string;
  content: string;
  agent_steps: Array<{
    id: number;
    tool: string;
    status: string;
    label_en: string;
    label_fr: string;
    duration_ms?: number | null;
    metadata?: Record<string, unknown> | null;
  }>;
  provenance: {
    confidence?: number;
    behavioral_fingerprint?: {
      prompt_version: string;
      model: string;
    };
    [key: string]: unknown;
  } | null;
  degradation?: { status: string; service?: string } | null;
}

export interface CompareViewProps {
  question: string;
  grounded: CompareResult;
  ungrounded: CompareResult;
  language: Lang;
  onCitationClick?: (citation: Citation) => void;
  onClose: () => void;
}

const i18n = {
  en: {
    ragLabel: 'RAG-Grounded',
    ungroundedLabel: 'Ungrounded',
    confidence: 'Confidence',
    promptVersion: 'Prompt',
    steps: 'Steps',
    close: 'Close comparison',
    question: 'Question',
    degraded: 'Degraded',
  },
  fr: {
    ragLabel: 'Ancre (RAG)',
    ungroundedLabel: 'Non ancre',
    confidence: 'Confiance',
    promptVersion: 'Prompt',
    steps: 'Etapes',
    close: 'Fermer la comparaison',
    question: 'Question',
    degraded: 'Degrade',
  },
} as const;

function ConfidenceBadge({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? 'bg-green-100 text-green-800' :
    pct >= 40 ? 'bg-yellow-100 text-yellow-800' :
    'bg-red-100 text-red-800';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}: {pct}%
    </span>
  );
}

function StepList({
  steps,
  language,
}: {
  steps: CompareResult['agent_steps'];
  language: Lang;
}) {
  if (!steps.length) return null;
  return (
    <div className="mt-3 space-y-1">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          <span>{language === 'fr' ? step.label_fr : step.label_en}</span>
          {step.duration_ms != null && (
            <span className="text-gray-400">{step.duration_ms}ms</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function CompareView({
  question,
  grounded,
  ungrounded,
  language,
  onClose,
}: CompareViewProps) {
  const t = i18n[language];

  const panels = [
    { result: grounded, label: t.ragLabel, accent: 'border-blue-500', bgHeader: 'bg-blue-50', side: 'left' as const },
    { result: ungrounded, label: t.ungroundedLabel, accent: 'border-amber-500', bgHeader: 'bg-amber-50', side: 'right' as const },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-4">
      {/* Header with question */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-700">{t.question}:</span>{' '}
          <span className="italic">{question}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {t.close}
        </button>
      </div>

      {/* Split panes */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {panels.map(({ result, label, accent, bgHeader, side }) => (
          <motion.div
            key={side}
            initial={{ opacity: 0, x: side === 'left' ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col"
          >
            {/* Panel header */}
            <div className={`flex items-center gap-2 px-4 py-2 border-b-2 ${accent} ${bgHeader}`}>
              <span className="text-sm font-semibold text-gray-800">{label}</span>
              {result.provenance?.confidence != null && (
                <ConfidenceBadge
                  value={result.provenance.confidence}
                  label={t.confidence}
                />
              )}
              {result.provenance?.behavioral_fingerprint?.prompt_version && (
                <span className="text-[10px] text-gray-400 font-mono">
                  {t.promptVersion}: {result.provenance.behavioral_fingerprint.prompt_version}
                </span>
              )}
              {result.degradation && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-medium">
                  {t.degraded}
                </span>
              )}
            </div>

            {/* Panel content */}
            <div className="px-4 py-3 overflow-y-auto max-h-96 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
              {result.content || (
                <span className="text-gray-400 italic">No content</span>
              )}
            </div>

            {/* Agent steps */}
            {result.agent_steps.length > 0 && (
              <div className="px-4 pb-3 border-t border-gray-100">
                <p className="text-[10px] uppercase text-gray-400 mt-2 mb-1 font-semibold tracking-wide">
                  {t.steps}
                </p>
                <StepList steps={result.agent_steps} language={language} />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
