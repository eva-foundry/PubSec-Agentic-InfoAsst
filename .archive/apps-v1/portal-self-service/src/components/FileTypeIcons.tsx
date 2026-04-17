// ---------------------------------------------------------------------------
// FileTypeIcon — maps file extensions to visual indicators
// ---------------------------------------------------------------------------

interface FileTypeIconProps {
  extension: string;
  className?: string;
}

const ICON_MAP: Record<string, { label: string; color: string; abbr: string }> = {
  pdf:  { label: "PDF",   color: "bg-red-100 text-red-700",    abbr: "PDF" },
  docx: { label: "Word",  color: "bg-blue-100 text-blue-700",  abbr: "DOC" },
  doc:  { label: "Word",  color: "bg-blue-100 text-blue-700",  abbr: "DOC" },
  xlsx: { label: "Excel", color: "bg-green-100 text-green-700", abbr: "XLS" },
  xls:  { label: "Excel", color: "bg-green-100 text-green-700", abbr: "XLS" },
  csv:  { label: "CSV",   color: "bg-green-100 text-green-700", abbr: "CSV" },
  txt:  { label: "Text",  color: "bg-gray-100 text-gray-700",  abbr: "TXT" },
  html: { label: "HTML",  color: "bg-orange-100 text-orange-700", abbr: "HTM" },
  json: { label: "JSON",  color: "bg-yellow-100 text-yellow-700", abbr: "JSN" },
  xml:  { label: "XML",   color: "bg-purple-100 text-purple-700", abbr: "XML" },
  png:  { label: "Image", color: "bg-pink-100 text-pink-700",  abbr: "PNG" },
  jpg:  { label: "Image", color: "bg-pink-100 text-pink-700",  abbr: "JPG" },
  jpeg: { label: "Image", color: "bg-pink-100 text-pink-700",  abbr: "JPG" },
  gif:  { label: "Image", color: "bg-pink-100 text-pink-700",  abbr: "GIF" },
  bmp:  { label: "Image", color: "bg-pink-100 text-pink-700",  abbr: "BMP" },
  tiff: { label: "Image", color: "bg-pink-100 text-pink-700",  abbr: "TIF" },
  eml:  { label: "Email", color: "bg-indigo-100 text-indigo-700", abbr: "EML" },
  msg:  { label: "Email", color: "bg-indigo-100 text-indigo-700", abbr: "MSG" },
};

const DEFAULT_ICON = { label: "File", color: "bg-gray-100 text-gray-600", abbr: "---" };

export function FileTypeIcon({ extension, className = "" }: FileTypeIconProps) {
  const ext = extension.replace(/^\./, "").toLowerCase();
  const icon = ICON_MAP[ext] ?? DEFAULT_ICON;

  return (
    <span
      className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide ${icon.color} ${className}`}
      aria-label={icon.label}
      title={icon.label}
    >
      {icon.abbr}
    </span>
  );
}

/** Supported file extensions for upload validation. */
export const SUPPORTED_EXTENSIONS = [
  ".pdf", ".docx", ".doc",
  ".xlsx", ".xls", ".csv",
  ".txt", ".html", ".json", ".xml",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff",
  ".eml", ".msg",
];

/** Returns the file extension from a filename, lowercased. */
export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}
