import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle, Check, CheckCircle2, ChevronDown, ChevronRight, Copy, ExternalLink,
  FileText, Loader2, Plus, Send, Sparkles, Square, ThumbsDown, ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useWorkspaces } from "@/lib/api/hooks/useWorkspaces";
import { useConversation, useConversations, useStreamChat, useSubmitFeedback } from "@/lib/api/hooks/useChat";
import type {
  AgentStep, ChatEvent, Citation, ExplainabilityRecord, ProvenanceRecord,
} from "@/lib/api/types";

type Feedback = "up" | "down" | null;

interface AssistantMessage {
  id: string;
  role: "assistant";
  conversationId: string | null;
  messageId: string | null;
  correlationId: string | null;
  text: string;
  steps: AgentStep[];
  state: "streaming" | "stopped" | "done" | "error";
  citations: Citation[];
  provenance: ProvenanceRecord | null;
  explainability: ExplainabilityRecord | null;
  feedback: Feedback;
  degradation: { notice_en: string; notice_fr: string; service: string } | null;
}

interface UserMessage {
  id: string;
  role: "user";
  text: string;
}

type Message = AssistantMessage | UserMessage;

export default function Chat() {
  const { t, i18n } = useTranslation();
  const language = i18n.language.split("-")[0];
  const setLanguage = (lng: string) => i18n.changeLanguage(lng);

  const workspaces = useWorkspaces();
  const conversations = useConversations();
  const streamChat = useStreamChat();
  const feedbackMut = useSubmitFeedback();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversation = useConversation(conversationId);

  const [workspace, setWorkspace] = useState<string>("");
  const [grounded, setGrounded] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [stepAnnouncement, setStepAnnouncement] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Default workspace from first grant when list loads
  useEffect(() => {
    if (!workspace && workspaces.data && workspaces.data.length > 0) {
      setWorkspace(workspaces.data[0].id);
    }
  }, [workspace, workspaces.data]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // When a past conversation is picked, hydrate the transcript from the
  // persisted message records. Only runs when there's no in-flight stream
  // — a live send owns the transcript until it settles.
  useEffect(() => {
    if (!conversationId || isStreaming) return;
    const records = conversation.data;
    if (!records) return;
    const hydrated: Message[] = records.map((r) => {
      if (r.role === "user") {
        return { id: r.message_id, role: "user", text: r.content_preview };
      }
      const asst: AssistantMessage = {
        id: r.message_id,
        role: "assistant",
        conversationId: r.conversation_id,
        messageId: r.message_id,
        correlationId: null,
        text: r.content_preview,
        steps: [],
        state: "done",
        citations: [],
        provenance: null,
        explainability: null,
        feedback: null,
        degradation: null,
      };
      return asst;
    });
    setMessages(hydrated);
  }, [conversationId, conversation.data, isStreaming]);

  const patchAssistant = (id: string, patch: Partial<AssistantMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.role === "assistant" && m.id === id ? { ...m, ...patch } : m)),
    );
  };

  const applyEvent = (id: string, ev: ChatEvent) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.role !== "assistant" || m.id !== id) return m;
        switch (ev.type) {
          case "provenance":
            return {
              ...m,
              correlationId: ev.correlation_id,
              conversationId: ev.conversation_id,
              messageId: ev.message_id,
            };
          case "agent_step": {
            const existing = m.steps.findIndex((s) => s.id === ev.id);
            const next = [...m.steps];
            const step: AgentStep = {
              id: ev.id,
              tool: ev.tool,
              status: ev.status,
              label_en: ev.label_en,
              label_fr: ev.label_fr,
              duration_ms: ev.duration_ms,
              metadata: ev.metadata,
            };
            if (existing >= 0) next[existing] = step;
            else next.push(step);
            return { ...m, steps: next };
          }
          case "content":
            return { ...m, text: m.text + ev.delta };
          case "citations":
            return { ...m, citations: ev.citations };
          case "degradation": {
            const d = ev.degradation;
            return {
              ...m,
              degradation: {
                service: d.service,
                notice_en:
                  d.notice_en ?? `Service ${d.service} is ${d.status}.`,
                notice_fr:
                  d.notice_fr ?? `Le service ${d.service} est ${d.status}.`,
              },
            };
          }
          case "provenance_complete":
            return {
              ...m,
              provenance: ev.provenance,
              explainability: ev.explainability ?? null,
              state: "done",
            };
          default:
            return m;
        }
      }),
    );
  };

  const send = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? input).trim();
    if (!promptText || isStreaming) return;

    const userMsg: UserMessage = { id: `u-${Date.now()}`, role: "user", text: promptText };
    const asstId = `a-${Date.now()}`;
    const assistant: AssistantMessage = {
      id: asstId,
      role: "assistant",
      conversationId: null,
      messageId: null,
      correlationId: null,
      text: "",
      steps: [],
      state: "streaming",
      citations: [],
      provenance: null,
      explainability: null,
      feedback: null,
      degradation: null,
    };
    setMessages((prev) => [...prev, userMsg, assistant]);
    setInput("");
    setIsStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const stream = streamChat(
        {
          message: promptText,
          workspace_id: workspace || null,
          conversation_id: conversationId,
          mode: grounded ? "grounded" : "ungrounded",
        },
        { signal: abort.signal },
      );
      for await (const ev of stream) {
        applyEvent(asstId, ev);
        if (ev.type === "provenance" && !conversationId) {
          setConversationId(ev.conversation_id);
        }
        if (ev.type === "agent_step") {
          setStepAnnouncement(
            `${ev.status === "complete" ? "Completed" : "Running"}: ${
              language === "fr" ? ev.label_fr : ev.label_en
            }`,
          );
        }
        if (ev.type === "provenance_complete") {
          setStepAnnouncement("Answer ready.");
        }
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.role === "assistant" && m.id === asstId && m.state === "streaming"
            ? { ...m, state: "done" }
            : m,
        ),
      );
    } catch (err) {
      const aborted = (err as { name?: string }).name === "AbortError";
      patchAssistant(asstId, { state: aborted ? "stopped" : "error" });
      if (!aborted) {
        toast.error(t("chat.streamError", { defaultValue: "Stream failed — see banner." }));
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const stop = () => abortRef.current?.abort();

  const newConversation = () => {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
  };

  const openCitation = (c: Citation) => {
    setActiveCitation(c);
    setDocOpen(true);
  };

  const submitFeedback = (msg: AssistantMessage, fb: Feedback) => {
    const next = msg.feedback === fb ? null : fb;
    setMessages((prev) =>
      prev.map((m) => (m.role === "assistant" && m.id === msg.id ? { ...m, feedback: next } : m)),
    );
    if (!next || !msg.conversationId || !msg.messageId) return;
    feedbackMut.mutate(
      {
        conversation_id: msg.conversationId,
        message_id: msg.messageId,
        signal: next === "up" ? "accept" : "reject",
      },
      {
        onSuccess: () =>
          toast.success(next === "up" ? t("chat.feedbackUp") : t("chat.feedbackDown")),
        onError: () => toast.error(t("chat.feedbackError", { defaultValue: "Feedback failed" })),
      },
    );
  };

  const copyAnswer = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      toast.error(t("chat.copyError"));
    }
  };

  const activeDegradation = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.degradation) return m.degradation;
    }
    return null;
  }, [messages]);

  const workspaceName = useMemo(
    () => workspaces.data?.find((w) => w.id === workspace)?.name ?? workspace,
    [workspaces.data, workspace],
  );

  return (
    <div className="-my-6 sm:-my-8 -mx-4 sm:-mx-6 h-[calc(100vh-3.5rem-2px)] flex flex-col">
      {activeDegradation && (
        <div role="status" className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs">
          <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="font-medium">
            {language === "fr" ? activeDegradation.notice_fr : activeDegradation.notice_en}
          </span>
          <span className="text-muted-foreground">service: {activeDegradation.service}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <Select value={workspace} onValueChange={setWorkspace} disabled={workspaces.isLoading}>
          <SelectTrigger className="h-8 w-[220px] text-xs" aria-label={t("chat.workspace")}>
            <SelectValue placeholder={workspaces.isLoading ? "Loading…" : "Select workspace"} />
          </SelectTrigger>
          <SelectContent>
            {(workspaces.data ?? []).map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {language === "fr" && w.name_fr ? w.name_fr : w.name}
              </SelectItem>
            ))}
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
          </SelectContent>
        </Select>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {stepAnnouncement && !/answer ready|stopped/i.test(stepAnnouncement) ? stepAnnouncement : ""}
      </div>
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {stepAnnouncement && /answer ready|stopped/i.test(stepAnnouncement) ? stepAnnouncement : ""}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[260px_1fr_auto] min-h-0">
        <aside className="hidden md:flex flex-col border-r border-border min-h-0">
          <div className="p-3 border-b border-border">
            <Button size="sm" className="w-full bg-gradient-accent" onClick={newConversation}>
              <Plus className="h-3.5 w-3.5 mr-2" />{t("chat.newConversation")}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
            {conversations.isLoading && <div className="text-xs text-muted-foreground p-2">Loading…</div>}
            {(conversations.data ?? []).map((c) => {
              const ts = c.last_message_at ? new Date(c.last_message_at) : null;
              const tsLabel = ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleDateString() : "—";
              return (
                <button
                  key={c.conversation_id}
                  onClick={() => setConversationId(c.conversation_id)}
                  className={cn(
                    "w-full text-left rounded-md p-2 text-xs hover:bg-muted/60 transition-colors",
                    conversationId === c.conversation_id && "bg-muted",
                  )}
                >
                  <div className="font-medium truncate text-sm">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.workspace_id ?? "—"} · {tsLabel}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex flex-col min-h-0">
          <div ref={transcriptRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-8 py-6 space-y-6">
            {messages.length === 0 && (
              <div className="text-center max-w-md mx-auto pt-12">
                <div className="mx-auto h-12 w-12 rounded-full bg-gradient-accent grid place-items-center shadow-elegant">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h2 className="mt-4 text-xl font-bold">{t("chat.emptyTitle")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t("chat.emptySubtitle")}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
                  {t("chat.workspace")}: <span className="font-medium text-foreground">{workspaceName}</span>
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg rounded-br-sm bg-accent text-accent-foreground px-4 py-2.5 text-sm">
                    {m.text}
                  </div>
                </div>
              ) : (
                <AssistantBubble
                  key={m.id}
                  msg={m}
                  language={language}
                  onCitation={openCitation}
                  onFeedback={submitFeedback}
                  onCopy={copyAnswer}
                  copied={copiedId === m.id}
                />
              ),
            )}
          </div>

          <div className="border-t border-border p-3 sm:p-4">
            <div className="ui-card rounded-lg p-2 flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask the agent…"
                className="border-0 bg-transparent focus-visible:ring-0 min-h-[44px] max-h-32 resize-none text-sm"
                aria-label="Message input"
                disabled={isStreaming}
              />
              {isStreaming ? (
                <Button
                  onClick={stop}
                  size="icon"
                  variant="outline"
                  className="shrink-0 border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
                  aria-label="Stop generation"
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button
                  onClick={() => send()}
                  size="icon"
                  className="bg-gradient-accent shrink-0"
                  aria-label="Send"
                  disabled={!input.trim() || !workspace}
                >
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
                  <div className="text-sm font-bold truncate">{activeCitation?.file}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDocOpen(false)} aria-label="Close viewer">
                  <Square className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 text-sm leading-relaxed space-y-3">
                <div className="text-xs text-muted-foreground">
                  {activeCitation?.page ? `Page ${activeCitation.page}` : "—"}
                  {activeCitation?.section ? ` · ${activeCitation.section}` : ""}
                </div>
                {activeCitation?.sas_url && (
                  <a
                    href={activeCitation.sas_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-product hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Open source in new tab
                  </a>
                )}
                {activeCitation?.last_verified && (
                  <div className="text-xs text-muted-foreground">
                    Last verified: {new Date(activeCitation.last_verified).toLocaleDateString()}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AssistantBubble({
  msg,
  language,
  onCitation,
  onFeedback,
  onCopy,
  copied,
}: {
  msg: AssistantMessage;
  language: string;
  onCitation: (c: Citation) => void;
  onFeedback: (msg: AssistantMessage, fb: Feedback) => void;
  onCopy: (id: string, text: string) => void;
  copied: boolean;
}) {
  const { provenance, explainability } = msg;
  const confidence = provenance?.confidence ?? null;
  const showAnswer = msg.text.length > 0 || msg.state === "done" || msg.state === "error";

  return (
    <div className="flex">
      <div className="max-w-[88%] w-full">
        <AgenticIndicator steps={msg.steps} state={msg.state} language={language} />
        {msg.state === "stopped" && (
          <div className="mt-3 text-xs text-muted-foreground italic flex items-center gap-1.5">
            <Square className="h-3 w-3" /> Generation stopped.
          </div>
        )}
        {msg.state === "error" && (
          <div className="mt-3 text-xs text-danger italic flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" /> Stream failed.
          </div>
        )}
        <AnimatePresence>
          {showAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 ui-card rounded-lg p-4"
            >
              <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {msg.text || <span className="text-muted-foreground italic">No content.</span>}
              </div>

              {confidence !== null && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="text-xs font-medium text-muted-foreground">Confidence</div>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full",
                        confidence >= 0.8 ? "bg-gradient-to-r from-warning via-success to-success" :
                          confidence >= 0.7 ? "bg-gradient-to-r from-warning to-success" :
                            "bg-gradient-to-r from-danger to-warning",
                      )}
                      style={{ width: `${confidence * 100}%` }}
                    />
                  </div>
                  <div
                    className={cn(
                      "text-xs font-mono font-bold",
                      confidence >= 0.8 ? "text-success" :
                        confidence >= 0.7 ? "text-warning" : "text-danger",
                    )}
                  >{confidence.toFixed(2)}</div>
                  {provenance?.escalation_tier && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {provenance.escalation_tier.replace(/-/g, " ")}
                    </Badge>
                  )}
                </div>
              )}

              {msg.citations.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Sources ({msg.citations.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {msg.citations.map((c, idx) => (
                      <button
                        key={`${c.file}-${idx}`}
                        onClick={() => onCitation(c)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs hover:bg-muted hover:border-product/40 transition-colors"
                      >
                        <FileText className="h-3 w-3 text-product" />
                        <span className="truncate max-w-[200px]">{c.file}</span>
                        {c.page !== null && <span className="text-muted-foreground">p.{c.page}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(explainability || provenance?.behavioral_fingerprint) && (
                <Collapsible className="mt-4">
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-medium hover:bg-muted">
                    <span>Why this answer?</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-3 rounded-md border border-border bg-muted/20 p-3 text-xs">
                    {explainability?.retrieval_summary && (
                      <div>
                        <div className="font-semibold text-muted-foreground mb-1">Retrieval</div>
                        <p className="text-muted-foreground">{explainability.retrieval_summary}</p>
                      </div>
                    )}
                    {explainability?.reasoning_summary && (
                      <div>
                        <div className="font-semibold text-muted-foreground mb-1">Reasoning</div>
                        <p className="text-muted-foreground">{explainability.reasoning_summary}</p>
                      </div>
                    )}
                    {(explainability?.negative_evidence?.length ?? 0) > 0 && (
                      <div>
                        <div className="font-semibold text-muted-foreground mb-1">Negative evidence</div>
                        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                          {explainability!.negative_evidence.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                    {provenance?.behavioral_fingerprint && (
                      <div>
                        <div className="font-semibold text-muted-foreground mb-1">Behavioral fingerprint</div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            model: {provenance.behavioral_fingerprint.model}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            prompt: {provenance.behavioral_fingerprint.prompt_version}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            corpus: {provenance.behavioral_fingerprint.corpus_snapshot}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            policy: {provenance.behavioral_fingerprint.policy_rules_version}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

              <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
                <button
                  onClick={() => onFeedback(msg, "up")}
                  aria-label="Mark answer helpful"
                  aria-pressed={msg.feedback === "up"}
                  disabled={!msg.messageId}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                    msg.feedback === "up" ? "bg-success/15 text-success" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    "disabled:opacity-40",
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> Helpful
                </button>
                <button
                  onClick={() => onFeedback(msg, "down")}
                  aria-label="Flag answer for review"
                  aria-pressed={msg.feedback === "down"}
                  disabled={!msg.messageId}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                    msg.feedback === "down" ? "bg-danger/15 text-danger" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    "disabled:opacity-40",
                  )}
                >
                  <ThumbsDown className="h-3.5 w-3.5" /> Flag
                </button>
                <button
                  onClick={() => onCopy(msg.id, msg.text)}
                  aria-label="Copy answer"
                  className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {copied
                    ? <><Check className="h-3.5 w-3.5 text-success" />Copied</>
                    : <><Copy className="h-3.5 w-3.5" />Copy</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AgenticIndicator({
  steps,
  state,
  language,
}: {
  steps: AgentStep[];
  state: AssistantMessage["state"];
  language: string;
}) {
  const done = state === "done";
  const stopped = state === "stopped" || state === "error";
  const completeCount = steps.filter((s) => s.status === "complete").length;
  const total = Math.max(steps.length, 1);
  const progressPct = done ? 100 : stopped ? (completeCount / total) * 100 : (completeCount / total) * 95;

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
        {!done && !stopped && steps.length > 0 && (
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            {completeCount}/{steps.length}
          </span>
        )}
      </div>

      <div className="relative mb-3 h-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", done ? "bg-success" : stopped ? "bg-muted-foreground/50" : "bg-gradient-accent")}
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      {steps.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">Waiting for agent…</div>
      ) : (
        <ol className="flex flex-wrap items-center gap-1.5">
          {steps.map((s, i) => {
            const label = language === "fr" ? s.label_fr : s.label_en;
            const st =
              s.status === "complete" ? "done" :
                s.status === "error" ? "stopped" :
                  "active";
            return (
              <li key={`${s.id}-${s.tool}`} className="flex items-center gap-1.5">
                <motion.div
                  layout
                  initial={false}
                  animate={{ scale: st === "active" ? 1.04 : 1, opacity: st === "active" ? 1 : 0.95 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  aria-current={st === "active" ? "step" : undefined}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border",
                    st === "done" && "border-success/40 bg-success/10 text-success",
                    st === "active" && "border-product/60 bg-product/15 text-product",
                    st === "stopped" && "border-muted-foreground/40 bg-muted text-muted-foreground",
                  )}
                >
                  <span className="relative">{label}</span>
                  {s.duration_ms !== null && s.duration_ms !== undefined && (
                    <span className="text-[10px] text-muted-foreground">{s.duration_ms}ms</span>
                  )}
                </motion.div>
                {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
