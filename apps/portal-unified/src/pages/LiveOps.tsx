import { useMemo, useState } from "react";
import { SERVICES, LATENCY_24H } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Search, Bell, Activity, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

const SLA_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  burn: Math.max(0, 100 - i * 1.2 - Math.random() * 4),
}));

interface Incident {
  id: string;
  time: string;
  service: string;
  title: string;
  status: "ongoing" | "monitoring" | "resolved";
  severity: "low" | "warning" | "high";
  summary: string;
  timeline: { t: string; note: string }[];
}

const INCIDENTS: Incident[] = [
  {
    id: "INC-2041", time: "2025-04-15 09:42", service: "Vector Search", title: "Increased p99 latency",
    status: "ongoing", severity: "warning",
    summary: "p99 retrieval latency drifted from 320ms baseline to 540ms after the HNSW M=32 migration.",
    timeline: [
      { t: "09:42", note: "Alert: p99 > 500ms for 5m" },
      { t: "09:55", note: "Auto-mitigation: cache shedding engaged" },
      { t: "10:14", note: "On-call paged @sre-rotation" },
      { t: "10:32", note: "Hypothesis: index warm-up incomplete on replica-2" },
    ],
  },
  {
    id: "INC-2038", time: "2025-04-13 22:11", service: "Document Extraction", title: "OCR worker pool exhausted",
    status: "resolved", severity: "high",
    summary: "Backlog of 1,200+ PDFs from Legal workspace saturated the OCR worker pool for ~38 minutes.",
    timeline: [
      { t: "22:11", note: "Alert: queue depth > 1000" },
      { t: "22:14", note: "Scaled OCR workers 8 → 24" },
      { t: "22:49", note: "Backlog drained, returning to baseline" },
      { t: "23:02", note: "Resolved" },
    ],
  },
  {
    id: "INC-2031", time: "2025-04-10 14:05", service: "Gateway", title: "Brief 502 spike (47s)",
    status: "resolved", severity: "low",
    summary: "Rolling deploy on gateway caused brief 502s during connection drain.",
    timeline: [
      { t: "14:05", note: "Alert: 502 rate > 1%" },
      { t: "14:05:47", note: "Self-resolved after deploy completion" },
    ],
  },
];

const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

export default function LiveOps() {
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "degraded" | "down">("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Incident | null>(null);

  const visibleServices = useMemo(
    () => SERVICES
      .filter((s) => statusFilter === "all" || s.status === statusFilter)
      .filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [statusFilter, query],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold">LiveOps Health</h1>
          <p className="mt-2 text-muted-foreground">Service health, SLA, incidents, capacity, degradation tier.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="border-warning/40 text-warning">Degradation tier: T2 (reduced)</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.success("Subscribed to status updates", { description: "You'll be paged for any T2+ event." })}
          >
            <Bell className="h-3.5 w-3.5 mr-1.5" />Subscribe
          </Button>
        </div>
      </div>

      <div className="ui-card rounded-lg p-3 flex items-center gap-2 flex-wrap">
        <Activity className="h-4 w-4 text-product" />
        <span className="text-sm font-bold">Services</span>
        <div className="flex items-center rounded-md border border-border p-0.5 text-xs ml-2">
          {(["all", "ok", "degraded", "down"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={cn(
                "rounded px-2 py-1 font-medium transition-colors capitalize",
                statusFilter === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >{s}</button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter services…"
            className="h-8 pl-8 text-xs"
            aria-label="Filter services"
          />
        </div>
      </div>

      {visibleServices.length === 0 ? (
        <EmptyState title="No services match" description="Adjust your filter to see services." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleServices.map((s) => (
            <div key={s.name} className="ui-card rounded-lg p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold">{s.name}</div>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={cn("h-2 w-2 rounded-full", s.status === "ok" ? "bg-success" : s.status === "degraded" ? "bg-warning" : "bg-danger")} aria-hidden />
                  <span className="capitalize">{s.status}</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-muted-foreground">Uptime</div><div className="font-mono font-bold">{s.uptime}%</div></div>
                <div><div className="text-muted-foreground">p50 latency</div><div className="font-mono font-bold">{s.latency}ms</div></div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full", s.status === "ok" ? "bg-success" : s.status === "degraded" ? "bg-warning" : "bg-danger")}
                  style={{ width: `${s.uptime}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">SLA burn-down</h2>
          <p className="text-xs text-muted-foreground mb-3">Error budget remaining (30d)</p>
          <div className="h-56">
            {SLA_DATA.length === 0 ? (
              <EmptyState title="No SLA telemetry" description="Burn-down appears after the first full SLA window." />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SLA_DATA}>
                <defs>
                  <linearGradient id="sla" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--product))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--product))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${Math.round(v)}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="burn" name="Budget remaining" stroke="hsl(var(--product))" fill="url(#sla)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-3">Capacity forecast</h2>
          <ul className="space-y-3 text-sm">
            {[
              { label: "Vector index storage", value: 68, ceiling: 80 },
              { label: "LLM concurrency", value: 42, ceiling: 60 },
              { label: "Embedding throughput", value: 71, ceiling: 85 },
              { label: "Object store", value: 29, ceiling: 50 },
            ].map((c) => (
              <li key={c.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{c.label}</span>
                  <span className="font-mono text-muted-foreground">{c.value}% / {c.ceiling}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden relative">
                  <div
                    className={cn(
                      "h-full",
                      c.value > c.ceiling * 0.9 ? "bg-danger" : c.value > c.ceiling * 0.75 ? "bg-warning" : "bg-product",
                    )}
                    style={{ width: `${c.value}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-px bg-foreground/40"
                    style={{ left: `${c.ceiling}%` }}
                    aria-hidden
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Gateway latency 24h */}
      <div className="ui-card rounded-lg p-4">
        <h2 className="text-sm font-bold mb-1">Gateway latency (24h)</h2>
        <p className="text-xs text-muted-foreground mb-3">p50 · p95 · p99 in milliseconds</p>
        <div className="h-64">
          {LATENCY_24H.length === 0 ? (
            <EmptyState title="No latency samples" description="Latency percentiles populate as the gateway processes traffic." />
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={LATENCY_24H}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}ms`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}ms`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="p50" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="p95" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="p99" stroke="hsl(var(--danger))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-product" />
          <h2 className="font-bold">Incident timeline</h2>
        </div>
        <ul className="divide-y divide-border">
          {INCIDENTS.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => setActive(i)}
                className="w-full text-left p-4 flex items-center gap-3 flex-wrap hover:bg-muted/40 transition-colors"
              >
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  i.severity === "high" ? "bg-danger" : i.severity === "warning" ? "bg-warning" : "bg-muted-foreground"
                )} aria-hidden />
                <div className="text-xs font-mono text-muted-foreground w-36">{i.time}</div>
                <div className="font-medium flex-1 min-w-0 truncate">{i.service}: {i.title}</div>
                <Badge variant="outline" className="font-mono text-[10px]">{i.id}</Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    i.status === "ongoing" && "border-danger/40 text-danger",
                    i.status === "monitoring" && "border-warning/40 text-warning",
                    i.status === "resolved" && "border-success/40 text-success",
                  )}
                >{i.status}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{active.id}</span>
                  {active.title}
                </SheetTitle>
                <SheetDescription>{active.service} · {active.time}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <p className="text-sm leading-relaxed">{active.summary}</p>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Timeline</h3>
                  <ol className="space-y-2">
                    {active.timeline.map((t, idx) => (
                      <li key={idx} className="flex gap-3 text-sm">
                        <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{t.t}</span>
                        <span>{t.note}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => toast.success(`Postmortem started for ${active.id}`)}
                >Start postmortem</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
