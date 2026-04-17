import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHAT_THREADS } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, FileText, UserPlus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const PIPELINE_STAGES = ["Queued", "Extracting", "Chunking", "Embedding", "Indexed"];
const INITIAL_DOCS = [
  { name: "HR-Handbook-v4.2.pdf", workspace: "Internal HR Handbook", stage: 4, archetype: "Knowledge Base", verified: "2025-04-12" },
  { name: "Postgres-Failover-Runbook.md", workspace: "Engineering Runbooks", stage: 4, archetype: "Policy Library", verified: "2025-04-15" },
  { name: "MSA-Acme-2024.pdf", workspace: "Legal Contract Archive", stage: 3, archetype: "Case Archive", verified: "2025-04-08" },
  { name: "Q1-Sales-Dashboard-export.csv", workspace: "Sales BI Dashboard", stage: 2, archetype: "BI Copilot", verified: "—" },
  { name: "Vendor-X-SOC2.pdf", workspace: "Vendor Risk Decisions", stage: 1, archetype: "Decision Support", verified: "—" },
];

type Role = "Admin" | "Contributor" | "Reader";
interface Member { name: string; email: string; role: Role }

const INITIAL_TEAM: Member[] = [
  { name: "Alice Chen", email: "alice@acme.com", role: "Admin" },
  { name: "Bob Martinez", email: "bob@acme.com", role: "Contributor" },
  { name: "Carol Singh", email: "carol@acme.com", role: "Reader" },
  { name: "Dmitri Volkov", email: "dmitri@acme.com", role: "Contributor" },
];

export default function MyWorkspace() {
  const navigate = useNavigate();
  const [team, setTeam] = useState<Member[]>(INITIAL_TEAM);
  const [docs] = useState(INITIAL_DOCS);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Contributor");
  const [docQuery, setDocQuery] = useState("");
  const [convoQuery, setConvoQuery] = useState("");

  const filteredDocs = useMemo(
    () => docs.filter((d) =>
      d.name.toLowerCase().includes(docQuery.toLowerCase()) ||
      d.workspace.toLowerCase().includes(docQuery.toLowerCase())
    ),
    [docs, docQuery],
  );

  const filteredConvos = useMemo(
    () => CHAT_THREADS.filter((t) =>
      t.title.toLowerCase().includes(convoQuery.toLowerCase()) ||
      t.workspace.toLowerCase().includes(convoQuery.toLowerCase())
    ),
    [convoQuery],
  );

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.includes("@")) {
      toast.error("Please enter a valid email.");
      return;
    }
    if (team.some((m) => m.email === inviteEmail)) {
      toast.error("That email is already on the team.");
      return;
    }
    const name = inviteEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    setTeam((t) => [...t, { name, email: inviteEmail, role: inviteRole }]);
    toast.success(`Invited ${inviteEmail} as ${inviteRole}.`);
    setInviteEmail("");
  };

  const removeMember = (email: string) => {
    setTeam((t) => t.filter((m) => m.email !== email));
    toast(`Removed ${email}.`);
  };

  const updateRole = (email: string, role: Role) => {
    setTeam((t) => t.map((m) => (m.email === email ? { ...m, role } : m)));
    toast.success(`${email} is now ${role}.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">My Workspace</h1>
        <p className="mt-2 text-muted-foreground">Conversations, team, documents, and settings for your active workspaces.</p>
      </div>

      <Tabs defaultValue="conversations" className="w-full">
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="team">Team ({team.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-2 mt-6">
          <div className="ui-card rounded-lg p-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                value={convoQuery}
                onChange={(e) => setConvoQuery(e.target.value)}
                placeholder="Search conversations…"
                className="pl-9"
                aria-label="Search conversations"
              />
            </div>
          </div>
          {filteredConvos.length === 0 ? (
            <EmptyState title="No conversations match" description="Try a different search term." />
          ) : (
            filteredConvos.map((t) => (
              <div key={t.id} className="ui-card rounded-lg p-4 flex items-center gap-3">
                <FileText className="h-4 w-4 text-product shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.workspace} · {t.updated}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>Open</Button>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4 mt-6">
          <div className="ui-card rounded-lg p-4">
            <form onSubmit={invite} className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="invite-email">Invite a teammate</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@company.com"
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                  <SelectTrigger id="invite-role" className="w-[140px]" aria-label="Invite role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Contributor">Contributor</SelectItem>
                    <SelectItem value="Reader">Reader</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="bg-gradient-accent">
                <UserPlus className="mr-2 h-4 w-4" />Invite
              </Button>
            </form>
          </div>
          <div className="ui-card rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th scope="col" className="text-left p-3 font-medium">Name</th>
                  <th scope="col" className="text-left p-3 font-medium">Email</th>
                  <th scope="col" className="text-left p-3 font-medium">Role</th>
                  <th scope="col" className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.email} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{m.name}</td>
                    <td className="p-3 text-muted-foreground">{m.email}</td>
                    <td className="p-3">
                      <Select value={m.role} onValueChange={(v) => updateRole(m.email, v as Role)}>
                        <SelectTrigger className="h-7 w-[130px] text-xs" aria-label={`Role for ${m.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Contributor">Contributor</SelectItem>
                          <SelectItem value="Reader">Reader</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-danger"
                        onClick={() => removeMember(m.email)}
                        aria-label={`Remove ${m.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-2 mt-6">
          <div className="ui-card rounded-lg p-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                placeholder="Search documents…"
                className="pl-9"
                aria-label="Search documents"
              />
            </div>
          </div>
          {filteredDocs.length === 0 ? (
            <EmptyState title="No documents match" description="Try a different search term." />
          ) : (
            filteredDocs.map((d) => (
              <div key={d.name} className="ui-card rounded-lg p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <FileText className="h-4 w-4 text-product shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.workspace} · last verified {d.verified}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{d.archetype}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => toast("Trace would open the document graph + access log.")}
                  >trace ↗</Button>
                </div>
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  {PIPELINE_STAGES.map((stg, i) => (
                    <div key={stg} className="flex items-center gap-1.5">
                      <Badge
                        variant={i <= d.stage ? "default" : "outline"}
                        className={cn(
                          "text-[10px]",
                          i <= d.stage
                            ? (i === d.stage && d.stage < 4 ? "bg-warning text-foreground" : "bg-success text-foreground")
                            : "text-muted-foreground"
                        )}
                      >
                        {i < d.stage && <CheckCircle2 className="h-3 w-3 mr-1" />}{stg}
                      </Badge>
                      {i < PIPELINE_STAGES.length - 1 && <span className="text-muted-foreground/40" aria-hidden>→</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-4">
          <div className="ui-card rounded-lg p-5 space-y-4">
            <div>
              <Label htmlFor="sys-prompt">System prompt override</Label>
              <Textarea
                id="sys-prompt"
                rows={3}
                defaultValue="Always answer with citations. Decline if no grounding is found."
                onBlur={() => toast.success("System prompt saved")}
              />
              <p className="mt-1 text-xs text-muted-foreground">Saved on blur.</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="freshness">Strict freshness policy</Label>
                <p className="text-xs text-muted-foreground">Refuse to answer from sources older than 90 days.</p>
              </div>
              <Switch
                id="freshness"
                defaultChecked
                onCheckedChange={(v) => toast(v ? "Freshness policy ON" : "Freshness policy OFF")}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="hitl">HITL gate on decision-support</Label>
                <p className="text-xs text-muted-foreground">Require human approval for any decision-support output.</p>
              </div>
              <Switch
                id="hitl"
                defaultChecked
                onCheckedChange={(v) => toast(v ? "HITL gate ON" : "HITL gate OFF")}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
