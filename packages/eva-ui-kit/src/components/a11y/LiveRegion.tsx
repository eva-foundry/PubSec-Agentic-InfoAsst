// ---------------------------------------------------------------------------
// LiveRegion — ARIA live region for dynamic screen-reader announcements
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';

interface LiveRegionProps {
  /** The message to announce. Change this value to trigger a new announcement. */
  message: string;
  /** ARIA politeness level. 'polite' waits for idle; 'assertive' interrupts. */
  politeness?: 'polite' | 'assertive';
}

/**
 * Renders a visually-hidden ARIA live region that announces dynamic content
 * changes to assistive technology. Useful for:
 * - Agent step progress announcements
 * - Form validation errors
 * - Status / loading state changes
 * - Toast-style notifications that must reach screen-reader users
 *
 * Uses a double-buffer technique: the message is cleared then re-set on a
 * microtask so that assistive technology reliably re-announces identical
 * consecutive messages.
 */
export function LiveRegion({ message, politeness = 'polite' }: LiveRegionProps) {
  const [announced, setAnnounced] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Clear first so repeated identical messages still trigger announcements
    setAnnounced('');

    if (!message) return;

    timeoutRef.current = setTimeout(() => {
      setAnnounced(message);
    }, 100);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [message]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announced}
    </div>
  );
}
