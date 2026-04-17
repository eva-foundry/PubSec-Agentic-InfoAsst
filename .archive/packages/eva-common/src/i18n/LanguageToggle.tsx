// ---------------------------------------------------------------------------
// LanguageToggle — switches between EN and FR via i18next.changeLanguage()
// ---------------------------------------------------------------------------
//
// Styled to match GC Design System link-button conventions.
// Persists preference to localStorage so it survives page reloads.
// ---------------------------------------------------------------------------

import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'eva-language';

export interface LanguageToggleProps {
  /** Additional CSS classes applied to the button element. */
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;
  const targetLang = currentLang === 'fr' ? 'en' : 'fr';
  const label = currentLang === 'fr' ? 'English' : 'Fran\u00e7ais';

  const handleToggle = () => {
    i18n.changeLanguage(targetLang);
    try {
      localStorage.setItem(STORAGE_KEY, targetLang);
    } catch {
      // Storage blocked — language still switches in-memory
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      lang={targetLang}
      aria-label={
        currentLang === 'fr'
          ? 'Switch to English'
          : "Passer au fran\u00e7ais"
      }
      className={
        className ??
        'text-sm font-medium text-blue-700 underline hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded'
      }
    >
      {label}
    </button>
  );
}
