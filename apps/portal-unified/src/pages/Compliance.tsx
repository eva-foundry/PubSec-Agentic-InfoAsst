import { useMemo, useState } from "react";
import { FRAMEWORKS } from "@/lib/site-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Search, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { useAuditLog } from "@/lib/api/hooks/useOps";
import type { AuditEntry } from "@/lib/api/types";

const HITL = { auto: 1284, flagged: 92, human: 31 };
const CONTROLS = ["GV-1.1", "GV-1.2", "MP-2.1", "MS-1.1", "MS-2.7", "MG-3.1", "MG-4.1", "OP-1.1", "OP-2.3", "AC-1", "AU-2", "AU-12"];
const COVERAGE: Record<string, "full" | "partial" | "none"> = {
  "GV-1.1": "full", "GV-1.2": "full", "MP-2.1": "full", "MS-1.1": "partial",
  "MS-2.7": "full", "MG-3.1": "full", "MG-4.1": "partial", "OP-1.1": "full",
  "OP-2.3": "none", "AC-1": "full", "AU-2": "full", "AU-12": "partial",
};

const FINGERPRINTS = [
  { date: "2025-04-12", change: "Promoted prompt rag-answer v3.4.1", rationale: "+4.2% groundedness on eval set" },
  { date: "2025-04-09", change: "Enabled claude-opus-4.7 for Legal workspace", rationale: "Better long-context performance" },
  { date: "2025-04-05", change: "Refreshed corpus snapshot for vendor-risk", rationale: "Quarterly compliance refresh" },
  { date: "2025-03-28", change: "Rolled back rag-answer v3.4.0 → v3.3.9", rationale: "Calibration regression detected" },
];

type Decision = "all" | "allow" | "deny" | "hitl-required";

function downloadCSV(rows: AuditEntry[]) {
  const header = ["timestamp", "actor", "action", "target", "subject", "decision", "policy", "rationale"].join(",");
  const body = rows
    .map((r) =>
      [r.timestamp, r.actor, r.action, r.target, r.subject, r.decision, r.policy, r.rationale]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportEvidenceBundle(rows: AuditEntry[]) {
  const bundle = {
    generatedAt: new Date().toISOString(),
    frameworks: FRAMEWORKS,
    controls: CONTROLS.map((c) => ({ id: c, coverage: COVERAGE[c] })),
    hitl: HITL,
    auditLog: rows,
    fingerprints: FINGERPRINTS,
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `evidence-bundle-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success("Evidence bundle exported");
}

export default function Compliance() {
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState<Decision>("all");

  // Server-side decision filter keeps payload small; text search is client-side
  // because the backend doesn't yet accept a full-text parameter.
  const audit = useAuditLog(decision === "all" ? {} : { decision });
  const entries = audit.data ?? [];

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (r) =>
        r.actor.toLowerCase().includes(q) ||
        r.target.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.rationale.toLowerCase().includes(q) ||
        r.policy.toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold">Compliance & Audit</h1>
          <p className="mt-2 text-muted-foreground">Forensic trails, HITL gate activity, controls coverage, and behavioral fingerprints.</p>
        </div>
        <Button variant="outline" onClick={() => exportEvidenceBundle(filtered)}>
          <Download className="mr-2 h-4 w-4" />Evidence bundle
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="ui-card rounded-lg p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Auto-resolved</div>
          <div className="mt-2 text-2xl font-extrabold text-success">{HITL.auto.toLocaleString()}</div>
        </div>
        <div className="ui-card rounded-lg p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Flagged</div>
          <div className="mt-2 text-2xl font-extrabold text-warning">{HITL.flagged}</div>
        </div>
        <div className="ui-card rounded-lg p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Human required</div>
          <div className="mt-2 text-2xl font-extrabold text-danger">{HITL.human}</div>
        </div>
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2 flex-wrap">
          <h2 className="font-bold">Audit log</h2>
          <Badge variant="outline" className="text-[10px]">{filtered.length} of {entries.length} events</Badge>
          <div className="ml-auto flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <Select value={decision} onValueChange={(v) => setDecision(v as Decision)}>
              <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Filter by decision"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All decisions</SelectItem>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
                <SelectItem value="hitl-required">HITL required</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter actor, subject, policy…"
                className="pl-8 h-8 text-xs w-full sm:w-64"
                aria-label="Filter audit log"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(filtered)}>
              <Download className="mr-1.5 h-3.5 w-3.5" />CSV
            </Button>
          </div>
        </div>
        {audit.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : audit.isError ? (
          <div className="p-6">
            <EmptyState title="Could not load audit log" description={audit.error?.message} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={entries.length === 0 ? "No audit events yet" : "No matching audit events"}
              description={entries.length === 0
                ? "Governance events will appear as admins toggle models, roll back deployments, and the guardrail denies queries."
                : "Adjust your filters to see logged decisions."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th scope="col" className="text-left p-3 font-medium">Time</th>
                  <th scope="col" className="text-left p-3 font-medium">Actor</th>
                  <th scope="col" className="text-left p-3 font-medium">Action</th>
                  <th scope="col" className="text-left p-3 font-medium">Target</th>
                  <th scope="col" className="text-left p-3 font-medium">Decision</th>
                  <th scope="col" className="text-left p-3 font-medium">Policy</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0" title={a.rationale}>
                    <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono">{a.actor}</td>
                    <td className="p-3 font-mono">{a.action}</td>
                    <td className="p-3 font-mono">{a.target}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          a.decision === "allow" && "border-success/40 text-success",
                          a.decision === "deny" && "border-danger/40 text-danger",
                          a.decision === "hitl-required" && "border-warning/40 text-warning",
                        )}
                      >{a.decision}</Badge>
                    </td>
                    <td className="p-3 font-mono">{a.policy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ui-card rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-product" />
          <h2 className="font-bold">Controls coverage — NIST AI RMF + ISO 42001</h2>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {CONTROLS.map((c) => {
            const cov = COVERAGE[c];
            const color = cov === "full" ? "bg-success" : cov === "partial" ? "bg-warning" : "bg-danger";
            return (
              <div key={c} className="rounded-md border border-border p-2 text-xs" title={`${c}: ${cov} coverage`}>
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", color)} role="img" aria-label={`${c} ${cov}`} />
                  <span className="font-mono font-semibold">{c}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground capitalize">{cov}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FRAMEWORKS.map((f) => <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>)}
        </div>
      </div>

      <div className="ui-card rounded-lg p-5">
        <h2 className="font-bold mb-3">Behavioral fingerprint timeline</h2>
        <ol className="space-y-3">
          {FINGERPRINTS.map((f, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-product" aria-hidden />
                {i < FINGERPRINTS.length - 1 && <div className="flex-1 w-px bg-border my-1" aria-hidden />}
              </div>
              <div className="pb-3">
                <div className="text-xs font-mono text-muted-foreground">{f.date}</div>
                <div className="font-medium text-sm">{f.change}</div>
                <div className="text-xs text-muted-foreground">Rationale: {f.rationale}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
