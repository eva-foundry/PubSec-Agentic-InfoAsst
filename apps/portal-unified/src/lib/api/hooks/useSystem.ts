import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/contexts/ApiProvider";
import type { SystemInfo } from "@/lib/api/types";
import { qk } from "@/lib/api/keys";

export const useSystemInfo = () => {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.system.info(),
    queryFn: () => client.get<SystemInfo>("/v1/eva/system/info"),
  });
};
