import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createApiClient, resolveBaseUrl, type ApiClient } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomizer } from "@/contexts/ThemeCustomizer";

const ApiContext = createContext<ApiClient | null>(null);

export const ApiProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { assurance, portal } = useCustomizer();

  const client = useMemo(() => {
    return createApiClient({
      baseUrl: resolveBaseUrl(),
      getAuthHeaders: () => {
        const h: Record<string, string> = {};
        if (user?.email) h["x-demo-user-email"] = user.email;
        return h;
      },
      getHeaderContext: () => ({
        appId: "portal-unified",
        userGroup: user?.role,
        classification: user?.data_classification_level,
        assuranceLevel: `${portal}:${assurance}`,
      }),
    });
  }, [user, assurance, portal]);

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
};

export const useApiClient = (): ApiClient => {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApiClient must be used inside <ApiProvider>");
  return ctx;
};
