import {
  MessageSquarePlus, Sun, Moon, Layers, Keyboard, BookOpen, type LucideIcon,
} from "lucide-react";
import { PortalMode } from "@/contexts/ThemeCustomizer";

export interface ActionDef {
  id: string;
  /** i18n key for the visible label */
  labelKey: string;
  /** i18n key for the optional hint text on the right */
  hintKey?: string;
  icon: LucideIcon;
  /** Logical effect; the palette wires these to the relevant context handlers. */
  effect:
    | { kind: "navigate"; to: string }
    | { kind: "toggleTheme" }
    | { kind: "cyclePortal" }
    | { kind: "openShortcuts" }
    | { kind: "replayTour" };
}

export const PORTAL_CYCLE: PortalMode[] = ["workspace", "admin", "ops"];

export const ACTIONS: ActionDef[] = [
  {
    id: "act:new-chat",
    labelKey: "actions.newChat",
    hintKey: "actions.newChatHint",
    icon: MessageSquarePlus,
    effect: { kind: "navigate", to: "/chat" },
  },
  {
    id: "act:toggle-theme",
    labelKey: "actions.toggleTheme",
    hintKey: "actions.toggleThemeHint",
    icon: Sun,
    effect: { kind: "toggleTheme" },
  },
  {
    id: "act:cycle-portal",
    labelKey: "actions.cyclePortal",
    hintKey: "actions.cyclePortalHint",
    icon: Layers,
    effect: { kind: "cyclePortal" },
  },
  {
    id: "act:shortcuts",
    labelKey: "actions.openShortcuts",
    hintKey: "actions.openShortcutsHint",
    icon: Keyboard,
    effect: { kind: "openShortcuts" },
  },
  {
    id: "act:replay-tour",
    labelKey: "actions.replayTour",
    hintKey: "actions.replayTourHint",
    icon: BookOpen,
    effect: { kind: "replayTour" },
  },
];

/** Icon override for the toggle-theme action so the icon matches current mode. */
export function getToggleThemeIcon(theme: "dark" | "light"): LucideIcon {
  return theme === "dark" ? Sun : Moon;
}
