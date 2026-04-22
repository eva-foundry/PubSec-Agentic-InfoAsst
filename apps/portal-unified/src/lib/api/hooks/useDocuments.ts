import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type { Document } from "@/lib/api/types";
import { qk } from "@/lib/api/keys";

export interface DocumentListFilters {
  workspaceId?: string | null;
  q?: string;
  kind?: string;
  limit?: number;
  enabled?: boolean;
}

export const useDocuments = (filters: DocumentListFilters = {}) => {
  const client = useApiClient();
  const { workspaceId = null, q = "", kind = "", limit, enabled = true } = filters;
  return useQuery({
    queryKey: qk.documents.list(workspaceId, q, kind),
    queryFn: () =>
      client.get<Document[]>("/v1/aia/documents", {
        query: {
          workspace_id: workspaceId ?? undefined,
          q: q || undefined,
          kind: kind || undefined,
          limit,
        },
      }),
    enabled,
  });
};

export interface UploadDocumentRequest {
  workspaceId: string;
  file: File;
}

export const useUploadDocument = () => {
  const client = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, file }: UploadDocumentRequest) => {
      const fd = new FormData();
      fd.append("file", file);
      return client.post<Document>("/v1/aia/documents/upload", fd, {
        query: { workspace_id: workspaceId },
        // Tells APIM-sim middleware which workspace this call belongs to, so
        // the telemetry record gets the workspace's cost_centre stamped.
        headers: { "x-workspace-id": workspaceId },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.documents.all }),
  });
};
