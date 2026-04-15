// ---------------------------------------------------------------------------
// Skeleton loading components — shimmer placeholders
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Base Skeleton
// ---------------------------------------------------------------------------

export interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width, height, className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] ${className}`}
      style={{ width, height }}
      role="presentation"
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// SkeletonText — multiple lines with shorter last line
// ---------------------------------------------------------------------------

export interface SkeletonTextProps {
  lines: number;
}

export function SkeletonText({ lines }: SkeletonTextProps) {
  return (
    <div className="space-y-2" role="presentation" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="animate-shimmer h-3 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonCard — card placeholder with header + text lines
// ---------------------------------------------------------------------------

export function SkeletonCard() {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-5"
      role="presentation"
      aria-hidden="true"
    >
      {/* Header area */}
      <div className="mb-4 flex items-center gap-3">
        <Skeleton width="40px" height="40px" className="rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton height="14px" width="50%" />
          <Skeleton height="10px" width="30%" />
        </div>
      </div>
      {/* Text lines */}
      <SkeletonText lines={3} />
    </div>
  );
}
