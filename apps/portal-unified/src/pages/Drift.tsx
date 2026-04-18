import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { useWorkspaces } from "@/lib/api/hooks/useWorkspaces";
import { useAIOpsMetrics } from "@/lib/api/hooks/useOps";

type WindowKey = "7d" | "30d" | "90d";

export default function Drift() {
  const workspaces = useWorkspaces();
  const aiops = useAIOpsMetrics();
  const [window, setWindow] = useState<WindowKey>("30d");
  const [workspace, setWorkspace] = useState<string>("");

  useEffect(() => {
    if (!workspace && workspaces.data && workspaces.data.length > 0) {
      setWorkspace(workspaces.data[0].id);
    }
  }, [workspace, workspaces.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Drift Monitor</h1>
        <p className="mt-2 text-muted-foreground">
          Model, prompt, and corpus drift signals — backend endpoint pending (Phase F).
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
              className={window === w ? "rounded px-2.5 py-1 font-medium bg-muted text-foreground" : "rounded px-2.5 py-1 font-medium text-muted-foreground hover:text-foreground"}
            >
              {w}
            </button>
          ))}
        </div>
        <Badge variant="outline" className="ml-auto text-[10px]">backend gap — useAIOpsMetrics current snapshot only</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Model drift</h2>
          <p className="text-xs text-muted-foreground mb-3">Embedding distribution PSI · {window}</p>
          <EmptyState title="PSI time-series pending" description="Requires /ops/metrics/drift endpoint." />
        </div>
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Prompt drift</h2>
          <p className="text-xs text-muted-foreground mb-3">Output lexical shift · {window}</p>
          <EmptyState title="Prompt drift pending" description="Requires backend instrumentation." />
        </div>
        <div className="ui-card rounded-lg p-4">
          <h2 className="text-sm font-bold mb-1">Corpus drift</h2>
          <p className="text-xs text-muted-foreground mb-3">Source refresh cadence · {window}</p>
          <EmptyState title="Corpus drift pending" description="Proxied by corpus-health today." />
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
