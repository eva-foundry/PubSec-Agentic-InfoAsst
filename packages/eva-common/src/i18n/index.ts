// ---------------------------------------------------------------------------
// i18n — react-i18next initialization backed by EN/FR JSON bundles
// ---------------------------------------------------------------------------
//
// Shared across all three portals. Each app imports this module in its
// entry point (main.tsx) to ensure i18next is initialised before React renders.
//
// Legacy compat: getTranslation() is still exported for any code that hasn't
// migrated to useTranslation() yet.
// ---------------------------------------------------------------------------

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

export type Language = 'en' | 'fr';
export type TranslationKey = string; // dot-notation: "chat.send", "common.cancel"

// ---------------------------------------------------------------------------
// Initialise i18next (idempotent — safe to import from multiple entry points)
// ---------------------------------------------------------------------------

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: localStorage.getItem('eva-language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // avoid flicker — bundles are bundled, not lazy
    },
  });
}

// ---------------------------------------------------------------------------
// Legacy helper — resolves dot-notation key against selected language.
// Prefer useTranslation() from react-i18next in new code.
// ---------------------------------------------------------------------------

export function getTranslation(lang: Language, key: string): string {
  return i18n.getFixedT(lang)(key) as string;
}

export { en, fr };
export default i18n;
