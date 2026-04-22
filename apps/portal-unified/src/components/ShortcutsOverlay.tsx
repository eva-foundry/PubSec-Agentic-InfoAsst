import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface Ctx { open: () => void; close: () => void; toggle: () => void; }
const C = createContext<Ctx | null>(null);

/** Returns true if the event target is an editable element where shortcuts should be ignored. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

interface Shortcut { keys: string[]; labelKey: string; }
interface Group { titleKey: string; items: Shortcut[]; }

const GROUPS: Group[] = [
  {
    titleKey: "shortcuts.global",
    items: [
      { keys: ["⌘", "K"], labelKey: "shortcuts.commandPalette" },
      { keys: ["?"], labelKey: "shortcuts.openShortcuts" },
      { keys: ["Esc"], labelKey: "shortcuts.closeOverlay" },
    ],
  },
  {
    titleKey: "shortcuts.navigation",
    items: [
      { keys: ["g", "c"], labelKey: "shortcuts.goChat" },
      { keys: ["g", "w"], labelKey: "shortcuts.goWorkspace" },
      { keys: ["g", "l"], labelKey: "shortcuts.goCatalog" },
      { keys: ["g", "o"], labelKey: "shortcuts.goCost" },
      { keys: ["g", "a"], labelKey: "shortcuts.goAiops" },
      { keys: ["g", "p"], labelKey: "shortcuts.goCompliance" },
    ],
  },
  {
    titleKey: "shortcuts.chat",
    items: [
      { keys: ["Enter"], labelKey: "shortcuts.chatSend" },
      { keys: ["Shift", "Enter"], labelKey: "shortcuts.chatNewline" },
    ],
  },
];

const NAV_JUMPS: Record<string, string> = {
  c: "/chat",
  w: "/my-workspace",
  l: "/catalog",
  o: "/cost",
  a: "/aiops",
  p: "/compliance",
};

/**
 * Provider mounts the global keyboard listener and renders the overlay dialog.
 * Children can call `useShortcuts().open()` to open the overlay programmatically
 * (e.g. from a help button in the topbar).
 */
export function ShortcutsOverlayProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const leaderRef = useRef<{ active: boolean; timer: number | null }>({ active: false, timer: null });

  const clearLeader = useCallback(() => {
    if (leaderRef.current.timer !== null) window.clearTimeout(leaderRef.current.timer);
    leaderRef.current = { active: false, timer: null };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Open overlay with "?" (Shift + / on US keyboards). Accept either form.
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((o) => !o);
        clearLeader();
        return;
      }

      // Leader sequence: press "g" then a target key within 1.2s.
      if (leaderRef.current.active) {
        const target = NAV_JUMPS[e.key.toLowerCase()];
        clearLeader();
        if (target) {
          e.preventDefault();
          navigate(target);
        }
        return;
      }

      if (e.key === "g" || e.key === "G") {
        leaderRef.current.active = true;
        leaderRef.current.timer = window.setTimeout(() => {
          leaderRef.current = { active: false, timer: null };
        }, 1200);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearLeader();
    };
  }, [navigate, clearLeader]);

  const ctx: Ctx = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen((o) => !o),
  };

  return (
    <C.Provider value={ctx}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-product" aria-hidden />
              {t("shortcuts.title")}
            </DialogTitle>
            <DialogDescription>{t("shortcuts.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {GROUPS.map((g) => (
              <section key={g.titleKey}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(g.titleKey)}
                </h3>
                <ul className="space-y-1.5">
                  {g.items.map((s) => (
                    <li
                      key={s.labelKey}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50"
                    >
                      <span className="text-sm">{t(s.labelKey)}</span>
                      <span className="flex items-center gap-1">
                        {s.keys.map((k, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && (
                              <span className="text-xs text-muted-foreground" aria-hidden>then</span>
                            )}
                            <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
                              {k}
                            </kbd>
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </C.Provider>
  );
}

export function useShortcuts() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("ShortcutsOverlayProvider missing");
  return ctx;
}
