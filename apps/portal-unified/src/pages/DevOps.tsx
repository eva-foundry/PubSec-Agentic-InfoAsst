import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Rocket, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { useDeployments } from "@/lib/api/hooks/useOps";
import { useRollbackDeployment } from "@/lib/api/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import type { DeploymentRecord } from "@/lib/api/types";

const statusToneClass: Record<string, string> = {
  active: "border-success/40 text-success",
  pending: "border-warning/40 text-warning",
  "rolled-back": "border-muted-foreground/40 text-muted-foreground",
  failed: "border-danger/40 text-danger",
};

export default function DevOps() {
  const deployments = useDeployments();
  const rollback = useRollbackDeployment();
  const { user } = useAuth();
  const canRollback = user?.role === "admin";

  const [target, setTarget] = useState<DeploymentRecord | null>(null);
  const [rationale, setRationale] = useState("");

  const openRollback = (d: DeploymentRecord) => {
    setTarget(d);
    setRationale("");
  };

  const submit = () => {
    if (!target || rationale.trim().length < 3) return;
    rollback.mutate(
      { version: target.version, rationale: rationale.trim() },
      {
        onSuccess: () => {
          toast.success(`Rolled back to ${target.version}`);
          setTarget(null);
        },
        onError: (e) => {
          toast.error(
            e instanceof Error ? e.message : "Rollback failed",
          );
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">DevOps</h1>
        <p className="mt-2 text-muted-foreground">
          Deployment history from <code>/ops/deployments</code>. CI pipeline status surfaces in GitHub Actions, not in this product.
        </p>
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2 flex-wrap">
          <Rocket className="h-4 w-4 text-product" />
          <h2 className="font-bold">Deployment history</h2>
          {deployments.data && (
            <Badge variant="outline" className="text-[10px]">{deployments.data.length} records</Badge>
          )}
        </div>
        {deployments.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : deployments.isError ? (
          <div className="p-6">
            <EmptyState title="Could not load deployments" description={deployments.error?.message} />
          </div>
        ) : !deployments.data || deployments.data.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No deployments yet" description="Deployment records will appear here as releases land." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th scope="col" className="text-left p-3 font-medium">Version</th>
                <th scope="col" className="text-left p-3 font-medium">Deployed</th>
                <th scope="col" className="text-left p-3 font-medium">By</th>
                <th scope="col" className="text-left p-3 font-medium">Status</th>
                <th scope="col" className="text-left p-3 font-medium">Notes</th>
                <th scope="col" className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deployments.data.map((d) => {
                const isActive = d.status === "active";
                const isFailed = d.status === "failed";
                const disabled = !canRollback || isActive || isFailed;
                const disabledReason = !canRollback
                  ? "Admin role required"
                  : isActive
                    ? "Already the active build"
                    : isFailed
                      ? "Cannot roll back to a failed build"
                      : undefined;
                return (
                  <tr key={d.version} className="border-b border-border last:border-0">
                    <td className="p-3 font-mono">{d.version}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">
                      {new Date(d.deployed_at).toLocaleString()}
                    </td>
                    <td className="p-3">{d.deployed_by}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={cn(statusToneClass[d.status] ?? "")}>
                        {d.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[320px] truncate" title={d.notes}>
                      {d.notes}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRollback(d)}
                        disabled={disabled}
                        title={disabledReason}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Rollback
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roll back to {target?.version}</DialogTitle>
            <DialogDescription>
              Promotes this version to active and marks the current build rolled-back.
              The rationale is appended to both records' notes for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rollback-rationale">Rationale</Label>
            <Textarea
              id="rollback-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="e.g. calibration regression on answer grounding"
              rows={3}
              minLength={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={rollback.isPending}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={rationale.trim().length < 3 || rollback.isPending}
            >
              {rollback.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Confirm rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
