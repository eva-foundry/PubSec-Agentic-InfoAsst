import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { PortalKey } from "@/lib/api/types";
import type { ReactNode } from "react";

export function RequireAuth({ children, portal }: { children: ReactNode; portal?: PortalKey }) {
  const { user, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (portal && !user.portal_access.includes(portal)) {
    return <Navigate to="/chat" replace />;
  }
  return <>{children}</>;
}
