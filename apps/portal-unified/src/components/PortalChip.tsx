import { useCustomizer } from "@/contexts/ThemeCustomizer";
import { useTranslation } from "react-i18next";
import { PORTAL_LABEL_KEYS } from "@/lib/nav-config";
import { Briefcase, ShieldCheck, Activity } from "lucide-react";

const ICONS = {
  workspace: Briefcase,
  admin: ShieldCheck,
  ops: Activity,
} as const;

/**
 * Compact chip that displays the active portal mode. Lives in the topbar so
 * users always know which mode they're operating in. Color follows the
 * customizer's product accent.
 */
export function PortalChip() {
  const { portal } = useCustomizer();
  const { t } = useTranslation();
  const Icon = ICONS[portal];
  return (
    <span
      role="status"
      aria-label={`${t("portal.switcher")}: ${t(PORTAL_LABEL_KEYS[portal])}`}
      className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-product/30 bg-product/10 px-2.5 py-1 text-[11px] font-medium text-product"
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span>{t(PORTAL_LABEL_KEYS[portal])}</span>
    </span>
  );
}
