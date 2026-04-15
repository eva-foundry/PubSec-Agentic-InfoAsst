// ---------------------------------------------------------------------------
// DegradationBanner -- top banner showing circuit breaker / degradation status
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Lang = 'en' | 'fr';

export type DegradationLevel = 'none' | 'partial' | 'unavailable';

export interface DegradationBannerProps {
  healthEndpoint: string;
  pollIntervalMs?: number;
  language: Lang;
}

const i18n = {
  en: {
    partial:
      'Partial results \u2014 document search temporarily unavailable. Answers may be less accurate.',
    unavailable:
      'Service temporarily unavailable. Please try again later.',
    dismiss: 'Dismiss',
  },
  fr: {
    partial:
      'R\u00e9sultats partiels \u2014 la recherche de documents est temporairement indisponible. Les r\u00e9ponses peuvent \u00eatre moins pr\u00e9cises.',
    unavailable:
      'Service temporairement indisponible. Veuillez r\u00e9essayer plus tard.',
    dismiss: 'Fermer',
  },
} as const;

export function DegradationBanner({
  healthEndpoint,
  pollIntervalMs = 30_000,
  language,
}: DegradationBannerProps) {
  const [level, setLevel] = useState<DegradationLevel>('none');
  const [dismissed, setDismissed] = useState(false);
  const t = i18n[language];

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(healthEndpoint, {
        headers: {
          'Content-Type': 'application/json',
          'x-demo-user-email': (() => {
            try {
              const raw = localStorage.getItem('eva-auth-user');
              if (raw) return JSON.parse(raw).email;
            } catch { /* noop */ }
            return '';
          })(),
        },
      });
      if (!res.ok) {
        setLevel('unavailable');
        return;
      }
      const data = await res.json();

      // Determine level from circuit_breakers or overall status
      const breakers = data.circuit_breakers ?? {};
      const anyDown = Object.values(breakers).some(
        (b: unknown) => (b as { status: string }).status === 'down',
      );
      const anyDegraded = Object.values(breakers).some(
        (b: unknown) => (b as { status: string }).status === 'degraded',
      );

      if (anyDown) {
        setLevel('unavailable');
        setDismissed(false); // Force show when status worsens
      } else if (anyDegraded) {
        setLevel('partial');
        setDismissed(false);
      } else {
        setLevel('none');
        setDismissed(false);
      }
    } catch {
      // Network error — assume unavailable
      setLevel('unavailable');
    }
  }, [healthEndpoint]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, pollIntervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, pollIntervalMs]);

  if (level === 'none' || dismissed) return null;

  const isUnavailable = level === 'unavailable';
  const bgColor = isUnavailable
    ? 'bg-red-600 text-white'
    : 'bg-amber-500 text-amber-950';
  const message = isUnavailable ? t.unavailable : t.partial;
  const icon = isUnavailable ? (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );

  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${bgColor}`}
      >
        {icon}
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md px-2 py-0.5 text-xs opacity-80 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label={t.dismiss}
        >
          {t.dismiss}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
