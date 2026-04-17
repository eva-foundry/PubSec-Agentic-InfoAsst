import { PortalMode } from "@/contexts/ThemeCustomizer";
import {
  MessageSquare, Library, FolderKanban,
  Workflow, Database, Shield, Building2, ShieldAlert,
  DollarSign, Activity, HeartPulse, Wrench, ScrollText, TrendingDown,
  Sparkles, Info, LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** i18n key under the `nav` namespace */
  labelKey: string;
  to: string;
  icon: LucideIcon;
}

export const NAV: Record<PortalMode, NavItem[]> = {
  workspace: [
    { labelKey: "nav.chat", to: "/chat", icon: MessageSquare },
    { labelKey: "nav.catalog", to: "/catalog", icon: Library },
    { labelKey: "nav.myWorkspace", to: "/my-workspace", icon: FolderKanban },
  ],
  admin: [
    { labelKey: "nav.onboarding", to: "/onboarding", icon: Workflow },
    { labelKey: "nav.models", to: "/models", icon: Database },
    { labelKey: "nav.workspaces", to: "/catalog", icon: Building2 },
    { labelKey: "nav.redTeam", to: "/red-team", icon: ShieldAlert },
    { labelKey: "nav.compliance", to: "/compliance", icon: Shield },
  ],
  ops: [
    { labelKey: "nav.cost", to: "/cost", icon: DollarSign },
    { labelKey: "nav.aiops", to: "/aiops", icon: Activity },
    { labelKey: "nav.drift", to: "/drift", icon: TrendingDown },
    { labelKey: "nav.liveops", to: "/liveops", icon: HeartPulse },
    { labelKey: "nav.devops", to: "/devops", icon: Wrench },
    { labelKey: "nav.complianceShort", to: "/compliance", icon: ScrollText },
  ],
};

export const GENERAL_NAV: NavItem[] = [
  { labelKey: "nav.pricing", to: "/pricing", icon: Sparkles },
  { labelKey: "nav.about", to: "/about", icon: Info },
];

export const PORTAL_LABEL_KEYS: Record<PortalMode, string> = {
  workspace: "portal.workspace",
  admin: "portal.admin",
  ops: "portal.ops",
};
