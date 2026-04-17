import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WORKSPACES } from "@/lib/mock-data";
import { TrendingDown, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend,
} from "recharts";

type WindowKey = "7d" | "30d" | "90d";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildSeries(window: WindowKey, seedBase: number) {
  const days = window === "7d" ? 7 : window === "30d" ? 30 : 90;
  const rand = seeded(seedBase);
  return Array.from({ length: days }, (_, i) => {
    const decay = i / days;
    const noise = (rand() - 0.5) * 0.06;
    return {
      day: `D-${days - i}`,
      groundedness: Math.max(0.55, Math.min(0.98, 0.92 - decay * 0.08 + noise)),
      relevance: Math.max(0.55, Math.min(0.98, 0.89 - decay * 0.06 + (rand() - 0.5) * 0.05)),
      coherence: Math.max(0.55, Math.min(0.98, 0.93 - decay * 0.03 + (rand() - 0.5) * 0.04)),
      refusalRate: Math.max(0, Math.min(0.4, 0.06 + decay * 0.05 + (rand() - 0.5) * 0.04)),
    };
  });
}

function buildHeatmap(seedBase: number) {
  const rand = seeded(seedBase + 99);
  return WORKSPACES.map((w, wi) => ({
    workspace: w.name,
    cells: Array.from({ length: 14 }, (_, i) => {
      const v = 0.92 - (wi * 0.01) - (i / 14) * 0.05 + (rand() - 0.5) * 0.08;
      return Math.max(0.6, Math.min(0.99, v));
    }),
  }));
}

function colorFor(v: number) {
  if (v >= 0.88) return "hsl(var(--success) / 0.85)";
  if (v >= 0.82) return "hsl(var(--success) / 0.45)";
  if (v >= 0.75) return "hsl(var(--warning) / 0.55)";
  if (v >= 0.7) return "hsl(var(--warning) / 0.8)";
  return "hsl(var(--danger) / 0.8)";
}

export default function Drift() {
  const [windowKey, setWindowKey] = useState<WindowKey>("30d");
  const [threshold, setThreshold] = useState(0.8);

  const series = useMemo(() => buildSeries(windowKey, 42), [windowKey]);
  const heatmap = useMemo(() => buildHeatmap(7), []);

  const latest = series[series.length - 1];
  const first = series[0];
  const delta = (k: keyof typeof latest) =>
    typeof latest[k] === "number" && typeof first[k] === "number"
      ? (latest[k] as number) - (first[k] as number)
      : 0;

  const breaches = series.filter((s) => s.groundedness < threshold).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-product" />
            <h1 className="text-2xl font-extrabold tracking-tight">Drift Monitor</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Track quality metrics over time and detect degradation before it reaches users.
            Alerts fire when groundedness crosses your threshold.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={windowKey} onValueChange={(v) => setWindowKey(v as WindowKey)}>
            <SelectTrigger className="h-9 w-[120px] text-xs" aria-label="Time window"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">Configure alerts</Button>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { k: "groundedness", label: "Groundedness", value: latest.groundedness, lowerIsBad: false },
          { k: "relevance", label: "Relevance", value: latest.relevance, lowerIsBad: false },
          { k: "coherence", label: "Coherence", value: latest.coherence, lowerIsBad: false },
          { k: "refusalRate", label: "Refusal rate", value: latest.refusalRate, lowerIsBad: true },
        ].map((m) => {
          const d = delta(m.k as keyof typeof latest);
          const bad = m.lowerIsBad ? d > 0.01 : d < -0.01;
          const good = m.lowerIsBad ? d < -0.01 : d > 0.01;
          return (
            <Card key={m.label} className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
              <div className="mt-1 text-2xl font-extrabold font-mono">
                {(m.value * 100).toFixed(1)}%
              </div>
              <div
                className={cn(
                  "mt-0.5 text-xs flex items-center gap-1",
                  good && "text-success",
                  bad && "text-danger",
                  !good && !bad && "text-muted-foreground",
                )}
              >
                {d >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {(d * 100).toFixed(2)} pts vs window start
              </div>
            </Card>
          );
        })}
      </div>

      {/* Trend chart */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold">Quality trend</div>
            <div className="text-xs text-muted-foreground">
              Threshold {(threshold * 100).toFixed(0)}% — {breaches} breach{breaches === 1 ? "" : "es"} this window
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="thr" className="text-xs text-muted-foreground">Threshold</label>
            <input
              id="thr"
              type="range"
              min={0.6}
              max={0.95}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="accent-[hsl(var(--product))] w-32"
            />
            <span className="font-mono text-xs w-10 text-right">{threshold.toFixed(2)}</span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis domain={[0.5, 1]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => `${(v * 100).toFixed(1)}%`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={threshold} stroke="hsl(var(--danger))" strokeDasharray="4 4" label={{ value: "alert", fill: "hsl(var(--danger))", fontSize: 10, position: "right" }} />
              <Line type="monotone" dataKey="groundedness" stroke="hsl(var(--product))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="relevance" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="coherence" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-workspace heatmap */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Per-workspace groundedness — last 14 days</div>
            <div className="text-xs text-muted-foreground">Each cell = daily mean groundedness</div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-muted-foreground">low</span>
            <div className="flex h-2 w-32 rounded-full overflow-hidden">
              {[0.65, 0.72, 0.78, 0.84, 0.9, 0.95].map((v) => (
                <div key={v} className="flex-1" style={{ background: colorFor(v) }} />
              ))}
            </div>
            <span className="text-muted-foreground">high</span>
          </div>
        </div>
        <div className="space-y-1">
          {heatmap.map((row) => (
            <div key={row.workspace} className="flex items-center gap-2">
              <div className="w-44 truncate text-xs text-muted-foreground">{row.workspace}</div>
              <div className="flex-1 grid grid-cols-14 gap-0.5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
                {row.cells.map((v, i) => (
                  <div
                    key={i}
                    title={`${row.workspace} · D-${14 - i} · ${(v * 100).toFixed(1)}%`}
                    className="h-6 rounded-sm transition-transform hover:scale-110"
                    style={{ background: colorFor(v) }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Active alerts */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <div className="text-sm font-semibold">Active alerts</div>
          <Badge variant="outline" className="ml-auto text-[10px]">{breaches}</Badge>
        </div>
        {breaches === 0 ? (
          <div className="text-sm text-muted-foreground">No threshold breaches in the selected window.</div>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {series
              .map((s, i) => ({ ...s, idx: i }))
              .filter((s) => s.groundedness < threshold)
              .slice(-5)
              .map((s) => (
                <li key={s.idx} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.day}</div>
                    <div className="text-xs text-muted-foreground">
                      Groundedness {(s.groundedness * 100).toFixed(1)}% &lt; threshold {(threshold * 100).toFixed(0)}%
                    </div>
                  </div>
                  <Badge variant="outline" className="border-danger/40 text-danger text-[10px] uppercase">
                    breach
                  </Badge>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
