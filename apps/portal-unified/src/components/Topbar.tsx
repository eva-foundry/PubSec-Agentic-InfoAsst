import { useLocation, Link } from "react-router-dom";
import { useCustomizer } from "@/contexts/ThemeCustomizer";
import { ThemeCustomizerButton } from "@/components/ThemeCustomizerButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Search, ShieldCheck, Menu, HelpCircle } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCommandPalette } from "@/components/CommandPalette";
import { useShortcuts } from "@/components/ShortcutsOverlay";
import { PortalChip } from "@/components/PortalChip";
import { useTranslation } from "react-i18next";

const ROUTE_LABEL_KEYS: Record<string, string> = {
  "": "nav.home",
  chat: "nav.chat",
  catalog: "nav.catalog",
  "my-workspace": "nav.myWorkspace",
  onboarding: "nav.onboarding",
  models: "nav.models",
  cost: "nav.cost",
  aiops: "nav.aiops",
  drift: "nav.drift",
  liveops: "nav.liveops",
  devops: "nav.devops",
  compliance: "nav.compliance",
  "red-team": "nav.redTeam",
  pricing: "nav.pricing",
  about: "nav.about",
};

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const loc = useLocation();
  const segments = loc.pathname.split("/").filter(Boolean);
  const { theme, setTheme, assurance, setAssurance } = useCustomizer();
  const { open } = useCommandPalette();
  const { open: openShortcuts } = useShortcuts();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-3 px-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMobileNav} aria-label={t("topbar.menu")}>
          <Menu className="h-4 w-4" />
        </Button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm min-w-0">
          <Link to="/" className="text-muted-foreground hover:text-foreground">AIA</Link>
          {segments.map((s, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              <span className="text-muted-foreground/50">/</span>
              <span className="truncate font-medium">
                {ROUTE_LABEL_KEYS[s] ? t(ROUTE_LABEL_KEYS[s]) : s}
              </span>
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <PortalChip />
          <button
            onClick={open}
            data-tour="cmdk"
            className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={t("topbar.commandPalette")}
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span>{t("common.search")}</span>
            <kbd className="ml-2 rounded bg-background border border-border px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
                aria-label={`Assurance level: ${assurance}`}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-product" aria-hidden />
                {assurance}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setAssurance("Advisory")}>Advisory</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAssurance("Decision-informing")}>Decision-informing</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeCustomizerButton />
          <LanguageSwitcher />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={openShortcuts}
                data-tour="shortcuts"
                aria-label={t("topbar.shortcuts")}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              <span>{t("topbar.shortcuts")}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                ?
              </kbd>
            </TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("topbar.toggleTheme")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
