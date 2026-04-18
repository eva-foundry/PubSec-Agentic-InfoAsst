import { useState, useEffect, useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useWorkspaces } from "@/lib/api/hooks/useWorkspaces";
import { useAIOpsMetrics, useDriftMetrics } from "@/lib/api/hooks/useOps";
import type { DriftWindow } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const SEVERITY_TONE: Record<string, string> = {
  info: "border-product/40 text-product",
  warning: "border-warning/40 text-warning",
  critical: "border-danger/40 text-danger",
};

const shortDay = (iso: string) => iso.slice(5); // MM-DD

export default function Drift() {
  const workspaces = useWorkspaces();
  const aiops = useAIOpsMetrics();
  const [window, setWindow] = useState<DriftWindow>("30d");
  const [workspace, setWorkspace] = useState<string>("");

  useEffect(() => {
    if (!workspace && workspaces.data && workspaces.data.length > 0) {
      setWorkspace(workspaces.data[0].id);
    }
  }, [workspace, workspaces.data]);

  const drift = useDriftMetrics(workspace || null, window);

  const modelSeries = useMemo(
    () => (drift.data?.model ?? []).map((p) => ({ ...p, day: shortDay(p.day) })),
    [drift.data],
  );
  const promptSeries = useMemo(
    () => (drift.data?.prompt ?? []).map((p) => ({ ...p, day: shortDay(p.day) })),
    [drift.data],
  );
  const corpusSeries = useMemo(
    () => (drift.data?.corpus ?? []).map((p) => ({ ...p, day: shortDay(p.day) })),
    [drift.data],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Drift Monitor</h1>
        <p className="mt-2 text-muted-foreground">
          Model, prompt, and corpus drift signals over a rolling window.
        </p>
      </div>

      <div className="ui-card rounded-lg p-3 flex items-center gap-2 flex-wrap">
        <Select value={workspace} onValueChange={setWorkspace} disabled={workspaces.isLoading}>
          <SelectTrigger className="h-8 w-[240px] text-xs" aria-label="Workspace">
            <SelectValue placeholder={workspaces.isLoading ? "Loading…" : "All workspaces"} />
          </SelectTrigger>
          <SelectContent>
            {(workspaces.data ?? []).map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
          {(["7d", "30d", "90d"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              aria-pressed={window === w}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                window === w ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {w}
            </button>
          ))}
        </div>
        {drift.data && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            {drift.data.alerts.length} open alert{drift.data.alerts.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {drift.data && drift.data.alerts.length > 0 && (
        <div className="ui-card rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-bold">Open alerts</h2>
          <ul className="space-y-2">
            {drift.data.alerts.map((a, i) => (
              <li key={`${a.type}-${i}`} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className={SEVERITY_TONE[a.severity] ?? ""}>
                  {a.severity}
                </Badge>
                <div>
                  <div className="font-medium">{a.message}</div>
                  <div className="text-muted-foreground">
                    {a.type} drift · since {a.since}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Model drift</h2>
          <p className="text-xs text-muted-foreground mb-3">Embedding distribution PSI · {window}</p>
          {drift.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : drift.isError ? (
            <EmptyState title="Could not load drift" description={drift.error?.message} />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={modelSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="psi" stroke="hsl(var(--product))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Prompt drift</h2>
          <p className="text-xs text-muted-foreground mb-3">Output lexical shift · {window}</p>
          {drift.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : drift.isError ? (
            <EmptyState title="Could not load drift" description={drift.error?.message} />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={promptSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="lexical_shift" stroke="hsl(var(--product))" fill="hsl(var(--product) / 0.3)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Corpus drift</h2>
          <p className="text-xs text-muted-foreground mb-3">Stale-doc % · {window}</p>
          {drift.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : drift.isError ? (
            <EmptyState title="Could not load drift" description={drift.error?.message} />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={corpusSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="stale_pct" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="ui-card rounded-lg p-4">
        <h2 className="text-sm font-bold mb-3">Current AIOps snapshot</h2>
        {aiops.isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : aiops.isError ? (
          <EmptyState title="AIOps metrics unavailable" description={aiops.error?.message} />
        ) : aiops.data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Confidence</div>
              <div className="text-lg font-bold">{(aiops.data.avg_confidence * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Groundedness</div>
              <div className="text-lg font-bold">{(aiops.data.groundedness * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Calibration gap</div>
              <div className="text-lg font-bold">{(aiops.data.calibration_gap * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Escalation rate</div>
              <div className="text-lg font-bold">{(aiops.data.escalation_rate * 100).toFixed(1)}%</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
