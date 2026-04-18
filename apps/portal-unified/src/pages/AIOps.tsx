import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Gauge, Scale, ShieldCheck, Activity } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useAIOpsMetrics, useCorpusHealth } from "@/lib/api/hooks/useOps";

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
  const aiops = useAIOpsMetrics();
  const corpus = useCorpusHealth();

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
          Quality metrics from <code>/ops/metrics/aiops</code> · time-series panels pending backend enhancement.
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
          <p className="text-xs text-muted-foreground mb-3">Groundedness · relevance · coherence</p>
          <div className="min-h-[240px] grid place-items-center">
            <EmptyState
              title="Daily quality time-series pending"
              description="Backend enhancement required: /ops/metrics/aiops needs a days=N query parameter to expose per-day samples. Tracked as Phase F follow-up."
            />
          </div>
        </div>
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Confidence calibration</h2>
          <p className="text-xs text-muted-foreground mb-3">Predicted vs. actual scatter</p>
          <div className="min-h-[240px] grid place-items-center">
            <EmptyState
              title="Calibration sampling pending"
              description="Calibration scatter needs a backend endpoint returning (predicted, actual) pairs. Today only the aggregate calibration_gap is exposed."
            />
          </div>
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
