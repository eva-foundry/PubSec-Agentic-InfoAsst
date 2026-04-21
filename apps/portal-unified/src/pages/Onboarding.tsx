import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, Sparkles, Users, Database, Shield, Layers, ListChecks, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { useCompleteOnboarding } from "@/lib/api/hooks/useOnboarding";

interface Step {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  fields: { label: string; placeholder: string; multiline?: boolean }[];
}

const STEPS: Step[] = [
  {
    id: "org", title: "Organization profile", desc: "Tenant name, region, industry, primary admin.", icon: Sparkles,
    fields: [
      { label: "Tenant name", placeholder: "Acme Corp" },
      { label: "Region", placeholder: "eu-west-1" },
      { label: "Industry", placeholder: "Financial services" },
      { label: "Primary admin email", placeholder: "admin@acme.com" },
    ],
  },
  {
    id: "class", title: "Data classification", desc: "Define sensitivity tiers (Public, Internal, Confidential, Restricted).", icon: Layers,
    fields: [
      { label: "Default tier", placeholder: "Internal" },
      { label: "Restricted handling notes", placeholder: "PII redacted at ingest, encryption-at-rest CMEK", multiline: true },
    ],
  },
  {
    id: "assurance", title: "Assurance level", desc: "Pick the default mode: Advisory or Decision-informing.", icon: Shield,
    fields: [
      { label: "Default mode", placeholder: "Advisory" },
      { label: "HITL trigger threshold", placeholder: "confidence < 0.75" },
    ],
  },
  {
    id: "templates", title: "Workspace templates", desc: "Start from one of five archetypes or design custom.", icon: Database,
    fields: [
      { label: "Archetype", placeholder: "Knowledge Base" },
      { label: "Initial corpus path", placeholder: "s3://acme-docs/handbook" },
    ],
  },
  {
    id: "roles", title: "Role mapping (SSO)", desc: "Map IdP groups to Reader / Contributor / Admin.", icon: Users,
    fields: [
      { label: "IdP group → Admin", placeholder: "okta-aia-admins" },
      { label: "IdP group → Contributor", placeholder: "okta-aia-editors" },
      { label: "IdP group → Reader", placeholder: "okta-aia-viewers" },
    ],
  },
  {
    id: "kickoff", title: "Kickoff checklist", desc: "Invite team, ingest first corpus, run pilot question.", icon: ListChecks,
    fields: [
      { label: "Invitees (comma-separated)", placeholder: "alice@acme.com, bob@acme.com" },
      { label: "Pilot question", placeholder: "What is our parental leave policy?" },
    ],
  },
];

const STORAGE_KEY = "aia-onboarding-progress";

export default function Onboarding() {
  const [done, setDone] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["org", "class"];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : ["org", "class"];
    } catch {
      return ["org", "class"];
    }
  });
  const [active, setActive] = useState<Step | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [archetype, setArchetype] = useState("kb");
  const [mode, setMode] = useState<"Advisory" | "Decision-informing">("Advisory");
  const [classification, setClassification] = useState<"unclassified" | "restricted" | "sensitive">("restricted");
  const completeOnboarding = useCompleteOnboarding();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(done)); } catch { /* ignore */ }
  }, [done]);

  const toggle = (id: string) =>
    setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const markDone = (id: string) => {
    if (!done.includes(id)) {
      setDone((d) => [...d, id]);
      toast.success("Step marked complete.");
    }
    setActive(null);
  };

  const reset = () => {
    setDone([]);
    toast("Onboarding reset to zero.");
  };

  const submitTenantInit = () => {
    if (!orgName.trim() || !primaryEmail.includes("@")) {
      toast.error("Organization name + valid admin email are required.");
      return;
    }
    completeOnboarding.mutate(
      {
        org_name: orgName.trim(),
        primary_admin_email: primaryEmail.trim(),
        default_classification: classification,
        default_mode: mode,
        preferred_archetype: archetype,
      },
      {
        onSuccess: (res) => {
          toast.success(`Tenant initialized — ${res.client_id}`, {
            description: `Interview ${res.interview_id} recorded. Ready to provision workspaces.`,
          });
          setFinishOpen(false);
        },
        onError: (err) =>
          toast.error(`Could not initialize tenant: ${(err as Error).message}`),
      },
    );
  };

  const progress = Math.round((done.length / STEPS.length) * 100);
  const nextStep = STEPS.find((s) => !done.includes(s.id));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold">Onboarding</h1>
          <p className="mt-2 text-muted-foreground">
            Walk through tenant configuration. <span className="font-semibold text-foreground">{progress}%</span> complete · {done.length}/{STEPS.length} steps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nextStep && (
            <Button className="bg-gradient-accent" onClick={() => setActive(nextStep)}>
              Continue: {nextStep.title}
            </Button>
          )}
          {!nextStep && (
            <Button
              className="bg-gradient-accent"
              onClick={() => setFinishOpen(true)}
            >
              <Rocket className="mr-2 h-4 w-4" />Finish onboarding
            </Button>
          )}
          <Button variant="outline" onClick={reset}>Reset</Button>
        </div>
      </div>

      <div className="ui-card rounded-lg p-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding progress">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-gradient-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ol className="space-y-3">
        {STEPS.map((s, i) => {
          const isDone = done.includes(s.id);
          const Icon = s.icon;
          return (
            <li key={s.id} className="ui-card rounded-lg p-4 flex items-start gap-4">
              <button
                onClick={() => toggle(s.id)}
                aria-pressed={isDone}
                aria-label={`${s.title}: ${isDone ? "complete" : "incomplete"}`}
                className="mt-0.5"
              >
                {isDone
                  ? <CheckCircle2 className="h-5 w-5 text-success" />
                  : <Circle className="h-5 w-5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">0{i + 1}</span>
                  <Icon className="h-4 w-4 text-product" aria-hidden />
                  <h3 className="font-bold">{s.title}</h3>
                  <Badge variant="outline" className={cn("text-[10px]", isDone && "border-success/40 text-success")}>
                    {isDone ? "Complete" : "To do"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActive(s)}>
                {isDone ? "Revisit" : "Configure"}
              </Button>
            </li>
          );
        })}
      </ol>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finish onboarding — initialize tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tenant-org">Organization name</Label>
              <Input
                id="tenant-org"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Public Sector"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenant-admin">Primary admin email</Label>
              <Input
                id="tenant-admin"
                type="email"
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                placeholder="admin@example.org"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="tenant-arch">Archetype</Label>
                <select
                  id="tenant-arch"
                  value={archetype}
                  onChange={(e) => setArchetype(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="kb">Knowledge Base</option>
                  <option value="policy">Policy Library</option>
                  <option value="case">Case Archive</option>
                  <option value="bi">BI Copilot</option>
                  <option value="decision">Decision Support</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-mode">Mode</Label>
                <select
                  id="tenant-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="Advisory">Advisory</option>
                  <option value="Decision-informing">Decision-informing</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-cls">Classification</Label>
                <select
                  id="tenant-cls"
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as typeof classification)}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="unclassified">Unclassified</option>
                  <option value="restricted">restricted</option>
                  <option value="sensitive">sensitive</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-accent"
              onClick={submitTenantInit}
              disabled={completeOnboarding.isPending}
            >
              {completeOnboarding.isPending ? "Initializing…" : "Initialize tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <active.icon className="h-5 w-5 text-product" aria-hidden />
                  {active.title}
                </SheetTitle>
                <SheetDescription>{active.desc}</SheetDescription>
              </SheetHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); markDone(active.id); }}
                className="mt-6 space-y-4"
              >
                {active.fields.map((f) => (
                  <div key={f.label} className="space-y-1.5">
                    <Label>{f.label}</Label>
                    {f.multiline
                      ? <Textarea placeholder={f.placeholder} rows={3} />
                      : <Input placeholder={f.placeholder} />}
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="bg-gradient-accent flex-1">Save & complete</Button>
                  <Button type="button" variant="outline" onClick={() => setActive(null)}>Cancel</Button>
                </div>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
