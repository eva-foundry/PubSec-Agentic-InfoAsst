import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitBranch, GitCommit, GitPullRequest, Rocket, Search, RotateCcw, Play, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

type PipeStatus = "passing" | "running" | "failed";
interface Pipeline {
  name: string;
  commit: string;
  author: string;
  message: string;
  status: PipeStatus;
  duration: string;
  startedAt: string;
  stages: { name: string; status: PipeStatus | "pending"; duration: string }[];
}

const PIPELINES: Pipeline[] = [
  {
    name: "main", commit: "8c2f1a3", author: "alice", message: "chore: bump reranker timeout to 800ms",
    status: "passing", duration: "4m 12s", startedAt: "2025-04-16 13:02",
    stages: [
      { name: "lint", status: "passing", duration: "22s" },
      { name: "unit", status: "passing", duration: "1m 04s" },
      { name: "integration", status: "passing", duration: "2m 11s" },
      { name: "deploy:staging", status: "passing", duration: "35s" },
    ],
  },
  {
    name: "release/v1.8", commit: "4d18f9e", author: "bob", message: "feat(orchestrator): cache shedding under p99>600ms",
    status: "passing", duration: "6m 03s", startedAt: "2025-04-16 11:48",
    stages: [
      { name: "lint", status: "passing", duration: "19s" },
      { name: "unit", status: "passing", duration: "58s" },
      { name: "integration", status: "passing", duration: "3m 41s" },
      { name: "perf", status: "passing", duration: "1m 05s" },
    ],
  },
  {
    name: "feature/multi-agent", commit: "ab2d501", author: "carol", message: "wip: planner-executor split",
    status: "running", duration: "—", startedAt: "2025-04-16 14:18",
    stages: [
      { name: "lint", status: "passing", duration: "20s" },
      { name: "unit", status: "passing", duration: "1m 12s" },
      { name: "integration", status: "running", duration: "—" },
      { name: "deploy:staging", status: "pending", duration: "—" },
    ],
  },
  {
    name: "hotfix/retriever-fallback", commit: "f1e8b32", author: "dmitri", message: "fix(retriever): null pointer on empty corpus",
    status: "failed", duration: "2m 41s", startedAt: "2025-04-16 12:30",
    stages: [
      { name: "lint", status: "passing", duration: "18s" },
      { name: "unit", status: "failed", duration: "2m 23s" },
      { name: "integration", status: "pending", duration: "—" },
    ],
  },
];

const DEPLOYS = [
  { env: "production", version: "v1.7.4", time: "2h ago", status: "healthy", commit: "9a01b22", traffic: 100 },
  { env: "staging", version: "v1.8.0-rc.2", time: "20m ago", status: "healthy", commit: "4d18f9e", traffic: 100 },
  { env: "preview-pr-412", version: "v1.8.0-rc.3", time: "5m ago", status: "warming", commit: "8c2f1a3", traffic: 5 },
];

const INFRA = [
  { id: 412, title: "Bump reranker fallback timeout to 800ms", merged: "1h ago", author: "alice", risk: "low" },
  { id: 410, title: "Pin embedding-3-large to v3.1.0 in registry", merged: "4h ago", author: "bob", risk: "medium" },
  { id: 406, title: "Enable cache shedding when p99 > 600ms", merged: "yesterday", author: "carol", risk: "medium" },
  { id: 401, title: "Roll out OTEL spans to verifier service", merged: "2d ago", author: "alice", risk: "low" },
  { id: 397, title: "Migrate vector index to HNSW M=32", merged: "3d ago", author: "dmitri", risk: "high" },
];

const dot = (s: PipeStatus | "pending") =>
  s === "passing" ? "bg-success" : s === "running" ? "bg-warning animate-pulse" : s === "failed" ? "bg-danger" : "bg-muted-foreground/40";

export default function DevOps() {
  const [filter, setFilter] = useState<"all" | PipeStatus>("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Pipeline | null>(null);

  const filtered = useMemo(
    () =>
      PIPELINES.filter((p) => (filter === "all" || p.status === filter))
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.message.toLowerCase().includes(query.toLowerCase())),
    [filter, query],
  );

  const counts = useMemo(() => ({
    all: PIPELINES.length,
    passing: PIPELINES.filter((p) => p.status === "passing").length,
    running: PIPELINES.filter((p) => p.status === "running").length,
    failed: PIPELINES.filter((p) => p.status === "failed").length,
  }), []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold">DevOps</h1>
          <p className="mt-2 text-muted-foreground">CI status, deployments, infrastructure changes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-success/40 text-success">{counts.passing} passing</Badge>
          <Badge variant="outline" className="border-warning/40 text-warning">{counts.running} running</Badge>
          <Badge variant="outline" className="border-danger/40 text-danger">{counts.failed} failed</Badge>
        </div>
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2 flex-wrap">
          <GitBranch className="h-4 w-4 text-product" />
          <h2 className="font-bold">CI pipelines</h2>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="ml-2">
            <TabsList className="h-7">
              <TabsTrigger value="all" className="text-xs h-6">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="passing" className="text-xs h-6">Passing</TabsTrigger>
              <TabsTrigger value="running" className="text-xs h-6">Running</TabsTrigger>
              <TabsTrigger value="failed" className="text-xs h-6">Failed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter branches…"
              className="h-8 pl-8 text-xs"
              aria-label="Filter pipelines"
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No pipelines match" description="Try clearing the filter or search query." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((p) => (
              <li key={p.name}>
                <button
                  onClick={() => setActive(p)}
                  className="w-full text-left p-3 flex items-center gap-3 text-sm hover:bg-muted/40 transition-colors"
                >
                  <span className={cn("h-2 w-2 rounded-full", dot(p.status))} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      <GitCommit className="inline h-3 w-3 mr-0.5" />
                      {p.commit} · {p.author} · {p.message}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground hidden sm:block">{p.duration}</div>
                  <Badge variant="outline" className={cn(
                    p.status === "passing" && "border-success/40 text-success",
                    p.status === "running" && "border-warning/40 text-warning",
                    p.status === "failed" && "border-danger/40 text-danger",
                  )}>{p.status}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Rocket className="h-4 w-4 text-product" />
          <h2 className="font-bold">Deployments</h2>
        </div>
        <ul className="divide-y divide-border">
          {DEPLOYS.map((d) => (
            <li key={d.env} className="p-3 flex items-center gap-3 text-sm flex-wrap">
              <span className={cn("h-2 w-2 rounded-full", d.status === "healthy" ? "bg-success" : "bg-warning animate-pulse")} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{d.env}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{d.version} · {d.commit} · {d.time}</div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>traffic</span>
                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-product" style={{ width: `${d.traffic}%` }} />
                </div>
                <span className="font-mono">{d.traffic}%</span>
              </div>
              <Badge variant="outline">{d.status}</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success(`Rollback initiated for ${d.env}`, { description: `Reverting to previous healthy revision.` })}
                aria-label={`Rollback ${d.env}`}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Rollback
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="ui-card rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <GitPullRequest className="h-4 w-4 text-product" />
          <h2 className="font-bold">Recent infra changes</h2>
        </div>
        <ul className="divide-y divide-border">
          {INFRA.map((i) => (
            <li key={i.id} className="py-3 flex items-center gap-3 text-sm flex-wrap">
              <span className="font-mono text-xs text-muted-foreground w-12">#{i.id}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{i.title}</div>
                <div className="text-[11px] text-muted-foreground">{i.author} · merged {i.merged}</div>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  i.risk === "high" && "border-danger/40 text-danger",
                  i.risk === "medium" && "border-warning/40 text-warning",
                  i.risk === "low" && "border-success/40 text-success",
                )}
              >{i.risk} risk</Badge>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{active.name}</SheetTitle>
                <SheetDescription>
                  {active.commit} · {active.author} · started {active.startedAt}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <p className="text-sm">{active.message}</p>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Stages</h3>
                  <ol className="space-y-1.5">
                    {active.stages.map((s) => (
                      <li key={s.name} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                        <span className={cn("h-2 w-2 rounded-full", dot(s.status))} aria-hidden />
                        <span className="font-mono text-xs flex-1">{s.name}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{s.duration}</span>
                        <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-gradient-accent flex-1"
                    onClick={() => toast.success(`Re-running ${active.name}`)}
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" />Re-run
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => toast("Opening logs in CI provider…")}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Logs
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
