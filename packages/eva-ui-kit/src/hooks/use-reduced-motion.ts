// ---------------------------------------------------------------------------
// useReducedMotion — respects prefers-reduced-motion media query
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Returns `true` when the user's OS / browser is configured to prefer
 * reduced motion. Listens for live changes (e.g. user toggles the setting
 * while the app is open).
 *
 * Use this to disable or simplify animations for vestibular-disorder
 * accessibility compliance (WCAG 2.3.3 / Motion Actuation).
 *
 * NOTE: framer-motion ships its own `useReducedMotion` hook. This standalone
 * version is provided for components that don't depend on framer-motion.
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}
