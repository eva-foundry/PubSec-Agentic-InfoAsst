import { cn } from "@/lib/utils";

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("h-64 w-full rounded-md bg-muted/40 animate-pulse relative overflow-hidden", className)} aria-busy="true" aria-label="Loading chart">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.04] to-transparent animate-shimmer" />
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ui-card rounded-lg p-4 space-y-2 animate-pulse" aria-busy="true">
      <div className="h-3 w-1/3 rounded bg-muted/60" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-2.5 rounded bg-muted/40" style={{ width: `${60 + Math.random() * 35}%` }} />
      ))}
    </div>
  );
}
