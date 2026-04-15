// ---------------------------------------------------------------------------
// useI18n — centralised translation hook backed by @eva/common i18n bundles
// ---------------------------------------------------------------------------
//
// Reads/writes the active language to localStorage so the preference persists
// across page reloads.  Provides a `t()` function that resolves dot-notation
// keys ("chat.placeholder", "common.save") against the current language.
// ---------------------------------------------------------------------------

import { useCallback, useSyncExternalStore } from 'react';
import { getTranslation, type Language } from '@eva/common';

const STORAGE_KEY = 'eva-language';
const DEFAULT_LANG: Language = 'en';

// ---------------------------------------------------------------------------
// Tiny external store so every useI18n consumer re-renders together when the
// language changes — without requiring a React context provider.
// ---------------------------------------------------------------------------

type Listener = () => void;
let listeners: Listener[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    // SSR or storage blocked — fall back silently
  }
  return DEFAULT_LANG;
}

// Server snapshot (SSR) — always English
function getServerSnapshot(): Language {
  return DEFAULT_LANG;
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export interface UseI18nReturn {
  /** Resolve a dot-notation translation key (e.g. "chat.send"). */
  t: (key: string) => string;
  /** Current active language. */
  language: Language;
  /** Switch language — persists to localStorage and triggers re-render. */
  setLanguage: (lang: Language) => void;
}

export function useI18n(): UseI18nReturn {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLanguage = useCallback((lang: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage blocked — still update in-memory listeners
    }
    emitChange();
  }, []);

  const t = useCallback(
    (key: string): string => getTranslation(language, key),
    [language],
  );

  return { t, language, setLanguage };
}
