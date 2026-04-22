import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

interface Ctx {
  start: () => void;
  stop: () => void;
}
const C = createContext<Ctx | null>(null);

const STORAGE_KEY = "aia.tour.seen.v1";

interface Step {
  id: string;
  /** CSS selector to highlight; if not found the step shows centered. */
  selector?: string;
  titleKey: string;
  bodyKey: string;
}

const STEPS: Step[] = [
  {
    id: "portal",
    selector: '[data-tour="portal-switcher"]',
    titleKey: "tour.portal.title",
    bodyKey: "tour.portal.body",
  },
  {
    id: "cmdk",
    selector: '[data-tour="cmdk"]',
    titleKey: "tour.cmdk.title",
    bodyKey: "tour.cmdk.body",
  },
  {
    id: "shortcuts",
    selector: '[data-tour="shortcuts"]',
    titleKey: "tour.shortcuts.title",
    bodyKey: "tour.shortcuts.body",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function CoachmarkTourProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const start = useCallback(() => {
    setStepIdx(0);
    setActive(true);
  }, []);
  const stop = useCallback(() => {
    setActive(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
  }, []);

  // First-visit auto-start (skipped under test runner to keep act() clean).
  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    let seen = "0";
    try { seen = localStorage.getItem(STORAGE_KEY) ?? "0"; } catch { /* ignore */ }
    if (seen === "1") return;
    // Wait a beat for the shell to mount and for targets to exist.
    const timer = window.setTimeout(() => setActive(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const step = STEPS[stepIdx];

  // Track the highlighted element's rect (handles resize/scroll).
  useLayoutEffect(() => {
    if (!active) { setRect(null); return; }
    if (!step?.selector) { setRect(null); return; }
    const update = () => {
      const el = document.querySelector(step.selector!);
      setRect(el ? readRect(el) : null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const id = window.setInterval(update, 250); // catch async mounts
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(id);
    };
  }, [active, step]);

  const next = () => {
    if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
    else stop();
  };
  const prev = () => setStepIdx((i) => Math.max(0, i - 1));

  // Keyboard support
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); stop(); }
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position the popover near the target rect, preferring below.
  const popoverPos = useMemo(() => {
    if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    const PAD = 12;
    const POP_W = 340;
    const POP_H = 180;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const below = rect.top + rect.height + PAD;
    const fitsBelow = below + POP_H < vh;
    const top = fitsBelow ? below : Math.max(PAD, rect.top - POP_H - PAD);
    let left = rect.left + rect.width / 2 - POP_W / 2;
    left = Math.max(PAD, Math.min(vw - POP_W - PAD, left));
    return { top: `${top}px`, left: `${left}px`, transform: "none" };
  }, [rect]);

  const ctx: Ctx = { start, stop };

  return (
    <C.Provider value={ctx}>
      {children}
      {active && createPortal(
        <AnimatePresence>
          <motion.div
            key="tour-overlay"
            className="fixed inset-0 z-[100]"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-labelledby="tour-title"
            aria-describedby="tour-body"
          >
            {/* Backdrop with cutout */}
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={stop} />
            {rect && (
              <motion.div
                key={`hl-${stepIdx}`}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute pointer-events-none rounded-lg ring-2 ring-product"
                style={{
                  top: rect.top - 6,
                  left: rect.left - 6,
                  width: rect.width + 12,
                  height: rect.height + 12,
                  boxShadow: "0 0 0 9999px hsl(var(--background) / 0.55)",
                }}
              />
            )}

            <motion.div
              key={`pop-${stepIdx}`}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute w-[340px] ui-card rounded-lg p-4 shadow-elegant border border-border bg-card"
              style={popoverPos}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-product/15 text-product">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <h2 id="tour-title" className="text-sm font-semibold">
                    {t(step.titleKey)}
                  </h2>
                </div>
                <button
                  onClick={stop}
                  aria-label={t("common.close")}
                  className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p id="tour-body" className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {t(step.bodyKey)}
              </p>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5" aria-label={t("tour.progress", { current: stepIdx + 1, total: STEPS.length })}>
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${
                        i === stepIdx ? "bg-product" : "bg-muted-foreground/40"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {stepIdx > 0 && (
                    <Button size="sm" variant="ghost" onClick={prev}>
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" aria-hidden />
                      {t("common.back")}
                    </Button>
                  )}
                  <Button size="sm" onClick={next} className="bg-gradient-accent">
                    {stepIdx < STEPS.length - 1 ? t("common.next") : t("tour.finish")}
                    {stepIdx < STEPS.length - 1 && <ArrowRight className="h-3.5 w-3.5 ml-1" aria-hidden />}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </C.Provider>
  );
}

export function useCoachmarkTour() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("CoachmarkTourProvider missing");
  return ctx;
}
