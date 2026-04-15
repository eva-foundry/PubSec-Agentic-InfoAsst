// ---------------------------------------------------------------------------
// DropZone — drag-and-drop file upload area with Framer Motion feedback
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string[]; // file extensions, e.g. [".pdf", ".docx"]
  disabled?: boolean;
  labels?: {
    dropHere: string;
    orBrowse: string;
    dragActive: string;
  };
}

const DEFAULT_LABELS = {
  dropHere: "Drop files here",
  orBrowse: "or click to browse",
  dragActive: "Release to upload",
};

export default function DropZone({
  onFiles,
  accept,
  disabled = false,
  labels = DEFAULT_LABELS,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return;
      const files = Array.from(fileList);
      if (accept && accept.length > 0) {
        const normalized = accept.map((e) => e.toLowerCase());
        const filtered = files.filter((f) => {
          const dot = f.name.lastIndexOf(".");
          const ext = dot >= 0 ? f.name.slice(dot).toLowerCase() : "";
          return normalized.includes(ext);
        });
        onFiles(filtered);
      } else {
        onFiles(files);
      }
    },
    [onFiles, accept, disabled],
  );

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current += 1;
      if (dragCounter.current === 1) setIsDragOver(true);
    },
    [disabled],
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) e.dataTransfer.dropEffect = "copy";
    },
    [disabled],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      if (!disabled) handleFiles(e.dataTransfer.files);
    },
    [handleFiles, disabled],
  );

  const onClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled) {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled],
  );

  return (
    <motion.div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={labels.dropHere}
      aria-disabled={disabled}
      className={`
        relative flex flex-col items-center justify-center gap-2
        rounded-lg border-2 border-dashed p-8 transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        ${disabled ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60" : "cursor-pointer border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"}
        ${isDragOver && !disabled ? "border-blue-500 bg-blue-50" : ""}
      `}
      animate={
        isDragOver && !disabled
          ? { scale: [1, 1.01, 1], borderColor: "var(--gc-blue, #26374a)" }
          : { scale: 1 }
      }
      transition={{ duration: 0.3, repeat: isDragOver ? Infinity : 0, repeatType: "reverse" }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {/* Upload icon */}
      <AnimatePresence mode="wait">
        {isDragOver && !disabled ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="text-center"
          >
            <UploadArrowIcon className="mx-auto mb-2 h-10 w-10 text-blue-500" />
            <p className="text-sm font-medium text-blue-700">{labels.dragActive}</p>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-center"
          >
            <UploadIcon className="mx-auto mb-2 h-10 w-10 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">{labels.dropHere}</p>
            <p className="mt-1 text-xs text-gray-500">{labels.orBrowse}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={accept?.join(",")}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Simple inline SVG icons
// ---------------------------------------------------------------------------

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

function UploadArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-5 5m5-5l5 5" />
    </svg>
  );
}
