import { useMemo, useState } from "react";
import { Building2, Check, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import {
  useAdminWorkspaces,
  useUpdateAdminWorkspace,
} from "@/lib/api/hooks/useAdmin";
import type { AdminWorkspace } from "@/lib/api/hooks/useAdmin";

export default function AdminWorkspaces() {
  const workspaces = useAdminWorkspaces();
  const update = useUpdateAdminWorkspace();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const rows = useMemo(() => {
    const list = workspaces.data ?? [];
    const q = query.toLowerCase();
    return q
      ? list.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            (w.cost_centre ?? "").toLowerCase().includes(q) ||
            (w.client_name ?? "").toLowerCase().includes(q) ||
            w.id.toLowerCase().includes(q),
        )
      : list;
  }, [workspaces.data, query]);

  const startEdit = (w: AdminWorkspace) => {
    setEditingId(w.id);
    setDraftValue(w.cost_centre ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftValue("");
  };

  const saveEdit = (w: AdminWorkspace) => {
    const next = draftValue.trim();
    if (next === (w.cost_centre ?? "")) {
      cancelEdit();
      return;
    }
    update.mutate(
      { workspaceId: w.id, body: { cost_centre: next } },
      {
        onSuccess: () => {
          toast.success(`${w.name}: cost-centre set to ${next || "—"}`);
          cancelEdit();
        },
        onError: (err) =>
          toast.error(`Update failed: ${(err as Error).message}`),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Workspaces · Admin</h1>
        <p className="mt-2 text-muted-foreground">
          Assign a cost-centre to each workspace so every chat + upload rolls
          up into the Cost page's FinOps breakdown.
        </p>
      </div>

      <div className="ui-card rounded-lg p-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, id, cost-centre, client…"
            className="pl-9"
            aria-label="Search workspaces"
          />
        </div>
      </div>

      <div className="ui-card rounded-lg overflow-hidden">
        {workspaces.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : workspaces.isError ? (
          <div className="p-6">
            <EmptyState
              title="Could not load workspaces"
              description={workspaces.error?.message}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No workspaces"
              description="Provision one from the Catalog."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th scope="col" className="text-left p-3 font-medium">
                  Workspace
                </th>
                <th scope="col" className="text-left p-3 font-medium">
                  Client
                </th>
                <th scope="col" className="text-left p-3 font-medium">
                  Classification
                </th>
                <th scope="col" className="text-left p-3 font-medium">
                  Cost centre
                </th>
                <th scope="col" className="text-right p-3 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const editing = editingId === w.id;
                return (
                  <tr key={w.id} className="border-b border-border last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Building2
                          className="h-4 w-4 text-product shrink-0"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{w.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {w.id} · {w.archetype ?? w.type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {w.client_name || "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">
                        {w.data_classification}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {editing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            placeholder="CC-ESDC-3042"
                            className="h-7 w-[200px] text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(w);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-success"
                            onClick={() => saveEdit(w)}
                            disabled={update.isPending}
                            aria-label="Save cost-centre"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelEdit}
                            aria-label="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(w)}
                          className="inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-xs hover:border-border hover:bg-muted/40"
                          aria-label={`Edit cost-centre for ${w.name}`}
                        >
                          {w.cost_centre ? (
                            <span className="font-mono">{w.cost_centre}</span>
                          ) : (
                            <span className="italic text-muted-foreground">
                              unassigned
                            </span>
                          )}
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {!editing && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(w)}
                        >
                          Assign
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
