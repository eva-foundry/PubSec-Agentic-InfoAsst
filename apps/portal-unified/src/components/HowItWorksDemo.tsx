import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { AGENTIC_STEPS } from "@/lib/site-content";
import { MessageSquare, GitBranch, Cpu, ShieldCheck, Sparkles, Database, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const LAYERS: { icon: LucideIcon; label: string; stepIdx: number }[] = [
  { icon: MessageSquare, label: "UI", stepIdx: -1 },
  { icon: GitBranch, label: "Gateway", stepIdx: 0 },        // Plan
  { icon: Cpu, label: "Orchestrator", stepIdx: 1 },         // Retrieve
  { icon: ShieldCheck, label: "Guardrails", stepIdx: 4 },   // Verify
  { icon: Sparkles, label: "LLM", stepIdx: 2 },             // Reason
  { icon: Database, label: "Knowledge", stepIdx: 3 },       // Cite
];

export function HowItWorksDemo() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setInterval(() => {
      setActiveStep((s) => (s + 1) % (AGENTIC_STEPS.length + 1));
    }, 1100);
    return () => clearInterval(t);
  }, [reduceMotion]);

  // -1 means "respond" / settled state
  const stepIdx = activeStep === AGENTIC_STEPS.length ? -1 : activeStep;
  const currentStep = stepIdx >= 0 ? AGENTIC_STEPS[stepIdx] : null;

  return (
    <div className="ui-card rounded-lg p-6 sm:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
        {/* Architecture nodes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {LAYERS.map((l, i) => {
            const isActive = !reduceMotion && l.stepIdx === stepIdx;
            return (
              <div
                key={l.label}
                className={cn(
                  "relative rounded-lg border p-3 text-center transition-all duration-300",
                  isActive
                    ? "border-product bg-product/10 shadow-elegant scale-[1.03]"
                    : "border-border bg-muted/20"
                )}
              >
                <div className="absolute -top-1.5 left-2 text-[9px] font-mono text-muted-foreground bg-card px-1">0{i + 1}</div>
                <l.icon className={cn("mx-auto h-5 w-5 transition-colors", isActive ? "text-product" : "text-muted-foreground")} />
                <div className="mt-1.5 text-xs font-semibold">{l.label}</div>
              </div>
            );
          })}
        </div>

        {/* Connector */}
        <div className="hidden lg:block w-px h-32 bg-gradient-to-b from-transparent via-border to-transparent" />

        {/* Live agent timeline */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{t("landing.demoLiveLoop")}</div>
          <ol className="space-y-1.5">
            {AGENTIC_STEPS.map((s, i) => {
              const isActive = i === stepIdx;
              const isDone = stepIdx === -1 || i < stepIdx;
              return (
                <li key={s.id} className="flex items-center gap-2.5 text-xs">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      isActive ? "bg-product" : isDone ? "bg-success" : "bg-muted-foreground/40"
                    )}
                    aria-hidden
                  />
                  <span className={cn("font-medium transition-colors", isActive ? "text-product" : isDone ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-muted-foreground truncate"
                    >
                      — {s.desc}
                    </motion.span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-3 text-[11px] text-muted-foreground" aria-live="polite">
            {currentStep ? <>{t("landing.demoCurrently")} <span className="text-product font-medium">{currentStep.label}</span></> : <span className="text-success font-medium">{t("landing.demoReady")}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
