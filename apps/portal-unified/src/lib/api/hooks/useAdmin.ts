import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type {
  Client,
  DeploymentRecord,
  Interview,
  ModelConfig,
  PromptVersion,
  Workspace,
  WorkspaceProvisionPlan,
} from "@/lib/api/types";
import { qk } from "@/lib/api/keys";

export const useAdminClients = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.admin.clients(),
    queryFn: () => client.get<Client[]>("/v1/aia/admin/clients"),
  });
};

export const useCreateClient = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Client>) => client.post<Client>("/v1/aia/admin/clients", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.admin.clients() }),
  });
};

export const useClientInterviews = (clientId: string | null) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.admin.interviews(clientId ?? "__none__"),
    queryFn: () => client.get<Interview[]>(`/v1/aia/admin/clients/${clientId}/interviews`),
    enabled: !!clientId,
  });
};

export const useProvisionWorkspace = () => {
  const client = useApiClient();
  return useMutation({
    mutationFn: (body: { workspace_id: string; dry_run: boolean }) =>
      client.post<WorkspaceProvisionPlan>("/v1/aia/admin/workspaces/provision", body),
  });
};

/** Admin list of every workspace with client + health, for cost-centre editing. */
export interface AdminWorkspace extends Workspace {
  client_id: string;
  client_name: string;
  health: string;
}

export const useAdminWorkspaces = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.admin.workspaces(),
    queryFn: () => client.get<AdminWorkspace[]>("/v1/aia/admin/workspaces"),
  });
};

export interface WorkspaceAdminUpdate {
  cost_centre?: string;
  name?: string;
}

export const useUpdateAdminWorkspace = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, body }: { workspaceId: string; body: WorkspaceAdminUpdate }) =>
      client.patch<Workspace>(`/v1/aia/admin/workspaces/${workspaceId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.admin.workspaces() });
      qc.invalidateQueries({ queryKey: qk.workspaces.list() });
    },
  });
};

export const useAdminModels = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.admin.models(),
    queryFn: () => client.get<ModelConfig[]>("/v1/aia/admin/models"),
  });
};

export const useToggleModel = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ modelId, isActive }: { modelId: string; isActive: boolean }) =>
      client.post<ModelConfig>(`/v1/aia/admin/models/${modelId}/toggle`, undefined, {
        query: { is_active: isActive },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.admin.models() }),
  });
};

export const useModelHistory = (modelId: string | null) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.admin.modelHistory(modelId ?? "__none__"),
    queryFn: () => client.get<Array<Record<string, unknown>>>(
      `/v1/aia/admin/models/${modelId}/history`,
    ),
    enabled: !!modelId,
  });
};

export const useAdminPrompts = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.admin.prompts(),
    queryFn: () => client.get<Array<{ name: string; active_version: number }>>(
      "/v1/aia/admin/prompts",
    ),
  });
};

export const usePromptVersions = (name: string | null) => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.admin.promptVersions(name ?? "__none__"),
    queryFn: () => client.get<PromptVersion[]>(`/v1/aia/admin/prompts/${name}/versions`),
    enabled: !!name,
  });
};

export const useRollbackPrompt = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, version }: { name: string; version: number }) =>
      client.post<PromptVersion>(`/v1/aia/admin/prompts/${name}/rollback`, { version }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: qk.admin.promptVersions(vars.name) }),
  });
};

export const useRollbackDeployment = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ version, rationale }: { version: string; rationale: string }) =>
      client.post<DeploymentRecord>(
        `/v1/aia/admin/deployments/${version}/rollback`,
        { rationale },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.ops.deployments() }),
  });
};
