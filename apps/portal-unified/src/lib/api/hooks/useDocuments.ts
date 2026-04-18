import { useQuery } from "@tanstack/react-query";
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
      client.get<Document[]>("/v1/eva/documents", {
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
