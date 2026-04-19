import { useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConversations } from "@/lib/api/hooks/useChat";
import { useDocuments, useUploadDocument } from "@/lib/api/hooks/useDocuments";
import { useWorkspaces } from "@/lib/api/hooks/useWorkspaces";
import {
  useAddTeamMember, useBookings, useRemoveTeamMember, useTeamMembers, useUpdateMemberRole,
} from "@/lib/api/hooks/useTeam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, FileText, Upload, UserPlus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const PIPELINE_STAGES = ["Queued", "Extracting", "Chunking", "Embedding", "Indexed"];

// Map backend DocumentRecord.status → pipeline stage index.
const STAGE_BY_STATUS: Record<string, number> = {
  uploaded: 0,
  processing: 1,
  chunking: 2,
  embedding: 3,
  indexed: 4,
  error: 0,
};

type Role = "reader" | "contributor" | "admin";

export default function MyWorkspace() {
  const navigate = useNavigate();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("contributor");
  const [docQuery, setDocQuery] = useState("");
  const [convoQuery, setConvoQuery] = useState("");

  const bookings = useBookings();
  const firstBookingId = bookings.data?.[0]?.id ?? null;
  const team = useTeamMembers(firstBookingId);
  const addMember = useAddTeamMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveTeamMember();

  const workspaces = useWorkspaces();
  const [uploadWorkspaceId, setUploadWorkspaceId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMutation = useUploadDocument();

  const activeUploadWs =
    uploadWorkspaceId || workspaces.data?.[0]?.id || "";

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!activeUploadWs) {
      toast.error("No workspace available to upload to.");
      return;
    }
    uploadMutation.mutate(
      { workspaceId: activeUploadWs, file },
      {
        onSuccess: (doc) =>
          toast.success(`Uploaded ${doc.file_name ?? file.name}`, {
            description: `to ${activeUploadWs}`,
          }),
        onError: (err) => toast.error(`Upload failed: ${(err as Error).message}`),
      },
    );
    e.target.value = "";
  };

  const documents = useDocuments({});
  const filteredDocs = useMemo(
    () => (documents.data ?? []).filter((d) => {
      const q = docQuery.toLowerCase();
      return (
        d.file_name.toLowerCase().includes(q) ||
        d.workspace_id.toLowerCase().includes(q)
      );
    }),
    [documents.data, docQuery],
  );

  const conversations = useConversations();
  const filteredConvos = useMemo(
    () => (conversations.data ?? []).filter((t) =>
      t.title.toLowerCase().includes(convoQuery.toLowerCase()) ||
      (t.workspace_id ?? "").toLowerCase().includes(convoQuery.toLowerCase())
    ),
    [convoQuery, conversations.data],
  );

  const teamCount = team.data?.length ?? 0;
  const docsCount = documents.data?.length ?? 0;

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstBookingId) {
      toast.error("No active booking — create one first.");
      return;
    }
    if (!inviteEmail.includes("@")) {
      toast.error("Please enter a valid email.");
      return;
    }
    const name = inviteEmail
      .split("@")[0]
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    addMember.mutate(
      { bookingId: firstBookingId, email: inviteEmail, name, role: inviteRole },
      {
        onSuccess: () => {
          toast.success(`Invited ${inviteEmail} as ${inviteRole}.`);
          setInviteEmail("");
        },
        onError: (err) =>
          toast.error(`Invite failed: ${(err as Error).message}`),
      },
    );
  };

  const onRemove = (userId: string, email: string) => {
    if (!firstBookingId) return;
    removeMember.mutate(
      { bookingId: firstBookingId, userId },
      {
        onSuccess: () => toast(`Removed ${email}.`),
        onError: (err) => toast.error(`Remove failed: ${(err as Error).message}`),
      },
    );
  };

  const onRoleChange = (userId: string, role: Role, email: string) => {
    if (!firstBookingId) return;
    updateRole.mutate(
      { bookingId: firstBookingId, userId, role },
      {
        onSuccess: () => toast.success(`${email} is now ${role}.`),
        onError: (err) => toast.error(`Role update failed: ${(err as Error).message}`),
      },
    );
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
          <TabsTrigger value="team">Team ({teamCount})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({docsCount})</TabsTrigger>
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
            filteredConvos.map((t) => {
              const ts = t.last_message_at ? new Date(t.last_message_at) : null;
              const tsLabel = ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleDateString() : "—";
              return (
                <div key={t.conversation_id} className="ui-card rounded-lg p-4 flex items-center gap-3">
                  <FileText className="h-4 w-4 text-product shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.workspace_id ?? "—"} · {tsLabel}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>Open</Button>
                </div>
              );
            })
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
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="contributor">Contributor</SelectItem>
                    <SelectItem value="reader">Reader</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="bg-gradient-accent"
                disabled={!firstBookingId || addMember.isPending}
              >
                <UserPlus className="mr-2 h-4 w-4" />Invite
              </Button>
            </form>
            {!firstBookingId && !bookings.isLoading && (
              <p className="mt-2 text-xs text-muted-foreground">
                No active booking — team management unlocks once a workspace booking is active.
              </p>
            )}
          </div>
          <div className="ui-card rounded-lg overflow-hidden">
            {team.isLoading || bookings.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : team.isError ? (
              <div className="p-6">
                <EmptyState title="Could not load team" description={team.error?.message} />
              </div>
            ) : (team.data?.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState title="No team members yet" description="Invite a teammate to get started." />
              </div>
            ) : (
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
                  {team.data!.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{m.name}</td>
                      <td className="p-3 text-muted-foreground">{m.email}</td>
                      <td className="p-3">
                        <Select
                          value={m.role}
                          onValueChange={(v) => onRoleChange(m.user_id, v as Role, m.email)}
                        >
                          <SelectTrigger className="h-7 w-[130px] text-xs" aria-label={`Role for ${m.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="contributor">Contributor</SelectItem>
                            <SelectItem value="reader">Reader</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-danger"
                          onClick={() => onRemove(m.user_id, m.email)}
                          aria-label={`Remove ${m.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-2 mt-6">
          <div className="ui-card rounded-lg p-3 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                placeholder="Search documents…"
                className="pl-9"
                aria-label="Search documents"
              />
            </div>
            <Select
              value={activeUploadWs}
              onValueChange={setUploadWorkspaceId}
            >
              <SelectTrigger
                className="w-[220px] h-9"
                aria-label="Upload target workspace"
              >
                <SelectValue placeholder="Choose workspace…" />
              </SelectTrigger>
              <SelectContent>
                {(workspaces.data ?? []).map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}{ws.cost_centre ? ` · ${ws.cost_centre}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onFilePicked}
              aria-label="Upload document"
            />
            <Button
              className="bg-gradient-accent"
              disabled={!activeUploadWs || uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
          {documents.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : documents.isError ? (
            <EmptyState title="Could not load documents" description={documents.error?.message} />
          ) : filteredDocs.length === 0 ? (
            <EmptyState
              title={(documents.data?.length ?? 0) === 0 ? "No documents yet" : "No documents match"}
              description={(documents.data?.length ?? 0) === 0 ? "Pick a workspace above and click Upload to add your first document." : "Try a different search term."}
            />
          ) : (
            filteredDocs.map((d) => {
              const stage = STAGE_BY_STATUS[d.status] ?? 0;
              return (
                <div key={d.id} className="ui-card rounded-lg p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <FileText className="h-4 w-4 text-product shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{d.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.workspace_id} · {d.indexed_at ? `indexed ${new Date(d.indexed_at).toLocaleDateString()}` : `uploaded ${new Date(d.uploaded_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
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
                          variant={i <= stage ? "default" : "outline"}
                          className={cn(
                            "text-[10px]",
                            i <= stage
                              ? (i === stage && stage < 4 ? "bg-warning text-foreground" : "bg-success text-foreground")
                              : "text-muted-foreground"
                          )}
                        >
                          {i < stage && <CheckCircle2 className="h-3 w-3 mr-1" />}{stg}
                        </Badge>
                        {i < PIPELINE_STAGES.length - 1 && <span className="text-muted-foreground/40" aria-hidden>→</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
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
              <p className="mt-1 text-xs text-muted-foreground">Saved on blur. Persistence to <code>/admin/workspaces/*/valves</code> pending.</p>
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
