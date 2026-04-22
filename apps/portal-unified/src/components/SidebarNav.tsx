import { useCustomizer } from "@/contexts/ThemeCustomizer";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { NAV, GENERAL_NAV, PORTAL_LABEL_KEYS } from "@/lib/nav-config";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { portal } = useCustomizer();
  const { t } = useTranslation();
  const items = NAV[portal];

  const itemClass = "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors";
  const activeClass = "!bg-sidebar-accent !text-sidebar-foreground border-l-2 border-product pl-[10px] font-medium";

  return (
    <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto scrollbar-thin" aria-label={t("portal.switcher")}>
      <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t(PORTAL_LABEL_KEYS[portal])}
      </div>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end className={itemClass} activeClassName={activeClass} onClick={onNavigate}>
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          <span>{t(item.labelKey)}</span>
        </NavLink>
      ))}

      <div className="pt-4 px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t("portal.switcher")}
      </div>
      {GENERAL_NAV.map((item) => (
        <NavLink key={item.to} to={item.to} className={itemClass} activeClassName={activeClass} onClick={onNavigate}>
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          <span>{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
};

export function SidebarFooter() {
  const { portal } = useCustomizer();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.name ?? "—";
  const displayEmail = user?.email ?? "";
  const tenantTag = user?.workspace_grants?.[0] ?? user?.role ?? "guest";

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="border-t border-sidebar-border p-3 text-xs">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-accent grid place-items-center text-[11px] font-bold text-white">
          {initialsOf(displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{displayName}</div>
          <div className="truncate text-muted-foreground text-[11px]">{displayEmail}</div>
        </div>
        {user && (
          <button
            type="button"
            onClick={onLogout}
            aria-label={t("auth.logout", "Log out")}
            title={t("auth.logout", "Log out")}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-product" aria-hidden />
          {t(PORTAL_LABEL_KEYS[portal])}
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 font-medium text-foreground">{tenantTag}</span>
      </div>
    </div>
  );
}
