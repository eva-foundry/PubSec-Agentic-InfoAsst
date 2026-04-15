// ---------------------------------------------------------------------------
// RequestDetailsDrawer — collapsible provenance/telemetry panel per message
// ---------------------------------------------------------------------------

import { useCallback, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { ProvenanceRecord } from '@eva/common';

// ---------------------------------------------------------------------------
// Telemetry shape (enriches provenance with cost/token data)
// ---------------------------------------------------------------------------

export interface MessageTelemetry {
  model?: string;
  tokens_prompt?: number;
  tokens_completion?: number;
  tokens_total?: number;
  latency_ms?: number;
  estimated_cost_cad?: number;
}

// ---------------------------------------------------------------------------
// Bilingual labels
// ---------------------------------------------------------------------------

const L = {
  en: {
    toggle: 'Request Details',
    correlationId: 'Correlation ID',
    copied: 'Copied!',
    copy: 'Copy',
    model: 'Model',
    tokensPrompt: 'Prompt Tokens',
    tokensCompletion: 'Completion Tokens',
    tokensTotal: 'Total Tokens',
    latency: 'Latency',
    estimatedCost: 'Estimated Cost',
    workspaceId: 'Workspace',
    escalationTier: 'Escalation Tier',
    policiesApplied: 'Policies Applied',
    confidence: 'Confidence',
    none: 'None',
  },
  fr: {
    toggle: 'Details de la requete',
    correlationId: 'ID de correlation',
    copied: 'Copie!',
    copy: 'Copier',
    model: 'Modele',
    tokensPrompt: 'Jetons (prompt)',
    tokensCompletion: 'Jetons (completion)',
    tokensTotal: 'Jetons (total)',
    latency: 'Latence',
    estimatedCost: 'Cout estime',
    workspaceId: 'Espace de travail',
    escalationTier: 'Niveau d\'escalade',
    policiesApplied: 'Politiques appliquees',
    confidence: 'Confiance',
    none: 'Aucune',
  },
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RequestDetailsDrawerProps {
  provenance: Partial<ProvenanceRecord> | null;
  telemetry?: MessageTelemetry | null;
  workspaceId?: string | null;
  language: 'en' | 'fr';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RequestDetailsDrawer({
  provenance,
  telemetry,
  workspaceId,
  language,
}: RequestDetailsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const prefersReduced = useReducedMotion();
  const t = L[language];

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, []);

  // Nothing to show if no data
  if (!provenance && !telemetry) return null;

  const model = telemetry?.model ?? provenance?.behavioral_fingerprint?.model;
  const correlationId = provenance?.correlation_id;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        aria-expanded={open}
      >
        <svg
          className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {t.toggle}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <dl className="mt-2 space-y-1.5 rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs">
              {/* Correlation ID */}
              {correlationId && (
                <Row label={t.correlationId}>
                  <span className="font-mono text-gray-700 select-all">{correlationId}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(correlationId)}
                    className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={t.copy}
                  >
                    {copied ? t.copied : t.copy}
                  </button>
                </Row>
              )}

              {/* Model */}
              {model && <Row label={t.model}><span className="text-gray-700">{model}</span></Row>}

              {/* Tokens */}
              {telemetry?.tokens_prompt != null && (
                <Row label={t.tokensPrompt}>
                  <span className="tabular-nums text-gray-700">{telemetry.tokens_prompt.toLocaleString()}</span>
                </Row>
              )}
              {telemetry?.tokens_completion != null && (
                <Row label={t.tokensCompletion}>
                  <span className="tabular-nums text-gray-700">{telemetry.tokens_completion.toLocaleString()}</span>
                </Row>
              )}
              {telemetry?.tokens_total != null && (
                <Row label={t.tokensTotal}>
                  <span className="tabular-nums font-medium text-gray-800">{telemetry.tokens_total.toLocaleString()}</span>
                </Row>
              )}

              {/* Latency */}
              {telemetry?.latency_ms != null && (
                <Row label={t.latency}>
                  <span className="tabular-nums text-gray-700">{telemetry.latency_ms.toLocaleString()} ms</span>
                </Row>
              )}

              {/* Estimated Cost */}
              {telemetry?.estimated_cost_cad != null && (
                <Row label={t.estimatedCost}>
                  <span className="tabular-nums font-medium text-green-700">
                    ${telemetry.estimated_cost_cad.toFixed(4)} CAD
                  </span>
                </Row>
              )}

              {/* Workspace */}
              {workspaceId && (
                <Row label={t.workspaceId}><span className="text-gray-700">{workspaceId}</span></Row>
              )}

              {/* Escalation tier */}
              {provenance?.escalation_tier && (
                <Row label={t.escalationTier}>
                  <EscalationBadge tier={provenance.escalation_tier} />
                </Row>
              )}

              {/* Confidence */}
              {provenance?.confidence != null && (
                <Row label={t.confidence}>
                  <span className="tabular-nums text-gray-700">{(provenance.confidence * 100).toFixed(1)}%</span>
                </Row>
              )}

              {/* Policies applied */}
              {provenance?.policies_applied && provenance.policies_applied.length > 0 && (
                <Row label={t.policiesApplied}>
                  <div className="flex flex-wrap gap-1">
                    {provenance.policies_applied.map((p) => (
                      <span
                        key={p}
                        className="inline-flex rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </Row>
              )}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 font-medium text-gray-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function EscalationBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    'auto-resolve': 'bg-green-100 text-green-800',
    'flagged-for-review': 'bg-amber-100 text-amber-800',
    'requires-human-decision': 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${styles[tier] ?? 'bg-gray-100 text-gray-700'}`}>
      {tier}
    </span>
  );
}
