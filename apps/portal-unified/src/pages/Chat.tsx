import { useEffect, useRef, useState } from "react";
import { CHAT_THREADS, AGENTIC_STEPS, SCRIPTED_QA_BY_WORKSPACE, WORKSPACES, ScriptedQA } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle, ChevronDown, FileText, Send, Sparkles, X, ChevronRight, Plus, CheckCircle2,
  Loader2, Square, ThumbsUp, ThumbsDown, Copy, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Step = typeof AGENTIC_STEPS[number]["id"];
type Feedback = "up" | "down" | null;

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  state?: "thinking" | "stopped" | "done";
  currentStep?: Step;
  showAnswer?: boolean;
  qa?: ScriptedQA;
  feedback?: Feedback;
}

function buildFollowUps(qa: ScriptedQA, workspaceId: string): string[] {
  const topSrc = qa.sources[0]?.title.split("—")[0].trim() ?? "the source";
  const byWs: Record<string, string[]> = {
    hr: ["What about contractors and interns?", "How is intermittent leave requested?", "Show me the benefits summary section."],
    eng: ["What is the rollback procedure if promotion fails?", "How do we handle the us-west-2 gap?", "Show the latest drill report."],
    legal: ["Compare the broad vs. narrow patterns side by side.", "Which agreements lack any cyber-incident clause?", "Draft a hybrid clause we could propose."],
    bi: ["Break the dip down by deal stage.", "What's the FX-neutral ARR figure?", "Show churn cohort by segment."],
    vendor: ["What compensating controls would you require?", "Compare to the 12 Type-2 vendors.", "Draft the conditional approval memo."],
  };
  const generic = [`Cite the exact passage in ${topSrc}.`, "What evidence is missing?", "Translate the answer to French."];
  return [...(byWs[workspaceId] ?? []), ...generic].slice(0, 4);
}

export default function Chat() {
  const { t, i18n } = useTranslation();
  const [threads] = useState(CHAT_THREADS);
  const [activeThread, setActiveThread] = useState(threads[0].id);
  const [workspace, setWorkspace] = useState(WORKSPACES[0].id);
  const [grounded, setGrounded] = useState(true);
  const language = i18n.language.split("-")[0];
  const setLanguage = (lng: string) => i18n.changeLanguage(lng);

  const activeQA = SCRIPTED_QA_BY_WORKSPACE[workspace] ?? SCRIPTED_QA_BY_WORKSPACE.hr;
  const [input, setInput] = useState(activeQA.question);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [activeCitation, setActiveCitation] = useState<ScriptedQA["sources"][number] | null>(null);
  const [stepAnnouncement, setStepAnnouncement] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);

  // When workspace changes and the composer holds an unedited prefill, swap it
  useEffect(() => {
    setInput((prev) => {
      const isPrevPrefill = Object.values(SCRIPTED_QA_BY_WORKSPACE).some((q) => q.question === prev);
      return isPrevPrefill || prev === "" ? activeQA.question : prev;
    });
  }, [workspace, activeQA.question]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? input).trim();
    if (!promptText || isStreaming) return;
    const qa = activeQA;
    // Inherit prior turn's citations as additional context (multi-turn)
    const priorAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.qa);
    const inheritedSources = priorAssistant?.qa?.sources ?? [];
    const mergedQa: ScriptedQA = inheritedSources.length
      ? { ...qa, sources: [...qa.sources, ...inheritedSources.filter((s) => !qa.sources.some((q) => q.id === s.id && q.title === s.title))].slice(0, 5) }
      : qa;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: promptText };
    const asstId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: asstId, role: "assistant", text: "", state: "thinking", currentStep: "plan", qa: mergedQa }]);
    setInput("");
    setIsStreaming(true);
    stopRef.current = false;

    for (let i = 0; i < AGENTIC_STEPS.length; i++) {
      if (stopRef.current) {
        setMessages((m) => m.map((msg) => (msg.id === asstId ? { ...msg, state: "stopped" } : msg)));
        setStepAnnouncement("Stopped by user.");
        setIsStreaming(false);
        return;
      }
      const step = AGENTIC_STEPS[i];
      await new Promise((r) => setTimeout(r, 650));
      setMessages((m) => m.map((msg) => (msg.id === asstId ? { ...msg, currentStep: step.id as Step } : msg)));
      setStepAnnouncement(`Step ${i + 1} of ${AGENTIC_STEPS.length}: ${step.label} — ${step.desc}`);
    }
    await new Promise((r) => setTimeout(r, 400));
    if (stopRef.current) {
      setMessages((m) => m.map((msg) => (msg.id === asstId ? { ...msg, state: "stopped" } : msg)));
      setIsStreaming(false);
      return;
    }
    setMessages((m) => m.map((msg) => (msg.id === asstId ? { ...msg, state: "done", showAnswer: true, text: qa.answer } : msg)));
    setStepAnnouncement("Answer ready.");
    setIsStreaming(false);
  };

  const stop = () => {
    stopRef.current = true;
  };

  const openCitation = (s: ScriptedQA["sources"][number]) => {
    setActiveCitation(s);
    setDocOpen(true);
  };

  const setFeedback = (id: string, fb: Feedback) => {
    setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, feedback: msg.feedback === fb ? null : fb } : msg)));
    if (fb) toast.success(fb === "up" ? t("chat.feedbackUp") : t("chat.feedbackDown"));
  };

  const copyAnswer = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\*\*/g, ""));
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      toast.error(t("chat.copyError"));
    }
  };

  return (
    <div className="-my-6 sm:-my-8 -mx-4 sm:-mx-6 h-[calc(100vh-3.5rem-2px)] flex flex-col">
      {/* Degradation banner */}
      <div role="status" className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs">
        <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
        <span className="font-medium">{t("chat.degradationBanner")}</span>
        <span className="text-muted-foreground">{t("chat.degradationDetail")}</span>
      </div>

      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <Select value={workspace} onValueChange={setWorkspace}>
          <SelectTrigger className="h-8 w-[220px] text-xs" aria-label={t("chat.workspace")}><SelectValue /></SelectTrigger>
          <SelectContent>
            {WORKSPACES.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
          <button
            onClick={() => setGrounded(true)}
            aria-pressed={grounded}
            className={cn("rounded px-2 py-1 font-medium transition-colors", grounded ? "bg-product/15 text-product" : "text-muted-foreground")}
          >{t("chat.groundedOn")}</button>
          <button
            onClick={() => setGrounded(false)}
            aria-pressed={!grounded}
            className={cn("rounded px-2 py-1 font-medium transition-colors", !grounded ? "bg-muted text-foreground" : "text-muted-foreground")}
          >{t("chat.groundedOff")}</button>
        </div>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-8 w-[110px] text-xs" aria-label={t("topbar.selectLanguage")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="fr">Français</SelectItem>
            <SelectItem value="es">Español</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Live regions for screen readers — polite for step ticks, assertive for completion */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {stepAnnouncement && !/answer ready|stopped/i.test(stepAnnouncement) ? stepAnnouncement : ""}
      </div>
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {stepAnnouncement && /answer ready|stopped/i.test(stepAnnouncement) ? stepAnnouncement : ""}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[260px_1fr_auto] min-h-0">
        {/* Threads */}
        <aside className="hidden md:flex flex-col border-r border-border min-h-0">
          <div className="p-3 border-b border-border">
            <Button size="sm" className="w-full bg-gradient-accent" onClick={() => setMessages([])}>
              <Plus className="h-3.5 w-3.5 mr-2" />{t("chat.newConversation")}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
            {threads.map((t2) => (
              <button
                key={t2.id}
                onClick={() => setActiveThread(t2.id)}
                className={cn(
                  "w-full text-left rounded-md p-2 text-xs hover:bg-muted/60 transition-colors",
                  activeThread === t2.id && "bg-muted"
                )}
              >
                <div className="font-medium truncate text-sm">{t2.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t2.workspace} · {t2.updated}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Transcript */}
        <section className="flex flex-col min-h-0">
          <div ref={transcriptRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-8 py-6 space-y-6">
            {messages.length === 0 && (
              <div className="text-center max-w-md mx-auto pt-12">
                <div className="mx-auto h-12 w-12 rounded-full bg-gradient-accent grid place-items-center shadow-elegant">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h2 className="mt-4 text-xl font-bold">{t("chat.emptyTitle")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("chat.emptySubtitle")}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
                  {t("chat.workspace")}: <span className="font-medium text-foreground">{WORKSPACES.find((w) => w.id === workspace)?.name}</span>
                </div>
              </div>
            )}

            {messages.map((m) => (
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg rounded-br-sm bg-accent text-accent-foreground px-4 py-2.5 text-sm">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex">
                  <div className="max-w-[88%] w-full">
                    <AgenticIndicator currentStep={m.currentStep} state={m.state ?? "thinking"} />
                    {m.state === "stopped" && (
                      <div className="mt-3 text-xs text-muted-foreground italic flex items-center gap-1.5">
                        <Square className="h-3 w-3" /> Generation stopped at step "{AGENTIC_STEPS.find((s) => s.id === m.currentStep)?.label}".
                      </div>
                    )}
                    <AnimatePresence>
                      {m.showAnswer && m.qa && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 ui-card rounded-lg p-4"
                        >
                          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground">
                            {m.text.split("**").map((part, i) =>
                              i % 2 === 1 ? <strong key={i} className="text-product">{part}</strong> : <span key={i}>{part}</span>
                            )}
                          </div>

                          {/* Confidence */}
                          <div className="mt-4 flex items-center gap-3">
                            <div className="text-xs font-medium text-muted-foreground">Confidence</div>
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full",
                                  m.qa.confidence >= 0.8 ? "bg-gradient-to-r from-warning via-success to-success" :
                                  m.qa.confidence >= 0.7 ? "bg-gradient-to-r from-warning to-success" :
                                  "bg-gradient-to-r from-danger to-warning"
                                )}
                                style={{ width: `${m.qa.confidence * 100}%` }}
                              />
                            </div>
                            <div
                              className={cn(
                                "text-xs font-mono font-bold",
                                m.qa.confidence >= 0.8 ? "text-success" :
                                m.qa.confidence >= 0.7 ? "text-warning" : "text-danger"
                              )}
                            >{m.qa.confidence.toFixed(2)}</div>
                          </div>

                          {/* Sources */}
                          <div className="mt-4">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sources</div>
                            <div className="flex flex-wrap gap-2">
                              {m.qa.sources.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => openCitation(s)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs hover:bg-muted hover:border-product/40 transition-colors"
                                >
                                  <FileText className="h-3 w-3 text-product" />
                                  <span className="truncate max-w-[200px]">{s.title}</span>
                                  <span className="text-muted-foreground">p.{s.page}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Why this answer */}
                          <Collapsible className="mt-4">
                            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-medium hover:bg-muted">
                              <span>Why this answer?</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 space-y-3 rounded-md border border-border bg-muted/20 p-3 text-xs">
                              <div>
                                <div className="font-semibold text-muted-foreground mb-1">Retrieval path</div>
                                <ol className="list-decimal pl-4 space-y-0.5">
                                  <li>Hybrid search across {m.qa.sources.length} top-ranked passages</li>
                                  <li>Re-rank top 12 → {m.qa.sources.length}</li>
                                  <li>Chain-of-verification on extracted claims</li>
                                </ol>
                              </div>
                              <div>
                                <div className="font-semibold text-muted-foreground mb-1">Negative evidence</div>
                                <p className="text-muted-foreground">{m.qa.negativeEvidence}</p>
                              </div>
                              <div>
                                <div className="font-semibold text-muted-foreground mb-1">Behavioral fingerprint</div>
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge variant="outline" className="font-mono text-[10px]">model: {m.qa.fingerprint.model}</Badge>
                                  <Badge variant="outline" className="font-mono text-[10px]">prompt: {m.qa.fingerprint.promptVersion}</Badge>
                                  <Badge variant="outline" className="font-mono text-[10px]">corpus: {m.qa.fingerprint.corpusSnapshot}</Badge>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Feedback bar */}
                          <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
                            <button
                              onClick={() => setFeedback(m.id, "up")}
                              aria-label="Mark answer helpful"
                              aria-pressed={m.feedback === "up"}
                              className={cn(
                                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                                m.feedback === "up" ? "bg-success/15 text-success" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              Helpful
                            </button>
                            <button
                              onClick={() => setFeedback(m.id, "down")}
                              aria-label="Flag answer for review"
                              aria-pressed={m.feedback === "down"}
                              className={cn(
                                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                                m.feedback === "down" ? "bg-danger/15 text-danger" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                              Flag
                            </button>
                            <button
                              onClick={() => copyAnswer(m.id, m.text)}
                              aria-label="Copy answer"
                              className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              {copiedId === m.id ? <><Check className="h-3.5 w-3.5 text-success" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Follow-up chips */}
                    {m.showAnswer && m.qa && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="mt-3 flex flex-wrap gap-1.5"
                        aria-label="Suggested follow-up questions"
                      >
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground self-center mr-1">
                          Follow up
                        </span>
                        {buildFollowUps(m.qa, workspace).map((q) => (
                          <button
                            key={q}
                            onClick={() => send(q)}
                            disabled={isStreaming}
                            className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs text-foreground hover:border-product/40 hover:bg-product/5 transition-colors disabled:opacity-50"
                          >
                            {q}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3 sm:p-4">
            <div className="ui-card rounded-lg p-2 flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask the agent…"
                className="border-0 bg-transparent focus-visible:ring-0 min-h-[44px] max-h-32 resize-none text-sm"
                aria-label="Message input"
                disabled={isStreaming}
              />
              {isStreaming ? (
                <Button onClick={stop} size="icon" variant="outline" className="shrink-0 border-danger/40 text-danger hover:bg-danger/10 hover:text-danger" aria-label="Stop generation">
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button onClick={() => send()} size="icon" className="bg-gradient-accent shrink-0" aria-label="Send" disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="mt-1.5 px-1 text-[10px] text-muted-foreground">
              {isStreaming
                ? <span className="text-product">Agent is reasoning… press Stop to interrupt.</span>
                : <><kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for newline</>}
            </div>
          </div>
        </section>

        {/* Document viewer */}
        <AnimatePresence>
          {docOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="hidden lg:flex flex-col border-l border-border min-h-0 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border p-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Document viewer</div>
                  <div className="text-sm font-bold truncate">{activeCitation?.title}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDocOpen(false)} aria-label="Close viewer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 text-sm leading-relaxed">
                <div className="text-xs text-muted-foreground mb-2">Page {activeCitation?.page}</div>
                <p className="text-muted-foreground">… eligibility for the program is conditional upon active employment status.</p>
                <p className="mt-3 bg-product/15 border-l-2 border-product px-3 py-2 rounded">
                  {activeCitation?.snippet}
                </p>
                <p className="mt-3 text-muted-foreground">Requests submitted outside the stated window may be considered on a case-by-case basis at the discretion of leadership…</p>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AgenticIndicator({ currentStep, state }: { currentStep?: Step; state: "thinking" | "stopped" | "done" }) {
  const currentIndex = AGENTIC_STEPS.findIndex((s) => s.id === currentStep);
  const done = state === "done";
  const stopped = state === "stopped";
  const progressPct = done
    ? 100
    : stopped
      ? Math.max(0, (currentIndex / (AGENTIC_STEPS.length - 1)) * 100)
      : Math.max(0, ((currentIndex + 0.5) / AGENTIC_STEPS.length) * 100);

  return (
    <div className="ui-card rounded-lg p-3" aria-label="Agentic reasoning progress">
      <div className="flex items-center gap-2 mb-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={done ? "done" : stopped ? "stopped" : "thinking"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="inline-flex"
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : stopped ? (
              <Square className="h-4 w-4 text-muted-foreground fill-current" />
            ) : (
              <Loader2 className="h-4 w-4 text-product animate-spin" />
            )}
          </motion.span>
        </AnimatePresence>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {done ? "Agent complete" : stopped ? "Agent stopped" : "Agent reasoning"}
        </span>
        {!done && !stopped && currentIndex >= 0 && (
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            {currentIndex + 1}/{AGENTIC_STEPS.length}
          </span>
        )}
      </div>

      {/* Progress rail */}
      <div className="relative mb-3 h-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            done ? "bg-success" : stopped ? "bg-muted-foreground/50" : "bg-gradient-accent"
          )}
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      <ol className="flex flex-wrap items-center gap-1.5">
        {AGENTIC_STEPS.map((s, i) => {
          let st: "done" | "active" | "pending" | "stopped" = "pending";
          if (done) st = "done";
          else if (stopped) st = i < currentIndex ? "done" : i === currentIndex ? "stopped" : "pending";
          else st = i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
          return (
            <li key={s.id} className="flex items-center gap-1.5">
              <motion.div
                layout
                initial={false}
                animate={{
                  scale: st === "active" ? 1.04 : 1,
                  opacity: st === "pending" ? 0.65 : 1,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                aria-current={st === "active" ? "step" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border",
                  st === "done" && "border-success/40 bg-success/10 text-success",
                  st === "active" && "border-product/60 bg-product/15 text-product shadow-[0_0_0_3px_hsl(var(--product)/0.18)]",
                  st === "stopped" && "border-muted-foreground/40 bg-muted text-muted-foreground",
                  st === "pending" && "border-border text-muted-foreground"
                )}
              >
                {st === "active" && (
                  <motion.span
                    layoutId="agentic-active-ring"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full ring-2 ring-product/70 pulse-ring"
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                )}
                <span
                  className="step-dot relative"
                  style={{
                    background:
                      st === "done" ? "hsl(var(--success))" :
                      st === "active" ? "hsl(var(--product))" :
                      st === "stopped" ? "hsl(var(--muted-foreground))" :
                      "hsl(var(--border))",
                  }}
                />
                <span className="relative">{s.label}</span>
                <span className="sr-only">
                  {st === "done" ? " (completed)" : st === "active" ? " (in progress)" : st === "stopped" ? " (stopped)" : " (pending)"}
                </span>
              </motion.div>
              {i < AGENTIC_STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
