import { COST_DATA, TOKEN_DATA } from "@/lib/mock-data";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Line, ComposedChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, TrendingUp, Coins, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const KPIS = [
  { label: "MTD cost", value: "$18,420", delta: "+12%", trend: "up", icon: Coins },
  { label: "Forecast (EOM)", value: "$26,800", delta: "on track", trend: "flat", icon: TrendingUp },
  { label: "Waste score", value: "7.4 / 100", delta: "-2.1", trend: "down", icon: TrendingDown },
  { label: "Chargeback coverage", value: "96%", delta: "+3%", trend: "up", icon: Sparkles },
];

const TEAMS = [
  { team: "Engineering", spend: 4820 },
  { team: "Legal", spend: 6210 },
  { team: "HR", spend: 1340 },
  { team: "Sales", spend: 2110 },
  { team: "Vendor Risk", spend: 3940 },
];

const ALERTS = [
  { workspace: "Legal Contract Archive", budget: "$5,000/mo", spend: "$6,210", anomaly: "spike", severity: "high" },
  { workspace: "Engineering Runbooks", budget: "$5,000/mo", spend: "$4,820", anomaly: "—", severity: "ok" },
  { workspace: "Vendor Risk Decisions", budget: "$3,000/mo", spend: "$3,940", anomaly: "exceeded", severity: "high" },
  { workspace: "Sales BI Dashboard", budget: "$2,500/mo", spend: "$2,110", anomaly: "—", severity: "ok" },
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export default function Cost() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Cost Command Center</h1>
        <p className="mt-2 text-muted-foreground">FinOps for agentic AI — outcomes, attribution, anomalies.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k) => (
          <div key={k.label} className="ui-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <k.icon className="h-4 w-4 text-product" />
            </div>
            <div className="mt-2 text-2xl font-extrabold">{k.value}</div>
            <div className={`mt-1 text-xs ${k.trend === "up" ? "text-warning" : k.trend === "down" ? "text-success" : "text-muted-foreground"}`}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="ui-card rounded-lg p-4 lg:col-span-2">
          <h2 className="text-sm font-bold mb-1">Cost attribution by workspace</h2>
          <p className="text-xs text-muted-foreground mb-3">30-day stacked area</p>
          <div className="h-64">
            {COST_DATA.length === 0 ? (
              <EmptyState title="No cost data yet" description="Spend telemetry will appear here once workspaces start producing traffic." />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={COST_DATA}>
                <defs>
                  {["HR", "Engineering", "Legal", "BI", "Vendor"].map((k, i) => (
                    <linearGradient key={k} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={`hsl(var(--${i % 2 ? "accent" : "product"}))`} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={`hsl(var(--${i % 2 ? "accent" : "product"}))`} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toFixed(0)}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="HR" stackId="1" stroke="hsl(var(--accent))" fill="url(#g0)" />
                <Area type="monotone" dataKey="Engineering" stackId="1" stroke="hsl(var(--product))" fill="url(#g1)" />
                <Area type="monotone" dataKey="Legal" stackId="1" stroke="hsl(var(--accent))" fill="url(#g2)" />
                <Area type="monotone" dataKey="BI" stackId="1" stroke="hsl(var(--product))" fill="url(#g3)" />
                <Area type="monotone" dataKey="Vendor" stackId="1" stroke="hsl(var(--accent))" fill="url(#g4)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Per-team breakdown</h2>
          <p className="text-xs text-muted-foreground mb-3">MTD spend</p>
          <div className="h-64">
            {TEAMS.length === 0 ? (
              <EmptyState title="No team spend" description="Per-team attribution requires at least one chargeback tag." />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TEAMS}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="team" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="spend" name="MTD spend (USD)" fill="hsl(var(--product))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Token economics chart */}
      <div className="ui-card rounded-lg p-4">
        <h2 className="text-sm font-bold mb-1">Token economics</h2>
        <p className="text-xs text-muted-foreground mb-3">Input vs output tokens (M) and cache-hit rate · 14d</p>
        <div className="h-64">
          {TOKEN_DATA.length === 0 ? (
            <EmptyState title="No token telemetry" description="Token usage will appear once the gateway begins logging requests." />
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={TOKEN_DATA}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Tokens (M)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => name === "Cache hit" ? `${(v * 100).toFixed(0)}%` : `${v.toFixed(2)}M`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="input" name="Input" stackId="t" fill="hsl(var(--accent))" />
              <Bar yAxisId="left" dataKey="output" name="Output" stackId="t" fill="hsl(var(--product))" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="cached" name="Cache hit" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="ui-card rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Outcome metric</div>
          <div className="mt-2 text-2xl font-extrabold gradient-text">$0.82</div>
          <div className="text-xs text-muted-foreground">per resolved query</div>
        </div>
        <div className="ui-card rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Outcome metric</div>
          <div className="mt-2 text-2xl font-extrabold gradient-text">$1.14</div>
          <div className="text-xs text-muted-foreground">per citation-accurate answer</div>
        </div>
        <div className="ui-card rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Token economics</div>
          <div className="mt-2 flex items-baseline gap-3">
            <div><div className="text-lg font-extrabold">62%</div><div className="text-[10px] text-muted-foreground">cache hit</div></div>
            <div><div className="text-lg font-extrabold">1.4M</div><div className="text-[10px] text-muted-foreground">in / day</div></div>
            <div><div className="text-lg font-extrabold">380k</div><div className="text-[10px] text-muted-foreground">out / day</div></div>
          </div>
        </div>
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h2 className="font-bold">Budget alerts</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr><th className="text-left p-3 font-medium">Workspace</th><th className="text-left p-3 font-medium">Budget</th><th className="text-left p-3 font-medium">Spend</th><th className="text-left p-3 font-medium">Anomaly</th></tr>
          </thead>
          <tbody>
            {ALERTS.map((a) => (
              <tr key={a.workspace} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{a.workspace}</td>
                <td className="p-3 text-muted-foreground">{a.budget}</td>
                <td className="p-3 font-mono">{a.spend}</td>
                <td className="p-3"><Badge variant="outline" className={a.severity === "high" ? "border-danger/40 text-danger" : "border-success/40 text-success"}>{a.anomaly}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
