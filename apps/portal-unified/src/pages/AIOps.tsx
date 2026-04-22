import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Gauge, Scale, ShieldCheck, Activity } from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { EmptyState } from "@/components/EmptyState";
import {
  useAIOpsMetrics, useCalibrationSamples, useCorpusHealth,
} from "@/lib/api/hooks/useOps";

const pct = (v: unknown, digits = 1): string => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
};

const num = (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
};

export default function AIOps() {
  const aiops = useAIOpsMetrics(14);
  const calibration = useCalibrationSamples(500);
  const corpus = useCorpusHealth();
  const series = (aiops.data?.timeseries ?? []).map((p) => ({
    ...p,
    day: p.day.slice(5),
  }));
  const scatterData = calibration.data?.samples ?? [];

  const kpis = [
    {
      label: "Avg confidence",
      value: aiops.data ? pct(aiops.data.avg_confidence) : null,
      icon: Gauge,
      tone: "text-product",
    },
    {
      label: "Groundedness",
      value: aiops.data ? pct(aiops.data.groundedness) : null,
      icon: ShieldCheck,
      tone: "text-success",
    },
    {
      label: "Calibration gap",
      value: aiops.data ? pct(aiops.data.calibration_gap) : null,
      icon: Scale,
      tone: "text-warning",
    },
    {
      label: "Escalation rate",
      value: aiops.data ? pct(aiops.data.escalation_rate) : null,
      icon: Activity,
      tone: "text-accent",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">AIOps Monitor</h1>
        <p className="mt-2 text-muted-foreground">
          Quality metrics, time-series trends and calibration samples from <code>/ops/metrics/aiops</code> + <code>/ops/metrics/calibration</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="ui-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <k.icon className={`h-4 w-4 ${k.tone}`} />
            </div>
            <div className="mt-2 text-2xl font-extrabold">
              {aiops.isLoading ? <Skeleton className="h-7 w-20" /> : k.value ?? "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Quality trends</h2>
          <p className="text-xs text-muted-foreground mb-3">Groundedness · relevance · coherence · 14d</p>
          {aiops.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : aiops.isError || series.length === 0 ? (
            <EmptyState title="Quality time-series unavailable" description={aiops.error?.message} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="groundedness" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="relevance" stroke="hsl(var(--product))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="coherence" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Confidence calibration</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Predicted vs. actual · {calibration.data?.count ?? 0} samples
          </p>
          {calibration.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : calibration.isError || scatterData.length === 0 ? (
            <EmptyState title="Calibration samples unavailable" description={calibration.error?.message} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" dataKey="predicted" domain={[0, 1]} tick={{ fontSize: 10 }} name="predicted" />
                <YAxis type="number" dataKey="actual" domain={[0, 1]} tick={{ fontSize: 10 }} name="actual" />
                <ZAxis range={[20, 20]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatterData} fill="hsl(var(--product))" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="ui-card rounded-lg p-4">
        <h2 className="text-sm font-bold mb-1">Corpus health</h2>
        <p className="text-xs text-muted-foreground mb-3">From /ops/corpus-health</p>
        {corpus.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : corpus.isError || !corpus.data ? (
          <EmptyState title="Corpus health unavailable" description={corpus.error?.message ?? "Endpoint returned an error."} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Total documents</div>
              <div className="mt-2 text-2xl font-extrabold">{num(corpus.data.total_documents)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Stale documents</div>
              <div className="mt-2 text-2xl font-extrabold text-warning">{num(corpus.data.stale_documents)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Orphaned chunks</div>
              <div className="mt-2 text-2xl font-extrabold text-danger">{num(corpus.data.orphaned_chunks)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="ui-card rounded-lg p-4 border-warning/40">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h2 className="font-bold">Drift alerts</h2>
          <Badge variant="outline" className="ml-auto text-[10px]">backend gap</Badge>
        </div>
        <EmptyState
          title="Drift detection pending"
          description="See /drift for model/prompt/corpus drift signals (also Phase F)."
        />
      </div>
    </div>
  );
}
