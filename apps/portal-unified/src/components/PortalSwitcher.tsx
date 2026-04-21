import { useEffect } from "react";
import { useCustomizer, PortalMode } from "@/contexts/ThemeCustomizer";
import { useAuth } from "@/contexts/AuthContext";
import { portalAllowed } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const MODES: { id: PortalMode; key: string }[] = [
  { id: "workspace", key: "portal.workspace" },
  { id: "admin", key: "portal.admin" },
  { id: "ops", key: "portal.ops" },
];

export function PortalSwitcher() {
  const { portal, setPortal } = useCustomizer();
  const { user } = useAuth();
  const { t } = useTranslation();

  const access = user?.portal_access;
  const allowed = MODES.filter((m) => portalAllowed(m.id, access));

  // If the currently-selected portal is not in the user's grants, auto-switch
  // to the first one that is. Prevents a stale localStorage portal from
  // showing the user an inaccessible nav.
  useEffect(() => {
    if (!access) return;
    if (!portalAllowed(portal, access) && allowed.length > 0) {
      setPortal(allowed[0].id);
    }
  }, [access, portal, setPortal, allowed]);

  if (allowed.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label={t("portal.switcher")}
      data-tour="portal-switcher"
      className={cn(
        "grid gap-1 rounded-md bg-muted/60 p-1 text-xs",
        allowed.length === 2 ? "grid-cols-2" : "grid-cols-3",
      )}
    >
      {allowed.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={portal === m.id}
          onClick={() => setPortal(m.id)}
          className={cn(
            "rounded px-2 py-1.5 font-medium transition-colors",
            portal === m.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(m.key)}
        </button>
      ))}
    </div>
  );
}
