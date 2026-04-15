// ---------------------------------------------------------------------------
// WorkspaceHealthBadge — inline workspace index health indicator
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceHealthBadgeProps {
  documentCount: number;
  lastRefreshed: string; // ISO date
  freshnessStatus: 'good' | 'stale' | 'critical';
  language: 'en' | 'fr';
}

// ---------------------------------------------------------------------------
// Bilingual labels
// ---------------------------------------------------------------------------

const L = {
  en: {
    documents: 'documents',
    document: 'document',
    updated: 'Updated',
    freshness: 'Freshness',
    good: 'Good',
    stale: 'Stale',
    critical: 'Critical',
  },
  fr: {
    documents: 'documents',
    document: 'document',
    updated: 'Mis a jour',
    freshness: 'Fraicheur',
    good: 'Bonne',
    stale: 'Perimee',
    critical: 'Critique',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string, lang: 'en' | 'fr'): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return lang === 'fr' ? "a l'instant" : 'just now';
  if (diffMin < 60) return `${diffMin}m ${lang === 'fr' ? '' : 'ago'}`;
  if (diffHr < 24) return `${diffHr}h ${lang === 'fr' ? '' : 'ago'}`;
  if (diffDay < 7) return `${diffDay}d ${lang === 'fr' ? '' : 'ago'}`;

  return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_DOT: Record<string, string> = {
  good: 'bg-green-500',
  stale: 'bg-amber-500',
  critical: 'bg-red-500',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceHealthBadge({
  documentCount,
  lastRefreshed,
  freshnessStatus,
  language,
}: WorkspaceHealthBadgeProps) {
  const t = L[language];
  const statusLabel = t[freshnessStatus];

  return (
    <div
      className="inline-flex items-center gap-1.5 text-[11px] text-gray-500"
      role="status"
      aria-label={`${documentCount} ${documentCount === 1 ? t.document : t.documents}, ${t.updated} ${relativeTime(lastRefreshed, language)}, ${t.freshness}: ${statusLabel}`}
    >
      <span className="tabular-nums font-medium text-gray-600">
        {documentCount.toLocaleString()}
      </span>
      <span>{documentCount === 1 ? t.document : t.documents}</span>
      <span className="text-gray-300" aria-hidden="true">·</span>
      <span>{t.updated} {relativeTime(lastRefreshed, language)}</span>
      <span className="text-gray-300" aria-hidden="true">·</span>
      <span className="flex items-center gap-1">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[freshnessStatus]}`}
          aria-hidden="true"
        />
        {t.freshness}: {statusLabel}
      </span>
    </div>
  );
}
