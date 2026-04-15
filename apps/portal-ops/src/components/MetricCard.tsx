// ---------------------------------------------------------------------------
// MetricCard — reusable KPI card with count-up animation and trend indicator
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down' | 'flat'; percentage: number };
  /** Whether 'up' is good (e.g. resolution rate) or bad (e.g. cost). Default: true */
  upIsGood?: boolean;
  color?: string;
  icon?: React.ReactNode;
}

// Simple count-up hook for numeric values
function useCountUp(target: number, duration: number = 800): number {
  const [current, setCurrent] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startTime.current = null;

    const animate = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

function TrendArrow({
  direction,
  percentage,
  upIsGood,
}: {
  direction: 'up' | 'down' | 'flat';
  percentage: number;
  upIsGood: boolean;
}) {
  const isPositive =
    direction === 'flat'
      ? true
      : direction === 'up'
        ? upIsGood
        : !upIsGood;

  const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
  const bgClass = isPositive ? 'bg-green-50' : 'bg-red-50';

  const arrow =
    direction === 'up' ? '\u2191' : direction === 'down' ? '\u2193' : '\u2192';

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass} ${bgClass}`}
      aria-label={`${direction} ${percentage}%`}
    >
      {arrow} {percentage.toFixed(1)}%
    </span>
  );
}

export function MetricCard({
  label,
  value,
  trend,
  upIsGood = true,
  color,
  icon,
}: MetricCardProps) {
  const isNumeric = typeof value === 'number';
  const animatedValue = useCountUp(isNumeric ? value : 0, 800);

  const displayValue = isNumeric
    ? value >= 1000
      ? animatedValue.toLocaleString('en-CA', {
          maximumFractionDigits: value % 1 === 0 ? 0 : 2,
        })
      : animatedValue.toFixed(value % 1 === 0 ? 0 : 1)
    : value;

  const borderColor = color ?? '#2563eb';

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
      role="group"
      aria-label={`${label}: ${typeof value === 'number' ? value : displayValue}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{displayValue}</p>
        </div>
        {icon && (
          <div className="ml-2 flex-shrink-0 text-gray-400" aria-hidden="true">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2">
          <TrendArrow
            direction={trend.direction}
            percentage={trend.percentage}
            upIsGood={upIsGood}
          />
        </div>
      )}
    </div>
  );
}
