import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, History, FlaskConical } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useAdminModels, useAdminPrompts, useToggleModel } from "@/lib/api/hooks/useAdmin";
import { useEvalArena } from "@/lib/api/hooks/useOps";
import { useWorkspaces } from "@/lib/api/hooks/useWorkspaces";

export default function Models() {
  const models = useAdminModels();
  const prompts = useAdminPrompts();
  const workspaces = useWorkspaces();
  const arena = useEvalArena();
  const toggle = useToggleModel();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Model Registry & Prompt Versioning</h1>
        <p className="mt-2 text-muted-foreground">Govern which models, prompts, and parameters can be used per workspace.</p>
      </div>

      <Tabs defaultValue="registry">
        <TabsList>
          <TabsTrigger value="registry">Registry</TabsTrigger>
          <TabsTrigger value="arena"><Trophy className="h-3.5 w-3.5 mr-1.5" />Evaluation arena</TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <div className="ui-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Model catalog</h2>
              <p className="text-xs text-muted-foreground">Enable, configure, and scope per group.</p>
            </div>
            {models.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : models.isError ? (
              <div className="p-4">
                <EmptyState title="Could not load models" description={models.error?.message} />
              </div>
            ) : !models.data || models.data.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No models registered" description="Register a model via /admin/models." />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {models.data.map((m) => (
                  <div key={m.id} className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm">{m.model_name}</span>
                        <Badge variant="outline" className="text-[10px]">{m.provider}</Badge>
                        <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        deployment: <span className="font-mono">{m.deployment_name || "—"}</span>
                        {m.model_version ? ` · v${m.model_version}` : ""}
                        {m.sku ? ` · ${m.sku}` : ""}
                      </div>
                      {m.capabilities.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.capabilities.slice(0, 4).map((c) => (
                            <Badge key={c} variant="secondary" className="text-[9px]">{c}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={m.is_active}
                      onCheckedChange={(next) => toggle.mutate({ modelId: m.id, isActive: next })}
                      disabled={toggle.isPending}
                      aria-label={`Enable ${m.model_name}`}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="p-4 border-t border-border">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Per-workspace classification ceilings</div>
              {workspaces.isLoading || models.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left p-1.5">Workspace</th>
                        {(models.data ?? []).map((m) => (
                          <th key={m.id} className="p-1.5 font-mono">{m.model_name.split("-")[0]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(workspaces.data ?? []).slice(0, 5).map((w) => (
                        <tr key={w.id} className="border-t border-border">
                          <td className="p-1.5 truncate max-w-[140px]">{w.name}</td>
                          {(models.data ?? []).map((m) => {
                            const allowed = m.classification_ceiling === "sensitive" ||
                              m.classification_ceiling === w.data_classification;
                            return (
                              <td key={m.id} className="p-1.5 text-center">{allowed ? "✓" : "—"}</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="ui-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Prompt versions</h2>
              <p className="text-xs text-muted-foreground">Diff, rollback, A/B test.</p>
            </div>
            {prompts.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : prompts.isError ? (
              <div className="p-4">
                <EmptyState title="Could not load prompts" description={prompts.error?.message} />
              </div>
            ) : !prompts.data || prompts.data.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No prompts registered" description="Register a prompt via /admin/prompts." />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {prompts.data.map((p) => (
                  <div key={p.name} className="p-4 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-mono text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">active v{p.active_version}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm">
                        <History className="h-3.5 w-3.5 mr-1.5" />Versions
                      </Button>
                      <Button variant="ghost" size="sm">Rollback</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="arena" className="mt-6">
          <div className="ui-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-product" />
              <h2 className="font-bold">Elo leaderboard</h2>
              {arena.data && <Badge variant="outline" className="ml-auto text-[10px]">{arena.data.length} entries</Badge>}
            </div>
            {arena.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : arena.isError || !arena.data || arena.data.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Arena data unavailable"
                  description={arena.error?.message ?? "Run evaluation matches to populate the leaderboard."}
                />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left p-3 font-medium">Model</th>
                    <th className="p-3 font-medium">Elo</th>
                    <th className="p-3 font-medium">Matches</th>
                    <th className="p-3 font-medium">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {arena.data.map((e, i) => (
                    <tr key={e.model_id} className="border-b border-border last:border-0">
                      <td className="p-3">
                        <span className="font-mono text-xs">{e.model_name}</span>
                        {i === 0 && <Badge className="ml-2 bg-product text-white text-[10px]">leader</Badge>}
                      </td>
                      <td className="p-3 text-center font-mono font-bold">{Math.round(e.elo_score)}</td>
                      <td className="p-3 text-center">{e.match_count}</td>
                      <td className="p-3 text-center text-muted-foreground">{(e.win_rate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
