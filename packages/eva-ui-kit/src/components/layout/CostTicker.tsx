// ---------------------------------------------------------------------------
// CostTicker — running session cost counter for the app header
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

// ---------------------------------------------------------------------------
// Bilingual labels
// ---------------------------------------------------------------------------

const L = {
  en: {
    label: 'Session cost',
    queriesOne: 'query this session',
    queriesMany: 'queries this session',
  },
  fr: {
    label: 'Cout de la session',
    queriesOne: 'requete cette session',
    queriesMany: 'requetes cette session',
  },
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CostTickerProps {
  /** API base URL to poll session cost. Defaults to /v1/eva. */
  apiBase?: string;
  /** Poll interval in ms. Defaults to 10000. */
  pollInterval?: number;
  /** Language for labels. */
  language: 'en' | 'fr';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostTicker({
  apiBase = '/v1/eva',
  pollInterval = 10_000,
  language,
}: CostTickerProps) {
  const t = L[language];
  const prefersReduced = useReducedMotion();

  const [cost, setCost] = useState(0);
  const [queryCount, setQueryCount] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  // Animated display value
  const [displayCost, setDisplayCost] = useState(0);
  const rafRef = useRef<number>(0);
  const prevCostRef = useRef(0);

  // Animate cost changes with ease-out
  useEffect(() => {
    if (prefersReduced || cost === prevCostRef.current) {
      setDisplayCost(cost);
      prevCostRef.current = cost;
      return;
    }

    const from = prevCostRef.current;
    const to = cost;
    const start = performance.now();
    const duration = 600;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCost(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevCostRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cost, prefersReduced]);

  // Poll for session cost
  const fetchCost = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      try {
        const raw = localStorage.getItem('eva-auth-user');
        if (raw) {
          const user = JSON.parse(raw);
          if (user.email) headers['x-demo-user-email'] = user.email;
        }
      } catch { /* noop */ }

      const res = await fetch(`${apiBase}/session/cost`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.cost_cad === 'number') setCost(data.cost_cad);
        if (typeof data.query_count === 'number') setQueryCount(data.query_count);
      }
    } catch {
      // silently fail — non-critical UI element
    }
  }, [apiBase]);

  useEffect(() => {
    fetchCost();
    const id = setInterval(fetchCost, pollInterval);
    return () => clearInterval(id);
  }, [fetchCost, pollInterval]);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 tabular-nums"
        role="status"
        aria-label={`${t.label}: $${displayCost.toFixed(4)} CAD`}
        tabIndex={0}
      >
        <svg
          className="h-3.5 w-3.5 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        ${displayCost.toFixed(4)} CAD
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute top-full left-1/2 z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg"
          role="tooltip"
        >
          {queryCount} {queryCount === 1 ? t.queriesOne : t.queriesMany}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
        </div>
      )}
    </div>
  );
}
