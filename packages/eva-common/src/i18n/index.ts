import en from './en.json';
import fr from './fr.json';

export type Language = 'en' | 'fr';
export type TranslationKey = string; // dot-notation: "chat.send", "common.cancel"

/**
 * Resolve a dot-notation key (e.g. "chat.placeholder") against the
 * selected language bundle.  Returns the key itself when no match is found
 * so missing translations are visible during development.
 */
export function getTranslation(lang: Language, key: string): string {
  const translations: Record<string, unknown> = lang === 'fr' ? fr : en;
  const segments = key.split('.');
  let value: unknown = translations;

  for (const segment of segments) {
    if (value == null || typeof value !== 'object') {
      return key; // path broke — return key as fallback
    }
    value = (value as Record<string, unknown>)[segment];
  }

  return typeof value === 'string' ? value : key;
}

export { en, fr };
