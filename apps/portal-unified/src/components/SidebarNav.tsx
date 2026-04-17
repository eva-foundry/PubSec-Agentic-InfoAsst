import { useCustomizer } from "@/contexts/ThemeCustomizer";
import { NavLink } from "@/components/NavLink";
import { NAV, GENERAL_NAV, PORTAL_LABEL_KEYS } from "@/lib/nav-config";
import { useTranslation } from "react-i18next";

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

export function SidebarFooter() {
  const { portal } = useCustomizer();
  const { t } = useTranslation();
  return (
    <div className="border-t border-sidebar-border p-3 text-xs">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-accent grid place-items-center text-[11px] font-bold text-white">JM</div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">Jordan Mehta</div>
          <div className="truncate text-muted-foreground text-[11px]">jordan@acme.com</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-product" aria-hidden />
          {t(PORTAL_LABEL_KEYS[portal])}
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 font-medium text-foreground">acme-prod</span>
      </div>
    </div>
  );
}
