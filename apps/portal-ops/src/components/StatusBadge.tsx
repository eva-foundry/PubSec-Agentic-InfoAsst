// ---------------------------------------------------------------------------
// StatusBadge — color-coded status indicator with optional pulse animation
// ---------------------------------------------------------------------------

export interface StatusBadgeProps {
  status: 'healthy' | 'degraded' | 'down' | 'success' | 'failed' | 'warning';
  label?: string;
  pulse?: boolean;
}

const STATUS_CONFIG: Record<
  StatusBadgeProps['status'],
  { dotColor: string; bgColor: string; textColor: string }
> = {
  healthy: {
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
  },
  success: {
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
  },
  degraded: {
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
  },
  warning: {
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
  },
  down: {
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
  },
  failed: {
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
  },
};

export function StatusBadge({ status, label, pulse = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}
      role="status"
      aria-label={displayLabel}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dotColor}`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${config.dotColor}`}
        />
      </span>
      {displayLabel}
    </span>
  );
}
