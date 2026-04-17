// ---------------------------------------------------------------------------
// PipelineStatusBar — horizontal pipeline stage visualization
// ---------------------------------------------------------------------------

import { motion } from "framer-motion";

const STAGES = [
  "uploaded",
  "extracting",
  "chunking",
  "enriching",
  "embedding",
  "indexing",
  "complete",
] as const;

type Stage = (typeof STAGES)[number];

const STAGE_LABELS: Record<Stage, { en: string; fr: string }> = {
  uploaded:   { en: "Uploaded",   fr: "Televerser" },
  extracting: { en: "Extracting", fr: "Extraction" },
  chunking:   { en: "Chunking",   fr: "Decoupage" },
  enriching:  { en: "Enriching",  fr: "Enrichissement" },
  embedding:  { en: "Embedding",  fr: "Vectorisation" },
  indexing:   { en: "Indexing",   fr: "Indexation" },
  complete:   { en: "Complete",   fr: "Termine" },
};

interface PipelineStatusBarProps {
  currentState: string;
  compact?: boolean;
  lang?: "en" | "fr";
}

function getStageIndex(state: string): number {
  const idx = STAGES.indexOf(state as Stage);
  return idx >= 0 ? idx : -1;
}

type StageStatus = "completed" | "current" | "future" | "error";

function getStageStatus(
  stageIdx: number,
  currentIdx: number,
  isError: boolean,
): StageStatus {
  if (isError) {
    // Error state: everything up to currentIdx is completed, currentIdx is error
    if (stageIdx < currentIdx) return "completed";
    if (stageIdx === currentIdx) return "error";
    return "future";
  }
  if (stageIdx < currentIdx) return "completed";
  if (stageIdx === currentIdx) return "current";
  return "future";
}

const DOT_STYLES: Record<StageStatus, string> = {
  completed: "bg-green-500 border-green-500",
  current:   "bg-blue-500 border-blue-500",
  future:    "bg-white border-gray-300",
  error:     "bg-red-500 border-red-500",
};

const LINE_STYLES: Record<StageStatus, string> = {
  completed: "bg-green-500",
  current:   "bg-blue-300",
  future:    "bg-gray-200",
  error:     "bg-red-300",
};

export default function PipelineStatusBar({
  currentState,
  compact = false,
  lang = "en",
}: PipelineStatusBarProps) {
  const isError = currentState === "error";
  // For error, find the last known stage from the state or default to uploaded
  const rawIdx = getStageIndex(currentState);
  const currentIdx = rawIdx >= 0 ? rawIdx : 0;

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className={`flex items-center ${compact ? "gap-1" : "gap-0"} w-full`}
      role="progressbar"
      aria-valuenow={currentIdx}
      aria-valuemin={0}
      aria-valuemax={STAGES.length - 1}
      aria-label={
        lang === "fr"
          ? `Etape du pipeline : ${STAGE_LABELS[STAGES[currentIdx]][lang]}`
          : `Pipeline stage: ${STAGE_LABELS[STAGES[currentIdx]][lang]}`
      }
    >
      {STAGES.map((stage, idx) => {
        const status = getStageStatus(idx, currentIdx, isError);
        const label = STAGE_LABELS[stage][lang];

        return (
          <div
            key={stage}
            className={`flex items-center ${idx < STAGES.length - 1 ? "flex-1" : ""}`}
          >
            {/* Dot */}
            <div className="relative flex flex-col items-center">
              <motion.div
                className={`
                  ${compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}
                  rounded-full border-2 flex items-center justify-center
                  ${DOT_STYLES[status]}
                `}
                animate={
                  status === "current" && !reducedMotion
                    ? {
                        boxShadow: [
                          "0 0 0 0 rgba(59,130,246,0.4)",
                          "0 0 0 6px rgba(59,130,246,0)",
                        ],
                      }
                    : {}
                }
                transition={
                  status === "current" && !reducedMotion
                    ? { duration: 1.2, repeat: Infinity, ease: "easeOut" }
                    : {}
                }
                initial={false}
                aria-hidden="true"
              >
                {status === "completed" && (
                  <svg
                    className={`${compact ? "h-1.5 w-1.5" : "h-2 w-2"} text-white`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={4}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {status === "error" && (
                  <svg
                    className={`${compact ? "h-1.5 w-1.5" : "h-2 w-2"} text-white`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={4}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </motion.div>

              {/* Label (non-compact only) */}
              {!compact && (
                <span
                  className={`
                    mt-1 text-[9px] leading-tight text-center whitespace-nowrap
                    ${status === "current" ? "font-semibold text-blue-700" : ""}
                    ${status === "completed" ? "text-green-700" : ""}
                    ${status === "error" ? "text-red-700 font-semibold" : ""}
                    ${status === "future" ? "text-gray-400" : ""}
                  `}
                >
                  {label}
                </span>
              )}
            </div>

            {/* Connector line */}
            {idx < STAGES.length - 1 && (
              <div
                className={`
                  ${compact ? "h-0.5 mx-0.5" : "h-0.5 mx-1"}
                  flex-1 rounded-full
                  ${LINE_STYLES[status === "current" || status === "error" ? "future" : status]}
                `}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
