// ---------------------------------------------------------------------------
// DocumentViewer -- slide-in panel for citation drill-down
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Citation } from '@eva/common';

type Lang = 'en' | 'fr';

export interface DocumentContent {
  file: string;
  workspace_id?: string;
  chunk_count: number;
  content: string;
  sections: string[];
  pages: number[];
  last_verified: string | null;
}

export interface DocumentViewerProps {
  open: boolean;
  citation: Citation | null;
  documentContent: DocumentContent | null;
  loading?: boolean;
  language: Lang;
  onClose: () => void;
}

const i18n = {
  en: {
    title: 'Document Viewer',
    file: 'File',
    page: 'Page',
    section: 'Section',
    lastVerified: 'Last verified',
    sourceQuality: 'Source quality',
    close: 'Close',
    loading: 'Loading document...',
    noContent: 'No content available.',
    chunks: 'chunks',
    pages: 'Pages',
    sections: 'Sections',
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    low: 'Low',
  },
  fr: {
    title: 'Visionneuse de documents',
    file: 'Fichier',
    page: 'Page',
    section: 'Section',
    lastVerified: 'Derniere verification',
    sourceQuality: 'Qualite de la source',
    close: 'Fermer',
    loading: 'Chargement du document...',
    noContent: 'Aucun contenu disponible.',
    chunks: 'fragments',
    pages: 'Pages',
    sections: 'Sections',
    excellent: 'Excellent',
    good: 'Bon',
    fair: 'Acceptable',
    low: 'Faible',
  },
} as const;

function qualityLabel(score: number | null | undefined, t: typeof i18n['en']): { text: string; color: string } {
  if (score == null) return { text: '', color: '' };
  if (score >= 0.9) return { text: t.excellent, color: 'bg-green-100 text-green-800' };
  if (score >= 0.7) return { text: t.good, color: 'bg-blue-100 text-blue-800' };
  if (score >= 0.5) return { text: t.fair, color: 'bg-yellow-100 text-yellow-800' };
  return { text: t.low, color: 'bg-red-100 text-red-800' };
}

/**
 * Highlight the cited section within the full document content.
 * Uses the citation's section name to find and wrap in <mark>.
 */
function highlightContent(content: string, citation: Citation | null): string {
  if (!citation?.section || !content) return content;

  // Try to find the section heading and highlight the paragraph after it
  const sectionPattern = citation.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${sectionPattern})`, 'gi');
  return content.replace(regex, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
}

export function DocumentViewer({
  open,
  citation,
  documentContent,
  loading = false,
  language,
  onClose,
}: DocumentViewerProps) {
  const t = i18n[language];
  const panelRef = useRef<HTMLDivElement>(null);

  // Trap focus when open
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const quality = citation ? qualityLabel(citation.source_quality_score, t) : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-in panel */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label={t.title}
            aria-modal="true"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-gray-50 flex-shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 truncate">{t.title}</h2>
                {citation && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {citation.file}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={t.close}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Metadata bar */}
            {citation && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white text-xs text-gray-500">
                {citation.page != null && (
                  <span>
                    <span className="font-medium text-gray-600">{t.page}:</span> {citation.page}
                  </span>
                )}
                {citation.section && (
                  <span>
                    <span className="font-medium text-gray-600">{t.section}:</span> {citation.section}
                  </span>
                )}
                {citation.last_verified && (
                  <span>
                    <span className="font-medium text-gray-600">{t.lastVerified}:</span>{' '}
                    {new Date(citation.last_verified).toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA')}
                  </span>
                )}
                {quality && quality.text && (
                  <span className={`rounded-full px-2 py-0.5 font-medium ${quality.color}`}>
                    {t.sourceQuality}: {quality.text}
                  </span>
                )}
              </div>
            )}

            {/* Document info bar */}
            {documentContent && (
              <div className="flex flex-wrap items-center gap-3 px-4 py-1.5 border-b border-gray-100 bg-gray-50 text-[10px] text-gray-400">
                <span>{documentContent.chunk_count} {t.chunks}</span>
                {documentContent.pages.length > 0 && (
                  <span>{t.pages}: {documentContent.pages.join(', ')}</span>
                )}
                {documentContent.sections.length > 0 && (
                  <span>{t.sections}: {documentContent.sections.join(', ')}</span>
                )}
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loading && (
                <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                  <svg className="animate-spin h-5 w-5 mr-2 text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t.loading}
                </div>
              )}

              {!loading && !documentContent && (
                <p className="text-sm text-gray-400 text-center py-12">{t.noContent}</p>
              )}

              {!loading && documentContent && (
                <div
                  className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: highlightContent(
                      documentContent.content
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;'),
                      citation,
                    ),
                  }}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
