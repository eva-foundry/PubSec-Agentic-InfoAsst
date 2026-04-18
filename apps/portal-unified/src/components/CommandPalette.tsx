import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode, MouseEvent } from "react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useWorkspaces } from "@/lib/api/hooks/useWorkspaces";
import { NAV, GENERAL_NAV } from "@/lib/nav-config";
import { fuzzyScore } from "@/lib/cmdk/fuzzy";
import { usePaletteMemory, PINNED_LIMIT } from "@/lib/cmdk/persistence";
import { HighlightedLabel } from "@/components/cmdk/HighlightedLabel";
import { ACTIONS, PORTAL_CYCLE, getToggleThemeIcon } from "@/lib/cmdk/actions";
import { useCustomizer } from "@/contexts/ThemeCustomizer";
import { useShortcuts } from "@/components/ShortcutsOverlay";
import { useCoachmarkTour } from "@/components/CoachmarkTour";
import {
  Building2, ArrowRight, Pin, Clock, Trash2, Zap, type LucideIcon,
} from "lucide-react";

interface Ctx { open: () => void; close: () => void; }
const C = createContext<Ctx | null>(null);

interface Entry {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  onSelect: () => void;
  haystack: string;
  group: "actions" | "navigation" | "workspaces" | "documents" | "audit";
  isAction?: boolean;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <Inner isOpen={isOpen} setIsOpen={setIsOpen} navigate={navigate}>{children}</Inner>;
}

function Inner({
  isOpen, setIsOpen, navigate, children,
}: {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { recent, pinned, pushRecent, togglePin, clearRecent } = usePaletteMemory();
  const { theme, setTheme, portal, setPortal } = useCustomizer();
  const workspacesQuery = useWorkspaces();
  const { open: openShortcuts } = useShortcuts();
  const { start: startTour } = useCoachmarkTour();

  useEffect(() => { if (!isOpen) setQuery(""); }, [isOpen]);

  const go = useCallback((to: string, id: string) => {
    pushRecent(id);
    setIsOpen(false);
    navigate(to);
  }, [navigate, pushRecent, setIsOpen]);

  const runAction = useCallback((id: string, fn: () => void) => {
    pushRecent(id);
    setIsOpen(false);
    // Defer so the dialog closes before the side effect (avoids focus fights).
    setTimeout(fn, 0);
  }, [pushRecent, setIsOpen]);

  const handleTogglePin = useCallback((id: string) => {
    const result = togglePin(id);
    if (result === "limit") {
      toast.warning(t("commandPalette.pinLimitTitle"), {
        description: t("commandPalette.pinLimitDesc", { count: PINNED_LIMIT }),
      });
    }
  }, [togglePin, t]);

  const handleClearRecent = useCallback(() => {
    clearRecent();
    toast.success(t("commandPalette.recentCleared"));
  }, [clearRecent, t]);

  const entries = useMemo<Entry[]>(() => {
    const actionEntries: Entry[] = ACTIONS.map((a) => {
      const icon = a.effect.kind === "toggleTheme" ? getToggleThemeIcon(theme) : a.icon;
      const label = t(a.labelKey);
      const hint = a.hintKey ? t(a.hintKey) : undefined;
      const exec = () => {
        switch (a.effect.kind) {
          case "navigate": navigate(a.effect.to); break;
          case "toggleTheme": setTheme(theme === "dark" ? "light" : "dark"); break;
          case "cyclePortal": {
            const idx = PORTAL_CYCLE.indexOf(portal);
            setPortal(PORTAL_CYCLE[(idx + 1) % PORTAL_CYCLE.length]);
            break;
          }
          case "openShortcuts": openShortcuts(); break;
          case "replayTour": startTour(); break;
        }
      };
      return {
        id: a.id,
        label, hint, icon,
        onSelect: () => runAction(a.id, exec),
        haystack: `${label} ${hint ?? ""}`,
        group: "actions",
        isAction: true,
      };
    });

    const navItems = [...NAV.workspace, ...NAV.admin, ...NAV.ops, ...GENERAL_NAV];
    const seen = new Set<string>();
    const navEntries: Entry[] = navItems
      .filter((n) => (seen.has(n.to) ? false : (seen.add(n.to), true)))
      .map((n) => {
        const id = `nav:${n.to}`;
        return {
          id, label: t(n.labelKey), hint: n.to, icon: n.icon,
          onSelect: () => go(n.to, id),
          haystack: `${t(n.labelKey)} ${n.to}`, group: "navigation",
        };
      });

    const workspaceEntries: Entry[] = (workspacesQuery.data ?? []).map((w) => {
      const id = `ws:${w.id}`;
      const archetype = w.archetype ?? w.type ?? "workspace";
      return {
        id,
        label: w.name,
        hint: `${archetype} · ${w.document_count} docs`,
        icon: Building2,
        onSelect: () => go("/my-workspace", id),
        haystack: `${w.name} ${archetype} ${w.data_classification}`,
        group: "workspaces",
      };
    });

    return [...actionEntries, ...navEntries, ...workspaceEntries];
  }, [t, go, runAction, navigate, theme, setTheme, portal, setPortal, openShortcuts, startTour, workspacesQuery.data]);

  const entryById = useMemo(() => {
    const map = new Map<string, Entry>();
    entries.forEach((e) => map.set(e.id, e));
    return map;
  }, [entries]);

  const ranked = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const pinnedEntries = pinned.map((id) => entryById.get(id)).filter((e): e is Entry => !!e);
      const recentEntries = recent
        .filter((id) => !pinned.includes(id))
        .map((id) => entryById.get(id))
        .filter((e): e is Entry => !!e);
      return {
        mode: "empty" as const,
        pinned: pinnedEntries,
        recent: recentEntries,
        actions: entries.filter((e) => e.group === "actions"),
        navigation: entries.filter((e) => e.group === "navigation").slice(0, 8),
        workspaces: entries.filter((e) => e.group === "workspaces"),
        documents: [] as Entry[],
        audit: [] as Entry[],
        empty: false,
      };
    }
    const scored = entries
      .map((e) => ({ e, s: fuzzyScore(q, e.haystack) }))
      .filter((x): x is { e: Entry; s: number } => x.s !== null)
      .map((x) => ({ ...x, s: x.s + (pinned.includes(x.e.id) ? 25 : 0) }))
      .sort((a, b) => b.s - a.s);
    const byGroup = (g: Entry["group"], n: number) =>
      scored.filter((x) => x.e.group === g).slice(0, n).map((x) => x.e);
    const actions = byGroup("actions", 5);
    const navigation = byGroup("navigation", 6);
    const workspaces = byGroup("workspaces", 5);
    const documents = byGroup("documents", 8);
    const audit = byGroup("audit", 5);
    return {
      mode: "query" as const,
      pinned: [] as Entry[],
      recent: [] as Entry[],
      actions, navigation, workspaces, documents, audit,
      empty: !actions.length && !navigation.length && !workspaces.length && !documents.length && !audit.length,
    };
  }, [entries, entryById, query, pinned, recent]);

  const renderItem = (e: Entry) => {
    const isPinned = pinned.includes(e.id);
    return (
      <CommandItem
        key={e.id}
        value={`${e.id} ${e.haystack}`}
        onSelect={e.onSelect}
        className="group/item"
      >
        <e.icon className={`mr-2 h-4 w-4 shrink-0 ${e.isAction ? "text-product" : "text-muted-foreground"}`} />
        <HighlightedLabel text={e.label} query={query} className="truncate" />
        {e.hint && query.trim() && (
          <span className="sr-only"> — {e.hint}</span>
        )}
        {e.hint && (
          <span className="ml-auto pl-3 text-xs text-muted-foreground truncate max-w-[40%]">
            {e.hint}
          </span>
        )}
        {!e.isAction && (
          <button
            type="button"
            aria-label={isPinned ? t("commandPalette.unpin") : t("commandPalette.pin")}
            aria-pressed={isPinned}
            onClick={(ev: MouseEvent<HTMLButtonElement>) => {
              ev.preventDefault();
              ev.stopPropagation();
              handleTogglePin(e.id);
            }}
            onPointerDown={(ev) => ev.stopPropagation()}
            className={`ml-2 grid h-6 w-6 shrink-0 place-items-center rounded transition-colors ${
              isPinned
                ? "text-product opacity-100"
                : "text-muted-foreground opacity-0 group-hover/item:opacity-100 group-data-[selected=true]:opacity-100 hover:bg-accent"
            }`}
          >
            <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-current" : ""}`} />
          </button>
        )}
        {e.isAction ? (
          <span
            aria-hidden
            className="ml-2 inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground opacity-60 group-data-[selected=true]:opacity-100"
          >
            <Zap className="h-2.5 w-2.5" /> Run
          </span>
        ) : (
          <ArrowRight className="ml-1 h-3 w-3 shrink-0 opacity-0 group-data-[selected=true]:opacity-60" />
        )}
      </CommandItem>
    );
  };

  return (
    <C.Provider value={{ open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
      <CommandDialog open={isOpen} onOpenChange={setIsOpen} shouldFilter={false}>
        <CommandInput
          placeholder={t("commandPalette.placeholder")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {ranked.empty && <CommandEmpty>{t("commandPalette.noResults")}</CommandEmpty>}

          {ranked.mode === "empty" && ranked.pinned.length > 0 && (
            <CommandGroup heading={
              <span className="inline-flex items-center gap-1.5">
                <Pin className="h-3 w-3" /> {t("commandPalette.pinned")}
              </span> as unknown as string
            }>
              {ranked.pinned.map(renderItem)}
            </CommandGroup>
          )}

          {ranked.mode === "empty" && ranked.recent.length > 0 && (
            <>
              {ranked.pinned.length > 0 && <CommandSeparator />}
              <CommandGroup heading={
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> {t("commandPalette.recent")}
                  </span>
                  <button
                    type="button"
                    onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); handleClearRecent(); }}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t("commandPalette.clearRecent")}
                  </button>
                </div> as unknown as string
              }>
                {ranked.recent.map(renderItem)}
              </CommandGroup>
            </>
          )}

          {ranked.mode === "empty" && (ranked.pinned.length > 0 || ranked.recent.length > 0) && (
            <CommandSeparator />
          )}

          {ranked.actions.length > 0 && (
            <CommandGroup heading={
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3 w-3" /> {t("commandPalette.actions")}
              </span> as unknown as string
            }>
              {ranked.actions.map(renderItem)}
            </CommandGroup>
          )}

          {ranked.navigation.length > 0 && (
            <>
              {ranked.actions.length > 0 && <CommandSeparator />}
              <CommandGroup heading={t("commandPalette.navigation")}>
                {ranked.navigation.map(renderItem)}
              </CommandGroup>
            </>
          )}

          {ranked.workspaces.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("commandPalette.workspaces")}>
                {ranked.workspaces.map(renderItem)}
              </CommandGroup>
            </>
          )}

          {ranked.documents.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("commandPalette.documents")}>
                {ranked.documents.map(renderItem)}
              </CommandGroup>
            </>
          )}

          {ranked.audit.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("commandPalette.audit")}>
                {ranked.audit.map(renderItem)}
              </CommandGroup>
            </>
          )}

          {ranked.mode === "empty" && ranked.recent.length === 0 && ranked.pinned.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">
              {t("commandPalette.tipPin")}
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </C.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("CommandPaletteProvider missing");
  return ctx;
}
