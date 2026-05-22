import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n/config";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AGENT_COLOR_VAR } from "@/lib/atlantix";
import { AgentAvatar } from "@/components/atlantix/AgentAvatar";
import { Send, Trash2, Bot, User, ChevronDown, History, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/agent-chat")({
  component: AgentChatPage,
});

const AGENT_IDS = [
  "cio",
  "macro",
  "fundamental",
  "bear",
  "risk",
  "quant",
  "news",
  "options",
  "flow",
  "portfolio",
  "execution",
  "operations",
  "memory",
] as const;

type AgentId = (typeof AGENT_IDS)[number];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId?: AgentId;
  agentName?: string;
  ts: number;
}

const STORAGE_KEY = "atlantix:agent-chat-history";

function loadHistory(): Record<AgentId, Message[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {} as Record<AgentId, Message[]>;
    const parsed = JSON.parse(raw);
    // Validate structure — must be an object with arrays
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {} as Record<AgentId, Message[]>;
    }
    return parsed as Record<AgentId, Message[]>;
  } catch {
    return {} as Record<AgentId, Message[]>;
  }
}

function saveHistory(history: Record<string, Message[]>) {
  try {
    // Never save an empty object over existing data
    const hasAny = Object.values(history).some((msgs) => (msgs?.length ?? 0) > 0);
    if (!hasAny) {
      // Only clear if explicitly called with empty — don't overwrite on init
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          const existingHasData = Object.values(parsed).some(
            (msgs: any) => (msgs?.length ?? 0) > 0,
          );
          if (existingHasData) return; // Don't overwrite real data with empty
        } catch {
          /* ignore */
        }
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    /* ignore */
  }
}

function useAgentLabel() {
  const { t } = useTranslation();
  return {
    label: (id: AgentId | string) => t(`agentChat.agents.${id}.label`, id.toUpperCase()),
    desc: (id: AgentId | string) => t(`agentChat.agents.${id}.desc`, ""),
  };
}

function AgentSelector({
  selected,
  onSelect,
}: {
  selected: AgentId;
  onSelect: (id: AgentId) => void;
}) {
  const [open, setOpen] = useState(false);
  const { label, desc } = useAgentLabel();
  const color = AGENT_COLOR_VAR[selected] ?? "var(--muted-foreground)";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-3"
      >
        <AgentAvatar agentId={selected} size="sm" active />
        <div className="text-left">
          <div className="font-display text-sm font-semibold" style={{ color }}>
            {label(selected)}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">{desc(selected)}</div>
        </div>
        <ChevronDown
          className={`ml-2 h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
          >
            {AGENT_IDS.map((id) => {
              const c = AGENT_COLOR_VAR[id] ?? "var(--muted-foreground)";
              const active = id === selected;
              return (
                <button
                  key={id}
                  onClick={() => {
                    onSelect(id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-3 ${active ? "bg-surface-3" : ""}`}
                >
                  <AgentAvatar agentId={id} size="xs" active={active} />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold" style={{ color: c }}>
                      {label(id)}
                    </div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {desc(id)}
                    </div>
                  </div>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-atlantix" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const color = msg.agentId
    ? (AGENT_COLOR_VAR[msg.agentId] ?? "var(--muted-foreground)")
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {isUser ? (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: "hsl(var(--surface-3))", color: "hsl(var(--foreground))" }}
        >
          <User className="h-4 w-4" />
        </div>
      ) : (
        <AgentAvatar agentId={msg.agentId ?? "cio"} size="sm" />
      )}

      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isUser && msg.agentName && (
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
            {msg.agentName}
          </span>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "rounded-tr-sm bg-atlantix/15 text-foreground"
              : "rounded-tl-sm bg-surface-2 text-foreground/90"
          }`}
          style={!isUser ? { borderLeft: `2px solid ${color}` } : undefined}
        >
          {msg.content}
        </div>
        <span className="font-mono text-[9px] text-muted-foreground">
          {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

function TypingIndicator({ agentId }: { agentId: AgentId }) {
  const color = AGENT_COLOR_VAR[agentId] ?? "var(--muted-foreground)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex gap-3"
    >
      <AgentAvatar agentId={agentId} size="sm" />
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-surface-2 px-4 py-3"
        style={{ borderLeft: `2px solid ${color}` }}
      >
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </motion.div>
  );
}

export default function AgentChatPage() {
  const { t } = useTranslation();
  const { label, desc } = useAgentLabel();
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("cio");
  const [allHistory, setAllHistory] = useState<Record<string, Message[]>>(loadHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Skip saving on the very first render (initial load from localStorage)
  const isFirstRender = useRef(true);

  const messages = allHistory[selectedAgent] ?? [];

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveHistory(allHistory);
  }, [allHistory]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      ts: Date.now(),
    };

    setAllHistory((prev) => ({
      ...prev,
      [selectedAgent]: [...(prev[selectedAgent] ?? []), userMsg],
    }));
    setInput("");
    setLoading(true);

    try {
      const langSource =
        i18n.resolvedLanguage ??
        i18n.language ??
        (typeof window !== "undefined" ? window.localStorage.getItem("atlantix:lang") : null) ??
        "en";
      const lang = langSource.toLowerCase().startsWith("tr") ? "tr" : "en";

      const history = [...(allHistory[selectedAgent] ?? []), userMsg].slice(-20);
      const apiMessages = history.map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { agent: selectedAgent, messages: apiMessages, lang },
      });

      if (error)
        throw new Error(error.message || t("agentChat.errFailed", "Agent failed to respond"));
      if (data?.fallback && data?.reply) {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: String(data.reply),
          agentId: selectedAgent,
          agentName: data.agentName ?? label(selectedAgent),
          ts: Date.now(),
        };

        setAllHistory((prev) => ({
          ...prev,
          [selectedAgent]: [...(prev[selectedAgent] ?? []), assistantMsg],
        }));
        toast.info(
          t(
            "agentChat.rateLimited",
            "Gemini quota is temporarily full. Try again in about a minute.",
          ),
        );
        return;
      }
      if (data?.error) throw new Error(String(data.error));
      if (!data?.reply) throw new Error(t("agentChat.errEmpty", "Empty response from agent"));

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        agentId: selectedAgent,
        agentName: data.agentName ?? label(selectedAgent),
        ts: Date.now(),
      };

      setAllHistory((prev) => ({
        ...prev,
        [selectedAgent]: [...(prev[selectedAgent] ?? []), assistantMsg],
      }));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("agentChat.errFailed", "Agent failed to respond"),
      );
      setAllHistory((prev) => ({
        ...prev,
        [selectedAgent]: (prev[selectedAgent] ?? []).filter((m) => m.id !== userMsg.id),
      }));
      setInput(text);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, selectedAgent, allHistory, label, t]);

  function clearHistory() {
    setAllHistory((prev) => {
      const next = { ...prev, [selectedAgent]: [] };
      // Explicitly save after clearing — bypass the "don't overwrite" guard
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    toast.success(t("agentChat.cleared", "Chat history cleared"));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const agentColor = AGENT_COLOR_VAR[selectedAgent] ?? "var(--muted-foreground)";

  return (
    <AppShell>
      <PageHeader
        title={t("agentChat.title", "Agent Chat")}
        subtitle={t("agentChat.subtitle", "Direct conversation with any specialist agent")}
      />

      <div className="flex h-[calc(100vh-120px)] gap-3 px-4 pb-4 sm:px-6">
        <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface md:flex">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("agentChat.history", "History")}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {AGENT_IDS.filter((id) => (allHistory[id]?.length ?? 0) > 0).length === 0 && (
              <div className="px-2 py-6 text-center font-mono text-[10px] text-muted-foreground">
                {t("agentChat.noHistory", "No conversations yet")}
              </div>
            )}
            {AGENT_IDS.map((id) => {
              const msgs = allHistory[id] ?? [];
              if (msgs.length === 0) return null;
              const last = msgs[msgs.length - 1];
              const c = AGENT_COLOR_VAR[id] ?? "var(--muted-foreground)";
              const active = id === selectedAgent;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedAgent(id)}
                  className={`mb-1 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-3 ${active ? "bg-surface-3" : ""}`}
                  style={active ? { borderLeft: `2px solid ${c}` } : undefined}
                >
                  <AgentAvatar agentId={id} size="xs" active={active} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] font-semibold" style={{ color: c }}>
                        {label(id)}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {msgs.length}
                      </span>
                    </div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {last.content.slice(0, 60)}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground/70">
                      {new Date(last.ts).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {Object.values(allHistory).some((m) => (m?.length ?? 0) > 0) && (
            <button
              onClick={() => {
                const empty = {};
                setAllHistory(empty);
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
                } catch {
                  /* ignore */
                }
                toast.success(t("agentChat.allCleared", "All history cleared"));
              }}
              className="flex items-center justify-center gap-1.5 border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" />
              {t("agentChat.clearAll", "Clear all history")}
            </button>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 py-3">
            <AgentSelector selected={selectedAgent} onSelect={(id) => setSelectedAgent(id)} />
            <div className="flex items-center gap-2">
              <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
                <MessageSquare className="mr-1 inline h-3 w-3" />
                {messages.length} {t("agentChat.msgs", "msgs")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                disabled={messages.length === 0}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("agentChat.clear", "Clear")}
              </Button>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <AgentAvatar agentId={selectedAgent} size="xl" active />
                  <div>
                    <div
                      className="font-display text-lg font-semibold"
                      style={{ color: agentColor }}
                    >
                      {label(selectedAgent)}
                    </div>
                    <div className="mt-1 max-w-xs font-mono text-xs text-muted-foreground">
                      {desc(selectedAgent)}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {getStarterQuestions(selectedAgent, t).map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setInput(q);
                          textareaRef.current?.focus();
                        }}
                        className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              <AnimatePresence>
                {loading && <TypingIndicator agentId={selectedAgent} />}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border bg-surface-2 px-4 py-3">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t(
                    "agentChat.placeholder",
                    "Ask {{name}}… (Enter to send, Shift+Enter for new line)",
                    { name: label(selectedAgent) },
                  )}
                  rows={2}
                  className="flex-1 resize-none rounded-xl border-border bg-surface text-sm focus-visible:ring-1"
                  style={{ "--tw-ring-color": agentColor } as React.CSSProperties}
                  disabled={loading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl"
                  style={{ backgroundColor: agentColor, color: "hsl(var(--background))" }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Bot className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t(
                    "agentChat.footer",
                    "Powered by Gemini · Each agent stays in its domain · History saved locally",
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function getStarterQuestions(agentId: AgentId, t: (k: string, d: string) => string): string[] {
  return [0, 1, 2, 3]
    .map((i) => t(`agentChat.starters.${agentId}.${i}`, ""))
    .filter((s) => s && s.length > 0);
}
