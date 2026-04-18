import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Coins, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useFinOpsMetrics } from "@/lib/api/hooks/useOps";
import type { FinOpsBreakdownEntry } from "@/lib/api/types";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

const cad = (value: number): string =>
  value.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

const toBarSeries = (
  map: Record<string, FinOpsBreakdownEntry>,
): Array<{ label: string; spend: number }> =>
  Object.entries(map)
    .map(([label, entry]) => ({ label, spend: Number(entry?.cost_cad) || 0 }))
    .sort((a, b) => b.spend - a.spend);

export default function Cost() {
  const { data, isLoading, isError, refetch } = useFinOpsMetrics(30);

  const kpis = useMemo(() => {
    if (!data) return null;
    return [
      {
        label: `MTD cost (last ${data.period_days}d)`,
        value: cad(data.total_cost_cad),
        delta: `${data.query_count.toLocaleString()} queries`,
        trend: "flat" as const,
        icon: Coins,
      },
      {
        label: "Forecast (EOM)",
        value: cad(data.forecast_cad),
        delta: "linear projection at current burn",
        trend: "flat" as const,
        icon: TrendingUp,
      },
      {
        label: "Waste score",
        value: `${data.waste_score.toFixed(1)} / 100`,
        delta: "cost concentration · 0 healthy, 100 wasteful",
        trend: "down" as const,
        icon: TrendingDown,
      },
      {
        label: "Chargeback coverage",
        value: `${Math.round(data.chargeback_coverage * 100)}%`,
        delta: "share of spend tagged to a workspace",
        trend: "flat" as const,
        icon: Sparkles,
      },
    ];
  }, [data]);

  const byWorkspace = useMemo(() => (data ? toBarSeries(data.cost_by_workspace) : []), [data]);
  const byClient = useMemo(() => (data ? toBarSeries(data.cost_by_client) : []), [data]);

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold">Cost Command Center</h1>
        <EmptyState
          title="Could not load FinOps metrics"
          description="The backend FinOps endpoint returned an error."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Cost Command Center</h1>
        <p className="mt-2 text-muted-foreground">
          FinOps for agentic AI — attribution from APIM telemetry via <code>/ops/metrics/finops</code>.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !kpis
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ui-card rounded-lg p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-7 w-28" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
            ))
          : kpis.map((k) => (
              <div key={k.label} className="ui-card rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
                  <k.icon className="h-4 w-4 text-product" />
                </div>
                <div className="mt-2 text-2xl font-extrabold">{k.value}</div>
                {k.delta && (
                  <div className="mt-1 text-xs text-muted-foreground">{k.delta}</div>
                )}
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="ui-card rounded-lg p-4 lg:col-span-2">
          <h2 className="text-sm font-bold mb-1">Cost attribution by workspace</h2>
          <p className="text-xs text-muted-foreground mb-3">
            MTD spend per workspace · daily time-series pending backend enhancement
          </p>
          <div className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : byWorkspace.length === 0 ? (
              <EmptyState
                title="No cost data yet"
                description="Spend telemetry will appear once workspaces start producing traffic."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byWorkspace}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => cad(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => cad(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="spend" name="MTD spend" fill="hsl(var(--product))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Cost by client</h2>
          <p className="text-xs text-muted-foreground mb-3">MTD spend</p>
          <div className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : byClient.length === 0 ? (
              <EmptyState title="No client spend" description="Per-client attribution requires at least one chargeback tag." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byClient}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => cad(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => cad(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="spend" name="MTD spend" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="ui-card rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Avg latency</div>
          <div className="mt-2 text-2xl font-extrabold">
            {isLoading || !data ? "—" : `${Math.round(data.avg_latency_ms)} ms`}
          </div>
          <div className="text-xs text-muted-foreground">across {data?.query_count ?? 0} queries</div>
        </div>
        <div className="ui-card rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Avg tokens / query</div>
          <div className="mt-2 text-2xl font-extrabold">
            {isLoading || !data ? "—" : Math.round(data.avg_tokens).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">prompt + completion</div>
        </div>
        <div className="ui-card rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Cost per query</div>
          <div className="mt-2 text-2xl font-extrabold gradient-text">
            {isLoading || !data || data.query_count === 0
              ? "—"
              : (data.total_cost_cad / data.query_count).toLocaleString("en-CA", {
                  style: "currency",
                  currency: "CAD",
                  maximumFractionDigits: 4,
                })}
          </div>
          <div className="text-xs text-muted-foreground">avg, last {data?.period_days ?? 30}d</div>
        </div>
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h2 className="font-bold">Budget alerts</h2>
          <Badge variant="outline" className="ml-auto text-[10px]">backend gap</Badge>
        </div>
        <div className="p-4">
          <EmptyState
            title="Budget alerts pending backend enhancement"
            description="Per-workspace budgets and anomaly detection will surface here once the budgets endpoint ships."
          />
        </div>
      </div>
    </div>
  );
}
