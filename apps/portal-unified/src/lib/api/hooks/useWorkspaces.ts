import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type { ArchetypeDefinition, Workspace } from "@/lib/api/types";
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

/** Catalog of workspace archetypes — bilingual template metadata from the api-gateway. */
export const useArchetypes = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.workspaces.archetypes(),
    queryFn: () => client.get<ArchetypeDefinition[]>("/v1/eva/archetypes"),
    staleTime: 5 * 60 * 1000,
  });
};
