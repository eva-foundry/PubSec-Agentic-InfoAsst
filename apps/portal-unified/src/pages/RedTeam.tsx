import { useEffect, useRef, useState } from "react";
import { ATTACK_CATEGORIES, TEST_SETS } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShieldAlert, Play, Square, CheckCircle2, AlertTriangle, XCircle, Activity, Download } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useApiClient } from "@/contexts/ApiProvider";
import type { EvalRunStarted, EvalStreamEvent } from "@/lib/api/types";

interface RunEvent {
  id: string;
  category: string;
  prompt: string;
  result: "pass" | "fail" | "flag";
  ms: number;
}

export default function RedTeam() {
  const client = useApiClient();
  const [selected, setSelected] = useState<string[]>(ATTACK_CATEGORIES.map((c) => c.id));
  const [testSet, setTestSet] = useState(TEST_SETS[0].id);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const passed = events.filter((e) => e.result === "pass").length;
  const failed = events.filter((e) => e.result === "fail").length;
  const flagged = events.filter((e) => e.result === "flag").length;
  const passRate = events.length ? passed / events.length : 0;

  const run = async () => {
    if (selected.length === 0) {
      toast.error("Select at least one attack category.");
      return;
    }
    setEvents([]);
    setProgress(0);
    setRunning(true);

    let started: EvalRunStarted;
    try {
      started = await client.post<EvalRunStarted>("/v1/eva/ops/eval/challenges", {
        test_set_id: testSet,
        categories: selected,
        workspace_id: "ws-oas-act",
      });
    } catch (err) {
      setRunning(false);
      toast.error(`Could not start evaluation: ${(err as Error).message}`);
      return;
    }
    setTotal(started.total_probes);

    const controller = new AbortController();
    abortRef.current = controller;
    let seen = 0;
    try {
      for await (const ev of client.streamEvalResults(started.run_id, {
        signal: controller.signal,
      }) as AsyncIterable<EvalStreamEvent>) {
        if (ev.type === "probe") {
          seen += 1;
          setEvents((prior) => [
            ...prior,
            {
              id: ev.id,
              category: ev.category,
              prompt: ev.prompt,
              result: ev.result,
              ms: ev.ms,
            },
          ]);
          setProgress((seen / started.total_probes) * 100);
        } else if (ev.type === "complete") {
          setProgress(100);
        }
      }
      if (!controller.signal.aborted) toast.success("Evaluation complete.");
    } catch (err) {
      if (!controller.signal.aborted) {
        toast.error(`Stream failed: ${(err as Error).message}`);
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    toast("Evaluation stopped.");
  };

  const exportBundle = (fmt: "json" | "csv") => {
    if (events.length === 0) {
      toast.error("Run an evaluation first.");
      return;
    }
    const ts = new Date().toISOString();
    const setName = TEST_SETS.find((t) => t.id === testSet)?.name ?? testSet;
    let blob: Blob;
    let filename: string;
    if (fmt === "json") {
      const bundle = {
        generatedAt: ts,
        testSet: setName,
        categories: selected,
        summary: { total: events.length, passed, failed, flagged, passRate },
        events: events.map((e) => ({
          id: e.id,
          category: e.category,
          prompt: e.prompt,
          verdict: e.result,
          policyOutcome: e.result === "pass" ? "blocked" : e.result === "flag" ? "review" : "bypass",
          latencyMs: e.ms,
        })),
      };
      blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      filename = `aia-redteam-${ts.slice(0, 10)}.json`;
    } else {
      const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const rows = [
        ["id", "category", "verdict", "policy_outcome", "latency_ms", "prompt"].join(","),
        ...events.map((e) =>
          [
            e.id,
            escape(e.category),
            e.result,
            e.result === "pass" ? "blocked" : e.result === "flag" ? "review" : "bypass",
            String(e.ms),
            escape(e.prompt),
          ].join(",")
        ),
      ];
      blob = new Blob([rows.join("\n")], { type: "text/csv" });
      filename = `aia-redteam-${ts.slice(0, 10)}.csv`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Evidence bundle exported (${fmt.toUpperCase()}).`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-product" />
            <h1 className="text-2xl font-extrabold tracking-tight">Red Team & Evaluation</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Run adversarial test sets across attack categories. Every result is logged with prompt,
            verdict, latency, and policy outcome for evidence bundles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={events.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Export evidence
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportBundle("json")}>JSON bundle</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportBundle("csv")}>CSV rows</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {running ? (
            <Button onClick={stop} variant="outline" className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger">
              <Square className="h-4 w-4 fill-current mr-2" /> Stop
            </Button>
          ) : (
            <Button onClick={run} className="bg-gradient-accent shadow-elegant">
              <Play className="h-4 w-4 mr-2" /> Run evaluation
            </Button>
          )}
        </div>
      </header>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Probes run", v: events.length, sub: `of ${total}` },
          { label: "Pass rate", v: `${(passRate * 100).toFixed(1)}%`, sub: `${passed} passes` },
          { label: "Failures", v: failed, sub: "policy bypassed", tone: "danger" as const },
          { label: "Flagged", v: flagged, sub: "needs review", tone: "warning" as const },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div
              className={cn(
                "mt-1 text-2xl font-extrabold font-mono",
                s.tone === "danger" && "text-danger",
                s.tone === "warning" && "text-warning",
              )}
            >
              {s.v}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left: configuration */}
        <div className="space-y-5">
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Test set
            </div>
            <div className="space-y-2">
              {TEST_SETS.map((t) => (
                <label
                  key={t.id}
                  className={cn(
                    "flex items-start gap-2 rounded-md border p-2.5 cursor-pointer transition-colors",
                    testSet === t.id ? "border-product/50 bg-product/5" : "border-border hover:bg-muted/40"
                  )}
                >
                  <input
                    type="radio"
                    name="testset"
                    checked={testSet === t.id}
                    onChange={() => setTestSet(t.id)}
                    className="mt-1 accent-[hsl(var(--product))]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.items} items · last {t.lastRun} · pass {(t.pass * 100).toFixed(0)}%
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Attack categories
            </div>
            <div className="space-y-2">
              {ATTACK_CATEGORIES.map((c) => {
                const active = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    aria-pressed={active}
                    className={cn(
                      "w-full text-left rounded-md border p-2.5 transition-colors",
                      active ? "border-product/50 bg-product/5" : "border-border hover:bg-muted/40 opacity-70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{c.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase",
                          c.severity === "critical" && "border-danger/40 text-danger",
                          c.severity === "high" && "border-warning/40 text-warning",
                          c.severity === "medium" && "border-muted-foreground/40 text-muted-foreground",
                        )}
                      >
                        {c.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{c.desc}</p>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: stream */}
        <Card className="flex flex-col min-h-[480px]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Activity className={cn("h-4 w-4", running ? "text-product animate-pulse" : "text-muted-foreground")} />
              <span className="text-sm font-semibold">
                {running ? "Streaming probes…" : events.length ? "Run complete" : "Idle"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {events.length} / {total}
            </div>
          </div>
          <div className="px-4 pt-3">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-label="Evaluation progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="h-full bg-gradient-accent transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div ref={streamRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-1.5 max-h-[520px]">
            {events.length === 0 && !running && (
              <div className="text-center text-sm text-muted-foreground py-16">
                Configure categories on the left and press <span className="font-semibold text-foreground">Run evaluation</span>.
              </div>
            )}
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-start gap-3 rounded-md border px-3 py-2 text-xs",
                    e.result === "pass" && "border-success/30 bg-success/5",
                    e.result === "flag" && "border-warning/30 bg-warning/5",
                    e.result === "fail" && "border-danger/30 bg-danger/5",
                  )}
                >
                  {e.result === "pass" ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  ) : e.result === "flag" ? (
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{e.category}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">{e.ms}ms</span>
                    </div>
                    <div className="text-muted-foreground truncate font-mono text-[11px] mt-0.5">
                      {e.prompt}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "uppercase text-[10px] shrink-0",
                      e.result === "pass" && "border-success/40 text-success",
                      e.result === "flag" && "border-warning/40 text-warning",
                      e.result === "fail" && "border-danger/40 text-danger",
                    )}
                  >
                    {e.result === "pass" ? "blocked" : e.result === "flag" ? "review" : "bypass"}
                  </Badge>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </div>
  );
}
