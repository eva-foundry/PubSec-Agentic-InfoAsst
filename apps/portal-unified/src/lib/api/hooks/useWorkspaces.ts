import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type { Workspace } from "@/lib/api/types";
import { qk } from "@/lib/api/keys";

export const useWorkspaces = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.workspaces.list(),
    queryFn: () => client.get<Workspace[]>("/v1/eva/workspaces"),
  });
};

export const useWorkspace = (workspaceId: string | null) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.workspaces.detail(workspaceId ?? "__none__"),
    queryFn: () => client.get<Workspace>(`/v1/eva/workspaces/${workspaceId}`),
    enabled: !!workspaceId,
  });
};

/**
 * Archetypes derived client-side from the workspace list while a dedicated
 * endpoint doesn't exist yet (see Phase F follow-ups).
 */
export const useArchetypes = () => {
  const ws = useWorkspaces();
  const archetypes = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; count: number }>();
    for (const w of ws.data ?? []) {
      const key = w.archetype ?? w.type ?? "default";
      const existing = byKey.get(key);
      if (existing) existing.count += 1;
      else byKey.set(key, { key, label: key, count: 1 });
    }
    return Array.from(byKey.values());
  }, [ws.data]);
  return { ...ws, data: archetypes };
};
