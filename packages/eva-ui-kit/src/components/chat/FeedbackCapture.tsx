// ---------------------------------------------------------------------------
// FeedbackCapture — thumbs up/down with optional correction
// ---------------------------------------------------------------------------

import { useCallback, useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface FeedbackCaptureProps {
  onFeedback: (signal: 'accept' | 'reject', correction?: string) => void;
}

type FeedbackState = 'idle' | 'accepted' | 'rejected' | 'correcting';

export function FeedbackCapture({ onFeedback }: FeedbackCaptureProps) {
  const [state, setState] = useState<FeedbackState>('idle');
  const [correction, setCorrection] = useState('');
  const prefersReduced = useReducedMotion();
  const correctionId = useId();

  const handleAccept = useCallback(() => {
    setState('accepted');
    onFeedback('accept');
  }, [onFeedback]);

  const handleReject = useCallback(() => {
    setState('correcting');
  }, []);

  const submitCorrection = useCallback(() => {
    setState('rejected');
    onFeedback('reject', correction.trim() || undefined);
    setCorrection('');
  }, [correction, onFeedback]);

  const cancelCorrection = useCallback(() => {
    setState('rejected');
    onFeedback('reject');
    setCorrection('');
  }, [onFeedback]);

  const bounceVariants = prefersReduced
    ? {}
    : {
        tap: { scale: 1.3, transition: { type: 'spring', stiffness: 500, damping: 15 } },
      };

  if (state === 'accepted' || state === 'rejected') {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400" aria-live="polite">
        {state === 'accepted' ? (
          <>
            <svg className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M1 8.998a1 1 0 011-1h.01a1 1 0 110 2H2a1 1 0 01-1-1zM8.006 1a1 1 0 011 1v.01a1 1 0 11-2 0V2a1 1 0 011-1zm5.657 2.343a1 1 0 010 1.414l-.007.007a1 1 0 01-1.414-1.414l.007-.007a1 1 0 011.414 0zM2.343 5.657a1 1 0 011.414 0l.007.007a1 1 0 01-1.414 1.414l-.007-.007a1 1 0 010-1.414z" />
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zm-2 4a2 2 0 114 0 2 2 0 01-4 0z" clipRule="evenodd" />
            </svg>
            Thank you for your feedback
          </>
        ) : (
          <>
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            Feedback recorded
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1" role="group" aria-label="Message feedback">
        {/* Thumbs up */}
        <motion.button
          type="button"
          onClick={handleAccept}
          whileTap={bounceVariants.tap}
          className="rounded p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Helpful"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M1 8.998a1 1 0 011-1h1.5a.5.5 0 01.5.5v7a.5.5 0 01-.5.5H2a1 1 0 01-1-1v-6zm4.5 7V8.498l2.7-5.4A.5.5 0 018.65 3h.1a1.25 1.25 0 011.25 1.25v3.25h4.5a1.5 1.5 0 011.464 1.829l-1.2 5.25A1.5 1.5 0 0113.3 15.998H6a.5.5 0 01-.5-.5z" />
          </svg>
        </motion.button>

        {/* Thumbs down */}
        <motion.button
          type="button"
          onClick={handleReject}
          whileTap={bounceVariants.tap}
          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Not helpful"
        >
          <svg className="h-4 w-4 rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M1 8.998a1 1 0 011-1h1.5a.5.5 0 01.5.5v7a.5.5 0 01-.5.5H2a1 1 0 01-1-1v-6zm4.5 7V8.498l2.7-5.4A.5.5 0 018.65 3h.1a1.25 1.25 0 011.25 1.25v3.25h4.5a1.5 1.5 0 011.464 1.829l-1.2 5.25A1.5 1.5 0 0113.3 15.998H6a.5.5 0 01-.5-.5z" />
          </svg>
        </motion.button>
      </div>

      {/* Correction panel */}
      {state === 'correcting' && (
        <motion.div
          initial={prefersReduced ? undefined : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mt-2 overflow-hidden"
        >
          <label htmlFor={correctionId} className="block text-xs font-medium text-gray-600 mb-1">
            What should the answer have been?
          </label>
          <textarea
            id={correctionId}
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Provide the correct answer or describe the issue..."
          />
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={submitCorrection}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={cancelCorrection}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Skip
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
