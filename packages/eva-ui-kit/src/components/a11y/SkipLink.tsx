// ---------------------------------------------------------------------------
// SkipLink — Skip navigation link for keyboard users (WCAG 2.1 AA)
// ---------------------------------------------------------------------------

interface SkipLinkProps {
  targetId: string;
  label?: string;
  language?: 'en' | 'fr';
}

const DEFAULT_LABELS = {
  en: 'Skip to main content',
  fr: 'Passer au contenu principal',
} as const;

/**
 * Renders a visually-hidden link that becomes visible on focus, allowing
 * keyboard users to skip past navigation and jump directly to main content.
 *
 * Place as the first focusable element inside `<body>` / app root.
 * The `targetId` must match the `id` attribute of the main content region.
 */
export function SkipLink({ targetId, label, language = 'en' }: SkipLinkProps) {
  const text = label ?? DEFAULT_LABELS[language];

  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-md focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
    >
      {text}
    </a>
  );
}
