// ---------------------------------------------------------------------------
// Focus management hooks for dynamic content (WCAG 2.1 AA)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, type RefObject } from 'react';

/**
 * Moves focus to the referenced element when it mounts. Useful for
 * dynamically-inserted content that should receive immediate keyboard focus
 * (e.g. a newly-revealed panel, inline error summary, or dialog heading).
 *
 * The element should have `tabindex="-1"` if it's not natively focusable.
 */
export function useFocusOnMount(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Use requestAnimationFrame to ensure the element is rendered
    const raf = requestAnimationFrame(() => {
      el.focus({ preventScroll: false });
    });

    return () => cancelAnimationFrame(raf);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Saves the currently-focused element and provides a function to return
 * focus to it later. Designed for modal / popover patterns where focus
 * must return to the trigger element on close.
 *
 * ```tsx
 * const { saveFocus, returnFocus } = useReturnFocus();
 *
 * function openDialog() {
 *   saveFocus();   // remember the button that was clicked
 *   setOpen(true);
 * }
 *
 * function closeDialog() {
 *   setOpen(false);
 *   returnFocus(); // move focus back to the button
 * }
 * ```
 */
export function useReturnFocus(): {
  saveFocus: () => void;
  returnFocus: () => void;
} {
  const savedRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    savedRef.current = document.activeElement as HTMLElement | null;
  }, []);

  const returnFocus = useCallback(() => {
    const el = savedRef.current;
    if (el && typeof el.focus === 'function') {
      // Defer to next frame so the closing element has time to unmount
      requestAnimationFrame(() => {
        el.focus();
      });
    }
    savedRef.current = null;
  }, []);

  return { saveFocus, returnFocus };
}
