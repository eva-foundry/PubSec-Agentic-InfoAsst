import { MODELS, PROMPTS, WORKSPACES } from "@/lib/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, History, FlaskConical } from "lucide-react";

const ARENA = [
  { combo: "gpt-5.1 + rag-answer v3.4.1", elo: 1542, wins: 84, losses: 31 },
  { combo: "claude-opus-4.7 + rag-answer v3.4.1", elo: 1518, wins: 79, losses: 36 },
  { combo: "gpt-5.1 + rag-answer v3.4.0", elo: 1486, wins: 71, losses: 44 },
  { combo: "gpt-5-mini + rag-answer v3.4.1", elo: 1402, wins: 58, losses: 57 },
];

export default function Models() {
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
          {/* Models */}
          <div className="ui-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Model catalog</h2>
              <p className="text-xs text-muted-foreground">Enable, configure, and scope per group.</p>
            </div>
            <div className="divide-y divide-border">
              {MODELS.map((m) => (
                <div key={m.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">{m.name}</span>
                      <Badge variant="outline" className="text-[10px]">{m.vendor}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">temp {m.temp} · ctx {m.contextK}k</div>
                  </div>
                  <Switch defaultChecked={m.enabled} aria-label={`Enable ${m.name}`} />
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Per-workspace access matrix</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><th className="text-left p-1.5">Workspace</th>{MODELS.map((m) => <th key={m.id} className="p-1.5 font-mono">{m.name.split("-")[0]}</th>)}</tr></thead>
                  <tbody>
                    {WORKSPACES.slice(0, 4).map((w) => (
                      <tr key={w.id} className="border-t border-border">
                        <td className="p-1.5 truncate max-w-[120px]">{w.name}</td>
                        {MODELS.map((m) => <td key={m.id} className="p-1.5 text-center">{Math.random() > 0.3 ? "✓" : "—"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Prompts */}
          <div className="ui-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Prompt versions</h2>
              <p className="text-xs text-muted-foreground">Diff, rollback, A/B test.</p>
            </div>
            <div className="divide-y divide-border">
              {PROMPTS.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-mono text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">v{p.version} · updated {p.updated}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={p.status === "active" ? "border-success/40 text-success" : p.status === "ab-test" ? "border-product/40 text-product" : ""}
                      >{p.status}</Badge>
                      <Button variant="ghost" size="sm"><History className="h-3.5 w-3.5 mr-1.5" />Diff</Button>
                      <Button variant="ghost" size="sm">Rollback</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-muted/30 border-t border-border text-[11px] font-mono text-muted-foreground">
              fingerprint: model=gpt-5.1 · prompt=rag-answer-default@v3.4.1 · corpus=2025-04-12T08:00Z
            </div>
          </div>
        </TabsContent>

        <TabsContent value="arena" className="mt-6">
          <div className="ui-card rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-product" />
              <h2 className="font-bold">Elo leaderboard</h2>
              <Badge variant="outline" className="ml-auto text-[10px]">120 curated test cases</Badge>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr><th className="text-left p-3 font-medium">Model + Prompt</th><th className="p-3 font-medium">Elo</th><th className="p-3 font-medium">Wins</th><th className="p-3 font-medium">Losses</th></tr>
              </thead>
              <tbody>
                {ARENA.map((a, i) => (
                  <tr key={a.combo} className="border-b border-border last:border-0">
                    <td className="p-3"><span className="font-mono text-xs">{a.combo}</span> {i === 0 && <Badge className="ml-2 bg-product text-white text-[10px]">leader</Badge>}</td>
                    <td className="p-3 text-center font-mono font-bold">{a.elo}</td>
                    <td className="p-3 text-center text-success">{a.wins}</td>
                    <td className="p-3 text-center text-muted-foreground">{a.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
