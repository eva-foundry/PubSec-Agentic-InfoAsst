import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type { ArchetypeDefinition, Workspace } from "@/lib/api/types";
import { qk } from "@/lib/api/keys";

export interface CreateWorkspaceRequest {
  name: string;
  archetype: string;
  data_classification?: "unclassified" | "restricted" | "sensitive";
  cost_centre?: string;
  description?: string;
  name_fr?: string;
  description_fr?: string;
}

export const useWorkspaces = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.workspaces.list(),
    queryFn: () => client.get<Workspace[]>("/v1/aia/workspaces"),
  });
};

export const useWorkspace = (workspaceId: string | null) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.workspaces.detail(workspaceId ?? "__none__"),
    queryFn: () => client.get<Workspace>(`/v1/aia/workspaces/${workspaceId}`),
    enabled: !!workspaceId,
  });
};

export const useCreateWorkspace = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWorkspaceRequest) =>
      client.post<Workspace>("/v1/aia/workspaces", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workspaces.list() }),
  });
};

/** Catalog of workspace archetypes — bilingual template metadata from the api-gateway. */
export const useArchetypes = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.workspaces.archetypes(),
    queryFn: () => client.get<ArchetypeDefinition[]>("/v1/aia/archetypes"),
    staleTime: 5 * 60 * 1000,
  });
};
