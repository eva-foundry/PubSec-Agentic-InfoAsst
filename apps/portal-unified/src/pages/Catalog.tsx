import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Sparkles, Search, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useArchetypes, useCreateWorkspace } from "@/lib/api/hooks/useWorkspaces";

type Assurance = "all" | "Advisory" | "Decision-informing";

export default function Catalog() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assurance, setAssurance] = useState<Assurance>("all");
  const [name, setName] = useState("");
  const [selectedArchetype, setSelectedArchetype] = useState<string>("kb");
  const [classification, setClassification] = useState<"unclassified" | "protected_a" | "protected_b">("protected_a");
  const [costCentre, setCostCentre] = useState("");
  const steps = ["Archetype", "Data sources", "Team", "Policies", "Confirm"];

  const archetypes = useArchetypes();
  const entries = archetypes.data ?? [];
  const createMutation = useCreateWorkspace();

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return entries
      .filter((a) => assurance === "all" || a.assurance === assurance)
      .filter((a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      );
  }, [entries, query, assurance]);

  const finishWizard = () => {
    if (!name.trim()) {
      toast.error("Workspace name is required.");
      return;
    }
    createMutation.mutate(
      {
        name: name.trim(),
        archetype: selectedArchetype,
        data_classification: classification,
        cost_centre: costCentre.trim(),
      },
      {
        onSuccess: (ws) => {
          setOpen(false);
          setStep(0);
          setName("");
          setCostCentre("");
          toast.success(`Workspace "${ws.name}" created`, {
            description: `${ws.id} · ${ws.data_classification}${ws.cost_centre ? ` · cost-centre: ${ws.cost_centre}` : ""} · archetype: ${ws.archetype ?? "n/a"}`,
          });
        },
        onError: (err) => {
          toast.error(`Could not create workspace: ${(err as Error).message}`);
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold">Workspace Catalog</h1>
          <p className="mt-2 text-muted-foreground">Pick an archetype to spin up a governed knowledge workspace.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setStep(0); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-accent shadow-elegant"><Plus className="mr-2 h-4 w-4" />Create workspace</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create workspace · Step {step + 1} of {steps.length}</DialogTitle></DialogHeader>
            <div className="flex items-center gap-1 mb-4" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={steps.length}>
              {steps.map((s, i) => (
                <div key={s} className={cn("flex-1 h-1 rounded-full", i <= step ? "bg-product" : "bg-muted")} />
              ))}
            </div>
            <div className="space-y-3">
              <Label htmlFor="ws-field">{steps[step]}</Label>
              {step === 0 ? (
                <div className="space-y-2">
                  <Input
                    id="ws-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Workspace name…"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      aria-label="Archetype"
                      value={selectedArchetype}
                      onChange={(e) => setSelectedArchetype(e.target.value)}
                      className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      {entries.map((a) => (
                        <option key={a.key} value={a.key}>{a.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Classification"
                      value={classification}
                      onChange={(e) => setClassification(e.target.value as typeof classification)}
                      className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      <option value="unclassified">Unclassified</option>
                      <option value="protected_a">Protected A</option>
                      <option value="protected_b">Protected B</option>
                    </select>
                  </div>
                  <Input
                    aria-label="Cost centre"
                    value={costCentre}
                    onChange={(e) => setCostCentre(e.target.value)}
                    placeholder="Cost centre (e.g. CC-ESDC-3042)"
                  />
                </div>
              ) : (
                <Input id="ws-field" placeholder={`Configure ${steps[step].toLowerCase()}…`} />
              )}
              <p className="text-xs text-muted-foreground">Name + archetype + classification are persisted. Remaining steps are placeholders until the provisioning pipeline ships.</p>
            </div>
            <DialogFooter>
              {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>}
              {step < steps.length - 1
                ? <Button onClick={() => setStep((s) => s + 1)} className="bg-gradient-accent">Next</Button>
                : <Button onClick={finishWizard} disabled={createMutation.isPending} className="bg-gradient-accent">{createMutation.isPending ? "Creating…" : "Create"}</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="ui-card rounded-lg p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
          {(["all", "Advisory", "Decision-informing"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAssurance(a)}
              aria-pressed={assurance === a}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                assurance === a ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >{a === "all" ? "All assurance" : a}</button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archetypes…"
            className="h-8 pl-8 text-xs"
            aria-label="Search archetypes"
          />
        </div>
      </div>

      {archetypes.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-60 w-full" />)}
        </div>
      ) : archetypes.isError ? (
        <EmptyState
          title="Could not load archetypes"
          description={archetypes.error?.message ?? "Try refreshing the page."}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={entries.length === 0 ? "No archetypes published yet" : "No archetypes match"}
          description={entries.length === 0 ? "Ops has not published any archetypes." : "Clear filters to see all archetypes."}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((a, i) => (
            <motion.div
              key={a.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="ui-card rounded-lg p-5 flex flex-col"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-md bg-gradient-accent grid place-items-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-lg font-bold">{a.name}</h2>
                </div>
                <Badge variant="outline" className={a.assurance === "Decision-informing" ? "border-product/40 text-product" : ""}>{a.assurance}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{a.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Monthly cost</div>
                  <div className="font-semibold">{a.cost_band}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Default capacity</div>
                  <div className="font-semibold">{a.default_capacity} docs</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Sample questions</div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {a.sample_questions.map((q) => <li key={q} className="truncate">· {q}</li>)}
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setOpen(true); setName(a.name); setSelectedArchetype(a.key); }}
                >
                  Use template
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-accent"
                  onClick={() => navigate("/chat")}
                  aria-label={`Try ${a.name} in chat`}
                >
                  Try in chat <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
