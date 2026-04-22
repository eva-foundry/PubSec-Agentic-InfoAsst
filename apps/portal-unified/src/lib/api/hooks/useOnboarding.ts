import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";

export interface TenantInitRequest {
  org_name: string;
  region?: string;
  industry?: string;
  primary_admin_email: string;

  default_classification?: "unclassified" | "restricted" | "sensitive";
  classification_notes?: string;

  default_mode?: "Advisory" | "Decision-informing";
  hitl_threshold?: string;

  preferred_archetype?: string;
  initial_corpus_hint?: string;

  idp_group_admin?: string;
  idp_group_contributor?: string;
  idp_group_reader?: string;

  invitees?: string[];
  pilot_question?: string;
}

export interface TenantInitResponse {
  client_id: string;
  interview_id: string;
  status: string;
}

export const useCompleteOnboarding = () => {
  const client = useApiClient();
  return useMutation({
    mutationFn: (body: TenantInitRequest) =>
      client.post<TenantInitResponse>("/v1/aia/admin/tenants/init", body),
  });
};
