import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { useDeployments } from "@/lib/api/hooks/useOps";

const statusToneClass: Record<string, string> = {
  active: "border-success/40 text-success",
  pending: "border-warning/40 text-warning",
  "rolled-back": "border-muted-foreground/40 text-muted-foreground",
  failed: "border-danger/40 text-danger",
};

export default function DevOps() {
  const deployments = useDeployments();

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
              {deployments.data.map((d) => (
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
                  <td className="p-3 text-muted-foreground text-xs">{d.notes}</td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      title="Rollback endpoint pending (Phase F)"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Rollback
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
