import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertCircle, Search } from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { useIncidents, useLiveOpsMetrics, useOpsHealth } from "@/lib/api/hooks/useOps";
import type { OpsHealth } from "@/lib/api/types";

const SEVERITY_TONE: Record<string, string> = {
  "sev-1": "border-danger/40 text-danger",
  "sev-2": "border-warning/40 text-warning",
  "sev-3": "border-product/40 text-product",
};

const STATUS_TONE: Record<string, string> = {
  ongoing: "border-danger/40 text-danger",
  monitoring: "border-warning/40 text-warning",
  resolved: "border-success/40 text-success",
};

const shortHour = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:00`;
};

type ServiceStatus = "healthy" | "degraded" | "down";

const statusToneClass: Record<ServiceStatus, string> = {
  healthy: "border-success/40 text-success",
  degraded: "border-warning/40 text-warning",
  down: "border-danger/40 text-danger",
};

const normalize = (s: string): ServiceStatus => {
  const v = s.toLowerCase();
  if (v === "ok" || v === "healthy" || v === "up") return "healthy";
  if (v === "degraded" || v === "warning") return "degraded";
  return "down";
};

export default function LiveOps() {
  const liveops = useLiveOpsMetrics();
  const liveopsHourly = useLiveOpsMetrics("hour", 24);
  const incidents = useIncidents();
  const health = useOpsHealth();
  const latencySeries = (liveopsHourly.data?.latency_24h ?? []).map((p) => ({
    ...p,
    hour: shortHour(p.hour),
  }));
  const [statusFilter, setStatusFilter] = useState<"all" | ServiceStatus>("all");
  const [query, setQuery] = useState("");

  const services = useMemo(() => {
    const all: OpsHealth["services"] = health.data?.services ?? [];
    return all
      .map((s) => ({ ...s, _status: normalize(s.status) as ServiceStatus }))
      .filter((s) => statusFilter === "all" || s._status === statusFilter)
      .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  }, [health.data, statusFilter, query]);

  const kpis = [
    {
      label: "Uptime (30d)",
      value: liveops.data ? `${liveops.data.uptime_percent.toFixed(2)}%` : null,
    },
    {
      label: "Active incidents",
      value: liveops.data ? String(liveops.data.incident_count) : null,
    },
    {
      label: "SLA breaches",
      value: liveops.data ? String(liveops.data.sla_breach_count) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">LiveOps</h1>
        <p className="mt-2 text-muted-foreground">
          Service health from <code>/ops/health</code> and rollups from <code>/ops/metrics/liveops</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="ui-card rounded-lg p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-2xl font-extrabold">
              {liveops.isLoading ? <Skeleton className="h-7 w-20" /> : k.value ?? "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2 flex-wrap">
          <Activity className="h-4 w-4 text-product" />
          <h2 className="font-bold">Service health</h2>
          <Badge variant="outline" className="text-[10px]">{services.length} services</Badge>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
              {(["all", "healthy", "degraded", "down"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  aria-pressed={statusFilter === s}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium transition-colors capitalize",
                    statusFilter === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter service…"
                className="pl-8 h-8 text-xs w-56"
                aria-label="Filter services"
              />
            </div>
          </div>
        </div>
        {health.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : services.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No services match" description="Clear filters or check the health endpoint." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th scope="col" className="text-left p-3 font-medium">Service</th>
                <th scope="col" className="text-left p-3 font-medium">Status</th>
                <th scope="col" className="text-left p-3 font-medium">Latency</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={statusToneClass[s._status]}>{s._status}</Badge>
                  </td>
                  <td className="p-3 font-mono text-muted-foreground">
                    {s.latency_ms !== undefined && s.latency_ms !== null ? `${s.latency_ms} ms` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ui-card rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-warning" />
            <h2 className="font-bold">24h latency</h2>
            <Badge variant="outline" className="ml-auto text-[10px]">p50 · p99</Badge>
          </div>
          {liveopsHourly.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : liveopsHourly.isError || latencySeries.length === 0 ? (
            <EmptyState title="Latency series unavailable" description={liveopsHourly.error?.message} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={latencySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="p50_ms" stroke="hsl(var(--product))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p99_ms" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="ui-card rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-warning" />
            <h2 className="font-bold">Incident feed</h2>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {incidents.data?.length ?? 0} rows
            </Badge>
          </div>
          {incidents.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : incidents.isError ? (
            <EmptyState title="Incidents unavailable" description={incidents.error?.message} />
          ) : (incidents.data?.length ?? 0) === 0 ? (
            <EmptyState title="No incidents recorded" description="The incident feed is empty." />
          ) : (
            <ul className="space-y-2 text-xs">
              {incidents.data!.map((i) => (
                <li key={i.id} className="flex items-start gap-2 pb-2 border-b border-border last:border-0">
                  <Badge variant="outline" className={SEVERITY_TONE[i.severity] ?? ""}>{i.severity}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{i.title}</div>
                      <Badge variant="outline" className={cn("ml-auto", STATUS_TONE[i.status] ?? "")}>
                        {i.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {i.service} · {new Date(i.started_at).toLocaleString()}
                    </div>
                    {i.summary && <div className="text-muted-foreground mt-0.5 truncate">{i.summary}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
