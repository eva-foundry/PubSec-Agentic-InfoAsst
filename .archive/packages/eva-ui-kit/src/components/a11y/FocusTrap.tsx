// ---------------------------------------------------------------------------
// FocusTrap — Traps keyboard focus within a container (for modal dialogs)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react';

interface FocusTrapProps {
  /** When true, focus is trapped inside the children container. */
  active: boolean;
  /** Content to render inside the focus trap. */
  children: ReactNode;
  /** Called when the user presses Escape inside the trap. */
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(', ');

/**
 * Wraps children in a focus-trapping container for WCAG 2.1 AA modal dialog
 * compliance. When `active` is true:
 *
 * - Focus moves to the first focusable element on mount
 * - Tab / Shift+Tab cycle within the container (no escape to page behind)
 * - Escape key fires `onEscape` callback
 * - Focus returns to the previously-focused element when deactivated
 */
export function FocusTrap({ active, children, onEscape }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save and restore focus
  useEffect(() => {
    if (!active) return;

    // Save the element that had focus before the trap activated
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the trap on next frame (after render)
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        // If no focusable children, make container itself focusable
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      // Return focus to trigger element
      previousFocusRef.current?.focus();
    };
  }, [active]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!active) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [active, onEscape],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div ref={containerRef} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}
