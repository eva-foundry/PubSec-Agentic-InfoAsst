// ---------------------------------------------------------------------------
// CitationViewer — citation cards with source linking
// ---------------------------------------------------------------------------

import { motion, useReducedMotion } from 'framer-motion';
import type { Citation } from '@eva/common';

export interface CitationViewerProps {
  citations: Citation[];
  onCitationClick?: (citation: Citation) => void;
}

function extractFilename(filePath: string): string {
  const segments = filePath.split('/');
  return segments[segments.length - 1] ?? filePath;
}

function qualityIndicator(score: number | null): { label: string; cls: string } | null {
  if (score == null) return null;
  if (score >= 0.8) return { label: 'High', cls: 'text-green-700 bg-green-50' };
  if (score >= 0.5) return { label: 'Medium', cls: 'text-amber-700 bg-amber-50' };
  return { label: 'Low', cls: 'text-red-700 bg-red-50' };
}

export function CitationViewer({ citations, onCitationClick }: CitationViewerProps) {
  const prefersReduced = useReducedMotion();

  if (citations.length === 0) return null;

  const variants = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, scale: 0.97 },
        animate: { opacity: 1, scale: 1 },
      };

  return (
    <div className="mt-3" role="list" aria-label="Citations">
      <p className="text-xs font-medium text-gray-500 mb-1.5">Sources</p>
      <div className="flex flex-wrap gap-2">
        {citations.map((citation, index) => {
          const filename = extractFilename(citation.file);
          const quality = qualityIndicator(citation.source_quality_score);

          return (
            <motion.button
              key={`${citation.file}-${citation.page ?? index}`}
              type="button"
              onClick={() => onCitationClick?.(citation)}
              className="group flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 animate-[glow-pulse_1.5s_ease-out_1]"
              {...variants}
              transition={{ delay: prefersReduced ? 0 : index * 0.06, duration: 0.25 }}
              role="listitem"
              aria-label={`Source: ${filename}${citation.page ? `, page ${citation.page}` : ''}`}
            >
              {/* Document icon */}
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                  clipRule="evenodd"
                />
              </svg>

              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate max-w-[200px] group-hover:text-blue-700">
                  {filename}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                  {citation.page != null && <span>p. {citation.page}</span>}
                  {citation.section && (
                    <span className="truncate max-w-[140px]">{citation.section}</span>
                  )}
                  {citation.last_verified && (
                    <span>
                      {new Date(citation.last_verified).toLocaleDateString()}
                    </span>
                  )}
                  {quality && (
                    <span className={`rounded px-1 py-px font-medium ${quality.cls}`}>
                      {quality.label}
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
