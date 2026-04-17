// ---------------------------------------------------------------------------
// DocumentsPage — Upload Files + Upload Status two-tab interface
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, useToast } from "@eva/ui-kit";
import DropZone from "../components/DropZone";
import PipelineStatusBar from "../components/PipelineStatusBar";
import { FileTypeIcon, SUPPORTED_EXTENSIONS, getExtension } from "../components/FileTypeIcons";
import {
  uploadDocuments,
  getDocumentStatuses,
  deleteDocument,
  resubmitDocument,
  type DocumentStatusRecord,
  type StatusFilters,
} from "../api/client";

// ---------------------------------------------------------------------------
// Bilingual strings
// ---------------------------------------------------------------------------

type Lang = "en" | "fr";

const strings: Record<Lang, Record<string, string>> = {
  en: {
    uploadTab: "Upload Files",
    statusTab: "Upload Status",
    workspace: "Workspace",
    selectWorkspace: "Select a workspace",
    supportedTypes: "Supported file types",
    dropHere: "Drop files here",
    orBrowse: "or click to browse",
    dragActive: "Release to upload",
    selectedFiles: "Selected files",
    remove: "Remove",
    upload: "Upload",
    uploading: "Uploading...",
    uploadSuccess: "Upload complete",
    uploadError: "Upload failed",
    noFiles: "No files selected",
    timeRange: "Time range",
    statusFilter: "Status",
    all: "All",
    processing: "Processing",
    complete: "Complete",
    error: "Error",
    name: "Name",
    type: "Type",
    status: "Status",
    uploaded: "Uploaded",
    actions: "Actions",
    delete: "Delete",
    resubmit: "Resubmit",
    noDocuments: "No documents found",
    pipeline: "Pipeline",
    confirmDelete: "Delete this document?",
    autoRefresh: "Auto-refreshing",
    language: "Langue",
  },
  fr: {
    uploadTab: "Televerser des fichiers",
    statusTab: "Etat des telechargements",
    workspace: "Espace de travail",
    selectWorkspace: "Selectionner un espace",
    supportedTypes: "Types de fichiers pris en charge",
    dropHere: "Deposez les fichiers ici",
    orBrowse: "ou cliquez pour parcourir",
    dragActive: "Relacher pour televerser",
    selectedFiles: "Fichiers selectionnes",
    remove: "Retirer",
    upload: "Televerser",
    uploading: "Telechargement...",
    uploadSuccess: "Telechargement termine",
    uploadError: "Echec du telechargement",
    noFiles: "Aucun fichier selectionne",
    timeRange: "Periode",
    statusFilter: "Statut",
    all: "Tous",
    processing: "En cours",
    complete: "Termine",
    error: "Erreur",
    name: "Nom",
    type: "Type",
    status: "Statut",
    uploaded: "Televerse",
    actions: "Actions",
    delete: "Supprimer",
    resubmit: "Resoumettre",
    noDocuments: "Aucun document trouve",
    pipeline: "Pipeline",
    confirmDelete: "Supprimer ce document?",
    autoRefresh: "Actualisation auto",
    language: "Language",
  },
};

const TIME_RANGES: Array<{ value: StatusFilters["timeRange"]; label: string }> = [
  { value: "4h", label: "4h" },
  { value: "12h", label: "12h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const STATUS_BADGE: Record<string, string> = {
  processing: "bg-blue-100 text-blue-800",
  extracting: "bg-blue-100 text-blue-800",
  chunking:   "bg-blue-100 text-blue-800",
  enriching:  "bg-blue-100 text-blue-800",
  embedding:  "bg-blue-100 text-blue-800",
  complete:   "bg-green-100 text-green-800",
  indexed:    "bg-green-100 text-green-800",
  error:      "bg-red-100 text-red-800",
  failed:     "bg-red-100 text-red-800",
  indexing:   "bg-amber-100 text-amber-800",
  uploaded:   "bg-gray-100 text-gray-800",
  uploading:  "bg-gray-100 text-gray-800",
};

// ---------------------------------------------------------------------------
// Supported file type groups for display
// ---------------------------------------------------------------------------
const FILE_TYPE_GROUPS = [
  { label: "Documents", extensions: ["pdf", "docx", "doc", "txt"] },
  { label: "Spreadsheets", extensions: ["xlsx", "xls", "csv"] },
  { label: "Web/Data", extensions: ["html", "json", "xml"] },
  { label: "Images", extensions: ["png", "jpg", "gif", "bmp", "tiff"] },
  { label: "Email", extensions: ["eml", "msg"] },
];

const AUTO_REFRESH_INTERVAL = 10_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentsPage() {
  const { user } = useAuth();
  const [lang, setLang] = useState<Lang>("en");
  const t = strings[lang];
  const toggleLang = () => setLang((p) => (p === "en" ? "fr" : "en"));

  // -- Tab state
  const [activeTab, setActiveTab] = useState<"upload" | "status">("upload");

  // -- Workspace
  const workspaces = useMemo(() => user?.workspace_grants ?? [], [user]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");

  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(workspaces[0]);
    }
  }, [workspaces, selectedWorkspace]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          {activeTab === "upload" ? t.uploadTab : t.statusTab}
        </h1>
        <button
          type="button"
          onClick={toggleLang}
          className="text-sm font-medium text-blue-700 underline hover:text-blue-900"
          aria-label={t.language}
        >
          {lang === "en" ? "Francais" : "English"}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
        {(["upload", "status"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
              ${activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            {tab === "upload" ? t.uploadTab : t.statusTab}
          </button>
        ))}
      </div>

      {/* Workspace selector (shared) */}
      <div className="mb-6">
        <label htmlFor="workspace-select" className="mb-1 block text-sm font-medium text-gray-700">
          {t.workspace}
        </label>
        <select
          id="workspace-select"
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {workspaces.length === 0 && (
            <option value="">{t.selectWorkspace}</option>
          )}
          {workspaces.map((ws) => (
            <option key={ws} value={ws}>
              {ws}
            </option>
          ))}
        </select>
      </div>

      {/* Tab panels */}
      <AnimatePresence mode="wait">
        {activeTab === "upload" ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            role="tabpanel"
            aria-label={t.uploadTab}
          >
            <UploadPanel
              workspaceId={selectedWorkspace}
              lang={lang}
              t={t}
            />
          </motion.div>
        ) : (
          <motion.div
            key="status"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            role="tabpanel"
            aria-label={t.statusTab}
          >
            <StatusPanel
              workspaceId={selectedWorkspace}
              lang={lang}
              t={t}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload Panel
// ---------------------------------------------------------------------------

function UploadPanel({
  workspaceId,
  lang,
  t,
}: {
  workspaceId: string;
  lang: Lang;
  t: Record<string, string>;
}) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const unique = newFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...unique];
    });
    setMessage(null);
  }, []);

  const removeFile = useCallback((name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const handleUpload = useCallback(async () => {
    if (!workspaceId || files.length === 0) return;
    setUploading(true);
    setProgress(0);
    setMessage(null);

    try {
      await uploadDocuments(workspaceId, files, setProgress);
      setMessage({ type: "success", text: t.uploadSuccess });
      toast.success(t.uploadSuccess);
      setFiles([]);
    } catch (err) {
      const errText = `${t.uploadError}: ${err instanceof Error ? err.message : String(err)}`;
      setMessage({ type: "error", text: errText });
      toast.error(t.uploadError);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [workspaceId, files, t]);

  return (
    <div className="space-y-6">
      {/* Supported types */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">{t.supportedTypes}</h3>
        <div className="flex flex-wrap gap-3">
          {FILE_TYPE_GROUPS.map((group) => (
            <div key={group.label} className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">{group.label}:</span>
              {group.extensions.map((ext) => (
                <FileTypeIcon key={ext} extension={ext} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <DropZone
        onFiles={addFiles}
        accept={SUPPORTED_EXTENSIONS}
        disabled={uploading || !workspaceId}
        labels={{
          dropHere: t.dropHere,
          orBrowse: t.orBrowse,
          dragActive: t.dragActive,
        }}
      />

      {/* Selected files list */}
      {files.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            {t.selectedFiles} ({files.length})
          </h3>
          <ul className="space-y-1" aria-label={t.selectedFiles}>
            <AnimatePresence>
              {files.map((file) => (
                <motion.li
                  key={file.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileTypeIcon extension={getExtension(file.name)} />
                    <span className="truncate text-sm text-gray-800">{file.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(file.name)}
                    disabled={uploading}
                    className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    aria-label={`${t.remove} ${file.name}`}
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {/* Upload button + progress */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || files.length === 0 || !workspaceId}
          className="rounded-md bg-blue-700 px-6 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? t.uploading : t.upload}
        </button>

        {uploading && (
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{
                  backgroundSize: "200% 100%",
                  animation: "gradient-sweep 2s linear infinite",
                }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">{progress}%</p>
          </div>
        )}
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-md px-4 py-3 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
            role="alert"
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Panel
// ---------------------------------------------------------------------------

function StatusPanel({
  workspaceId,
  lang,
  t,
}: {
  workspaceId: string;
  lang: Lang;
  t: Record<string, string>;
}) {
  const [timeRange, setTimeRange] = useState<StatusFilters["timeRange"]>("24h");
  const [statusFilter, setStatusFilter] = useState<StatusFilters["status"]>("all");
  const [documents, setDocuments] = useState<DocumentStatusRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasProcessing = useMemo(
    () =>
      documents.some((d) =>
        ["uploaded", "processing", "extracting", "chunking", "enriching", "embedding", "indexing"].includes(d.state),
      ),
    [documents],
  );

  const fetchStatuses = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const data = await getDocumentStatuses(workspaceId, {
        timeRange,
        status: statusFilter,
      });
      setDocuments(data);
    } catch {
      // Silently fail on auto-refresh; initial load errors are visible via empty state
    } finally {
      setLoading(false);
    }
  }, [workspaceId, timeRange, statusFilter]);

  // Fetch on filter change
  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // Auto-refresh while processing
  useEffect(() => {
    if (hasProcessing) {
      intervalRef.current = setInterval(fetchStatuses, AUTO_REFRESH_INTERVAL);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasProcessing, fetchStatuses]);

  const handleDelete = useCallback(
    async (docId: string) => {
      if (!window.confirm(t.confirmDelete)) return;
      try {
        await deleteDocument(docId);
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      } catch {
        // Error handling — could add toast
      }
    },
    [t.confirmDelete],
  );

  const handleResubmit = useCallback(async (docId: string) => {
    try {
      await resubmitDocument(docId);
      // Re-fetch to get updated status
      await fetchStatuses();
    } catch {
      // Error handling
    }
  }, [fetchStatuses]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Time range */}
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">{t.timeRange}</legend>
          <div className="flex gap-1">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.value}
                type="button"
                onClick={() => setTimeRange(tr.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors
                  ${timeRange === tr.value ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                aria-pressed={timeRange === tr.value}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Status filter */}
        <div>
          <label htmlFor="status-filter" className="mb-1 block text-sm font-medium text-gray-700">
            {t.statusFilter}
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilters["status"])}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">{t.all}</option>
            <option value="processing">{t.processing}</option>
            <option value="complete">{t.complete}</option>
            <option value="error">{t.error}</option>
          </select>
        </div>

        {/* Auto-refresh indicator */}
        {hasProcessing && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            {t.autoRefresh}
          </div>
        )}
      </div>

      {/* Table */}
      {loading && documents.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Loading...</div>
      ) : documents.length === 0 ? (
        <div className="py-12 text-center text-gray-500">{t.noDocuments}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm" aria-label={t.statusTab}>
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t.name}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t.type}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t.status}</th>
                <th className="hidden px-4 py-3 text-left font-medium text-gray-700 md:table-cell">
                  {t.pipeline}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t.uploaded}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <AnimatePresence>
                {documents.map((doc) => {
                  const ext = getExtension(doc.filename);
                  const badge = STATUS_BADGE[doc.state] ?? STATUS_BADGE.uploaded;

                  return (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="bg-white hover:bg-gray-50"
                    >
                      <td className="max-w-[200px] truncate px-4 py-3 font-medium text-gray-900">
                        {doc.filename}
                      </td>
                      <td className="px-4 py-3">
                        <FileTypeIcon extension={ext} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}>
                          {doc.state}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <PipelineStatusBar
                          currentState={doc.state}
                          compact
                          lang={lang}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {formatDate(doc.uploaded_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {(doc.state === "error" || doc.state === "failed") && (
                            <button
                              type="button"
                              onClick={() => handleResubmit(doc.id)}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                              aria-label={`${t.resubmit} ${doc.filename}`}
                            >
                              {t.resubmit}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                            aria-label={`${t.delete} ${doc.filename}`}
                          >
                            {t.delete}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
