// ---------------------------------------------------------------------------
// ProvenanceBadge — confidence ring + sources + freshness at a glance
// ---------------------------------------------------------------------------

import { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ProvenanceRecord } from '@eva/common';

export interface ProvenanceBadgeProps {
  provenance: Partial<ProvenanceRecord> | null;
  isStreaming: boolean;
}

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function confidenceLabel(score: number, lang: 'en' | 'fr' = 'en'): string {
  if (score > 0.7) return lang === 'fr' ? 'Confiance elevee' : 'High confidence';
  if (score >= 0.4) return lang === 'fr' ? 'Confiance moyenne' : 'Medium confidence';
  return lang === 'fr' ? 'Confiance faible' : 'Low confidence';
}

function confidenceColor(score: number): string {
  if (score > 0.7) return '#16a34a'; // green-600
  if (score >= 0.4) return '#d97706'; // amber-600
  return '#dc2626'; // red-600
}

function confidenceBgClass(score: number): string {
  if (score > 0.7) return 'bg-green-50 border-green-200';
  if (score >= 0.4) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

const escalationLabels: Record<string, { en: string; fr: string; cls: string }> = {
  'auto-resolve': {
    en: 'Auto-resolve',
    fr: 'Resolution auto',
    cls: 'bg-green-100 text-green-800',
  },
  'flagged-for-review': {
    en: 'Flagged for review',
    fr: 'Signale pour revision',
    cls: 'bg-amber-100 text-amber-800',
  },
  'requires-human-decision': {
    en: 'Requires human decision',
    fr: 'Decision humaine requise',
    cls: 'bg-red-100 text-red-800',
  },
};

export function ProvenanceBadge({ provenance, isStreaming }: ProvenanceBadgeProps) {
  const prefersReduced = useReducedMotion();
  const tooltipId = useId();
  const [showTooltip, setShowTooltip] = useState(false);

  // Animate the ring fill
  const [displayScore, setDisplayScore] = useState(0);
  const targetScore = provenance?.confidence ?? 0;

  useEffect(() => {
    if (prefersReduced || !provenance) {
      setDisplayScore(targetScore);
      return;
    }
    // Simple spring-like animation via requestAnimationFrame
    let raf: number;
    const start = performance.now();
    const duration = 800;
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(from + (targetScore - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetScore, prefersReduced, provenance]);

  if (!provenance || isStreaming) return null;

  const strokeOffset = CIRCUMFERENCE - displayScore * CIRCUMFERENCE;
  const color = confidenceColor(targetScore);
  const label = confidenceLabel(targetScore);

  return (
    <div className="mt-3 relative inline-block">
      <button
        type="button"
        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${confidenceBgClass(targetScore)} hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
        aria-describedby={showTooltip ? tooltipId : undefined}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        {/* Confidence ring */}
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          aria-hidden="true"
          className="flex-shrink-0"
        >
          {/* Background ring */}
          <circle
            cx="22"
            cy="22"
            r={RADIUS}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="4"
          />
          {/* Filled ring */}
          <motion.circle
            cx="22"
            cy="22"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
            transform="rotate(-90 22 22)"
          />
          {/* Score text */}
          <text
            x="22"
            y="22"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[11px] font-semibold"
            fill={color}
          >
            {Math.round(targetScore * 100)}
          </text>
        </svg>

        {/* Labels */}
        <div className="flex flex-col gap-0.5 text-left">
          <span className="font-medium text-gray-800">{label}</span>
          {provenance.sources_cited != null && provenance.sources_consulted != null && (
            <span className="text-xs text-gray-500">
              {provenance.sources_cited} of {provenance.sources_consulted} sources cited
            </span>
          )}
          {provenance.freshness?.staleness_warning && (
            <span className="text-xs text-amber-700 font-medium">
              Stale source warning
            </span>
          )}
        </div>

        {/* Escalation tier */}
        {provenance.escalation_tier && provenance.escalation_tier !== 'auto-resolve' && (
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${escalationLabels[provenance.escalation_tier]?.cls ?? ''}`}
          >
            {escalationLabels[provenance.escalation_tier]?.en ?? provenance.escalation_tier}
          </span>
        )}
      </button>

      {/* Tooltip with detailed breakdown */}
      {showTooltip && provenance.confidence_factors && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs"
        >
          <p className="font-semibold text-gray-700 mb-1.5">Confidence breakdown</p>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-gray-500">Retrieval relevance</dt>
              <dd className="font-medium">{Math.round(provenance.confidence_factors.retrieval_relevance * 100)}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Source coverage</dt>
              <dd className="font-medium">{Math.round(provenance.confidence_factors.source_coverage * 100)}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Grounding quality</dt>
              <dd className="font-medium">{Math.round(provenance.confidence_factors.grounding_quality * 100)}%</dd>
            </div>
          </dl>
          {provenance.freshness && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              {provenance.freshness.newest_source && (
                <p className="text-gray-500">
                  Newest source: {new Date(provenance.freshness.newest_source).toLocaleDateString()}
                </p>
              )}
              {provenance.freshness.oldest_source && (
                <p className="text-gray-500">
                  Oldest source: {new Date(provenance.freshness.oldest_source).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
