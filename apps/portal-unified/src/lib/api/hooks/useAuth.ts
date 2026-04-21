import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type { UserContext } from "@/lib/api/types";
import { qk } from "@/lib/api/keys";

export const useDemoUsers = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.auth.demoUsers(),
    queryFn: () => client.get<UserContext[]>("/v1/aia/auth/demo/users"),
  });
};

export const useDemoLogin = () => {
  const client = useApiClient();
  return useMutation({
    mutationFn: (email: string) => client.post<UserContext>("/v1/aia/auth/demo/login", { email }),
  });
};
