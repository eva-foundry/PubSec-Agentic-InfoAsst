import { useCustomizer, PortalMode } from "@/contexts/ThemeCustomizer";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const MODES: { id: PortalMode; key: string }[] = [
  { id: "workspace", key: "portal.workspace" },
  { id: "admin", key: "portal.admin" },
  { id: "ops", key: "portal.ops" },
];

export function PortalSwitcher() {
  const { portal, setPortal } = useCustomizer();
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      aria-label={t("portal.switcher")}
      data-tour="portal-switcher"
      className="grid grid-cols-3 gap-1 rounded-md bg-muted/60 p-1 text-xs"
    >
      {MODES.map((m) => (
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
