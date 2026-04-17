import { QUALITY_DATA, CALIBRATION_DATA, HITL_DATA } from "@/lib/mock-data";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, Legend, ReferenceLine } from "recharts";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const HEATMAP = [
  { idx: "hr-handbook", days: [1, 0, 2, 1, 0, 3, 1, 0, 0, 2, 1, 0, 0, 1] },
  { idx: "eng-runbooks", days: [0, 1, 0, 0, 2, 1, 0, 1, 0, 0, 1, 0, 0, 1] },
  { idx: "legal-contracts", days: [4, 5, 6, 5, 7, 8, 9, 7, 6, 5, 4, 3, 2, 4] },
  { idx: "sales-bi", days: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
  { idx: "vendor-risk", days: [2, 3, 4, 3, 5, 6, 4, 3, 2, 1, 2, 3, 4, 3] },
];

const TRACE = [
  { span: "gateway.intake", ms: 12, depth: 0 },
  { span: "orchestrator.plan", ms: 180, depth: 1 },
  { span: "retriever.bm25", ms: 84, depth: 2 },
  { span: "retriever.vector", ms: 142, depth: 2 },
  { span: "reranker.cohere-v3", ms: 68, depth: 2 },
  { span: "guardrail.safety", ms: 32, depth: 1 },
  { span: "llm.gpt-5.1.generate", ms: 1840, depth: 1 },
  { span: "verifier.groundedness", ms: 220, depth: 1 },
];

const totalMs = Math.max(...TRACE.map((t) => t.ms));

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

function heatColor(d: number) {
  if (d >= 7) return "hsl(var(--danger))";
  if (d >= 4) return "hsl(var(--warning))";
  if (d >= 2) return "hsl(var(--accent))";
  return "hsl(var(--success))";
}

export default function AIOps() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">AIOps Monitor</h1>
        <p className="mt-2 text-muted-foreground">Groundedness, calibration, freshness, and tracing for agentic pipelines.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Quality trends (14d)</h2>
          <p className="text-xs text-muted-foreground mb-3">Groundedness, relevance, coherence</p>
          <div className="h-64">
            {QUALITY_DATA.length === 0 ? (
              <EmptyState title="No quality samples yet" description="Run an evaluation set to populate this chart." />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={QUALITY_DATA}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0.6, 1]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v.toFixed(2)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(3)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="groundedness" stroke="hsl(var(--product))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="relevance" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="coherence" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Confidence calibration</h2>
          <p className="text-xs text-muted-foreground mb-3">Predicted vs. actual accuracy · diagonal = perfect</p>
          <div className="h-64">
            {CALIBRATION_DATA.length === 0 ? (
              <EmptyState title="No calibration samples" description="Calibration emerges after ~100 graded answers." />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis type="number" dataKey="predicted" domain={[0, 1]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} name="Predicted" tickFormatter={(v) => v.toFixed(1)} />
                <YAxis type="number" dataKey="actual" domain={[0, 1]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} name="Actual" tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(3)} cursor={{ strokeDasharray: "3 3" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: "ideal", fontSize: 10, fill: "hsl(var(--muted-foreground))", position: "insideTopRight" }} />
                <Scatter name="Sampled answers" data={CALIBRATION_DATA} fill="hsl(var(--product))" />
              </ScatterChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* HITL gate activity */}
      <div className="ui-card rounded-lg p-4">
        <h2 className="text-sm font-bold mb-1">HITL gate activity (14d)</h2>
        <p className="text-xs text-muted-foreground mb-3">Auto-resolve vs. flagged vs. human-required decisions per day</p>
        <div className="h-64">
          {HITL_DATA.length === 0 ? (
            <EmptyState title="No gate decisions yet" description="HITL activity appears once decision-support workspaces are active." />
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={HITL_DATA}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="autoResolve" name="Auto-resolve" stackId="g" fill="hsl(var(--success))" />
              <Bar dataKey="flagged" name="Flagged" stackId="g" fill="hsl(var(--warning))" />
              <Bar dataKey="humanRequired" name="Human-required" stackId="g" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="ui-card rounded-lg p-4">
        <h2 className="text-sm font-bold mb-3">Freshness heatmap (days since last refresh)</h2>
        <div className="space-y-1.5">
          {HEATMAP.map((row) => (
            <div key={row.idx} className="flex items-center gap-2">
              <div className="w-32 text-xs font-mono text-muted-foreground truncate">{row.idx}</div>
              <div className="flex-1 grid grid-cols-14 gap-0.5" style={{ gridTemplateColumns: "repeat(14, 1fr)" }}>
                {row.days.map((d, i) => (
                  <div
                    key={i}
                    role="img"
                    className="aspect-square rounded-sm"
                    style={{ background: heatColor(d), opacity: 0.4 + (d / 10) * 0.6 }}
                    title={`${d} days`}
                    aria-label={`Day ${i + 1}: ${d} days stale`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>Less stale</span>
          {[1, 3, 5, 8].map((d) => <div key={d} className="h-3 w-3 rounded-sm" style={{ background: heatColor(d) }} />)}
          <span>More stale</span>
        </div>
      </div>

      <div className="ui-card rounded-lg p-4">
        <h2 className="text-sm font-bold mb-1">Agent trace waterfall (sampled)</h2>
        <p className="text-xs text-muted-foreground mb-3">request_id: req_8c2f1a · OTEL spans</p>
        <div className="space-y-1.5">
          {TRACE.map((t) => (
            <div key={t.span} className="flex items-center gap-2 text-xs">
              <div className="w-48 truncate font-mono text-muted-foreground" style={{ paddingLeft: `${t.depth * 12}px` }}>{t.span}</div>
              <div className="flex-1 relative h-5 bg-muted/40 rounded">
                <div className="absolute inset-y-0 left-0 rounded bg-gradient-accent" style={{ width: `${(t.ms / totalMs) * 100}%` }} />
              </div>
              <div className="w-16 text-right font-mono">{t.ms}ms</div>
            </div>
          ))}
        </div>
      </div>

      <div className="ui-card rounded-lg p-4 border-warning/40">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h2 className="font-bold">Drift alerts</h2>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><Badge variant="outline" className="border-warning/40 text-warning">drift</Badge>Embedding distribution shift detected on <span className="font-mono">legal-contracts</span> (PSI 0.34).</li>
          <li className="flex items-center gap-2"><Badge variant="outline" className="border-danger/40 text-danger">drift</Badge>Groundedness on <span className="font-mono">vendor-risk</span> dropped 8% over 7d.</li>
        </ul>
      </div>
    </div>
  );
}
