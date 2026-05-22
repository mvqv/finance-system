import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { AGENT_COLOR_VAR, AGENT_LABELS } from "@/lib/atlantix";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ThreadMessage = {
  id: string;
  agent: string;
  stance?: string | null;
  argument: string;
  confidence?: number | null;
  created_at?: string;
  replyTo?: string | null;
  kind?: "open" | "thesis" | "attack" | "stat" | "verdict" | "memo" | "msg";
};

function stanceTone(stance?: string | null) {
  const s = (stance ?? "").toLowerCase();
  if (s === "for" || s === "approve" || s === "bull")
    return { color: "hsl(var(--bull))", bg: "hsl(var(--bull) / 0.12)", labelKey: "for" };
  if (s === "against" || s === "reject" || s === "bear")
    return { color: "hsl(var(--bear))", bg: "hsl(var(--bear) / 0.12)", labelKey: "against" };
  if (s === "caution" || s === "warn")
    return { color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.12)", labelKey: "caution" };
  return { color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted-foreground) / 0.06)", labelKey: "neutral" };
}

const KIND_KEY: Record<string, string> = {
  open: "thread.kind.open",
  thesis: "thread.kind.thesis",
  attack: "thread.kind.attack",
  stat: "thread.kind.stat",
  verdict: "thread.kind.verdict",
  memo: "thread.kind.memo",
  msg: "thread.kind.msg",
};

const KIND_LABEL: Record<string, string> = {
  open: "Open",
  thesis: "Thesis",
  attack: "Attack",
  stat: "Stat",
  verdict: "Verdict",
  memo: "Memo",
  msg: "Msg",
};

function fmtTime(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export function AgentThread({
  messages,
  typing,
  moderator = "cio",
}: {
  messages: ThreadMessage[];
  typing?: string | null;
  moderator?: string;
}) {
  const { t } = useTranslation();
  const [compact, setCompact]           = useState(false);  // Full view by default — show all text
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set());
  const [filterAgent, setFilterAgent]   = useState("all");
  const [filterStance, setFilterStance] = useState("all");
  const agentLabel = (agent: string) => t(`agentChat.agents.${agent}.label`, agent);

  const agents = useMemo(() =>
    Array.from(new Set(messages.map((m) => m.agent))), [messages]);

  // Auto-expand the latest message when a new one arrives in compact mode
  const lastMsgId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (compact && lastMsgId) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(lastMsgId);
        return next;
      });
    }
  }, [lastMsgId, compact]);

  const filtered = useMemo(() => messages.filter((m) => {
    if (filterAgent !== "all" && m.agent !== filterAgent) return false;
    if (filterStance !== "all") {
      const s = (m.stance ?? "neutral").toLowerCase();
      if (filterStance === "for"     && s !== "for")                    return false;
      if (filterStance === "against" && s !== "against")                return false;
      if (filterStance === "neutral" && (s === "for" || s === "against")) return false;
    }
    return true;
  }), [messages, filterAgent, filterStance]);

  function toggle(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allExpanded = filtered.length > 0 && expandedIds.size >= filtered.length;

  return (
    <div className="space-y-2">

      {/* ── Row 1: moderator status ── */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full font-mono text-[8px] font-bold"
          style={{ backgroundColor: AGENT_COLOR_VAR[moderator], color: "hsl(var(--background))" }}
        >
          {agentLabel(moderator).slice(0, 2).toUpperCase()}
        </span>
        <span className="font-mono text-[11px] font-semibold" style={{ color: AGENT_COLOR_VAR[moderator] }}>
          {t("thread.moderating", { name: agentLabel(moderator) })}
        </span>
        {typing && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-bull">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-bull" />
            </span>
            {t("thread.live")}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {filtered.length !== messages.length
            ? t("thread.msgsFiltered", { shown: filtered.length, total: messages.length })
            : t("thread.msgsCount", { count: messages.length })}
        </span>
      </div>

      {/* ── Row 2: filters + view toggle ── */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5">
        {/* Agent dropdown */}
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="rounded border-0 bg-transparent font-mono text-[10px] text-muted-foreground outline-none cursor-pointer hover:text-foreground"
        >
          <option value="all">{t("thread.allAgents")}</option>
          {agents.map(a => (
            <option key={a} value={a}>{agentLabel(a)}</option>
          ))}
        </select>

        <span className="h-3 w-px bg-border" />

        {/* Stance pills */}
        {(["all", "for", "against", "neutral"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStance(s)}
            className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
              filterStance === s
                ? s === "for"     ? "bg-bull/15 text-bull"
                : s === "against" ? "bg-bear/15 text-bear"
                : s === "neutral" ? "bg-surface-3 text-foreground"
                : "bg-surface-3 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? t("thread.all") : t(`debate.${s}`)}
          </button>
        ))}

        <span className="flex-1" />

        {/* Compact / Full */}
        <button
          onClick={() => setCompact(v => !v)}
          className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
            compact ? "bg-atlantix/15 text-atlantix" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {compact ? t("thread.compact") : t("thread.full")}
        </button>

        {compact && filtered.length > 0 && (
          <>
            <span className="h-3 w-px bg-border" />
            <button
              onClick={() => allExpanded
                ? setExpandedIds(new Set())
                : setExpandedIds(new Set(filtered.map(m => m.id)))
              }
              className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              {allExpanded ? t("thread.collapseAll") : t("thread.expandAll")}
            </button>
          </>
        )}
      </div>

      {/* ── Messages ── */}
      {compact ? (
        <div className="overflow-hidden rounded-md border border-border">
          {filtered.map((m, i) => {
            const color    = AGENT_COLOR_VAR[m.agent] ?? "var(--muted-foreground)";
            const tone     = stanceTone(m.stance);
            const kind     = m.kind ?? "msg";
            const initials = agentLabel(m.agent).slice(0, 2).toUpperCase();
            const isExp    = expandedIds.has(m.id);

            return (
              <div key={m.id} className={i > 0 ? "border-t border-border/40" : ""}>
                <button
                  onClick={() => toggle(m.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-3"
                >
                  {/* Avatar */}
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[8px] font-bold"
                    style={{ backgroundColor: color, color: "hsl(var(--background))" }}
                  >
                    {initials}
                  </span>

                  {/* Name — fixed width */}
                  <span className="w-32 shrink-0 truncate font-mono text-[11px] font-semibold" style={{ color }}>
                    {AGENT_LABELS[m.agent] ?? m.agent}
                  </span>

                  {/* Kind badge */}
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest"
                    style={{ backgroundColor: tone.bg, color: tone.color }}
                  >
                    {KIND_LABEL[kind]}
                  </span>

                  {/* Stance */}
                  <span className="w-16 shrink-0 font-mono text-[9px] uppercase" style={{ color: tone.color }}>
                    {tone.label}
                  </span>

                  {/* Preview — fills remaining space */}
                  {!isExp && (
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                      {m.argument.slice(0, 120)}
                    </span>
                  )}

                  {/* Right: conf + time + chevron */}
                  <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[9px] text-muted-foreground">
                    {m.confidence != null && <span>conf {m.confidence}</span>}
                    <span>{fmtTime(m.created_at)}</span>
                    {isExp
                      ? <ChevronUp className="h-3 w-3 opacity-40" />
                      : <ChevronDown className="h-3 w-3 opacity-40" />}
                  </span>
                </button>

                {/* Expanded body */}
                <AnimatePresence initial={false}>
                  {isExp && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <p className="border-t border-border/30 px-3 pb-3 pt-2 text-xs leading-relaxed text-foreground/85 whitespace-pre-line">
                        {m.argument}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {filtered.length === 0 && messages.length > 0 && (
            <div className="px-3 py-6 text-center font-mono text-xs text-muted-foreground">
              No messages match filter
            </div>
          )}

          {/* Typing row */}
          {typing && (
            <div className="flex items-center gap-2 border-t border-border/40 px-3 py-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[8px] font-bold"
                style={{ backgroundColor: AGENT_COLOR_VAR[typing] ?? "var(--muted-foreground)", color: "hsl(var(--background))" }}
              >
                {(AGENT_LABELS[typing] ?? typing).slice(0, 2).toUpperCase()}
              </span>
              <span className="font-mono text-[11px] font-semibold" style={{ color: AGENT_COLOR_VAR[typing] }}>
                {AGENT_LABELS[typing] ?? typing}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">thinking</span>
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Full timeline mode */
        <div className="relative space-y-3 pl-8">
          <div className="absolute left-3 top-0 h-full w-px bg-border" />
          {filtered.map(m => {
            const color    = AGENT_COLOR_VAR[m.agent] ?? "var(--muted-foreground)";
            const tone     = stanceTone(m.stance);
            const kind     = m.kind ?? "msg";
            const initials = (AGENT_LABELS[m.agent] ?? m.agent).slice(0, 2).toUpperCase();
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <span
                  className="absolute -left-8 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 font-mono text-[9px] font-bold"
                  style={{ borderColor: color, backgroundColor: "hsl(var(--background))", color }}
                >
                  {initials}
                </span>
                <div className="rounded-lg border bg-surface-2 p-3" style={{ borderLeft: `3px solid ${color}` }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-semibold" style={{ color }}>
                      {AGENT_LABELS[m.agent] ?? m.agent}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest"
                      style={{ backgroundColor: tone.bg, color: tone.color, border: `1px solid ${tone.color}` }}
                    >
                      {KIND_LABEL[kind]}
                    </span>
                    {m.replyTo && (
                      <span className="font-mono text-[9px] text-muted-foreground">
                        ↳ {AGENT_LABELS[m.replyTo] ?? m.replyTo}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{fmtTime(m.created_at)}</span>
                    {m.confidence != null && (
                      <span className="font-mono text-[10px] text-muted-foreground">conf {m.confidence}</span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{m.argument}</p>
                </div>
              </motion.div>
            );
          })}
          {typing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
              <span
                className="absolute -left-8 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2"
                style={{ borderColor: AGENT_COLOR_VAR[typing] ?? "var(--muted-foreground)", backgroundColor: "hsl(var(--background))" }}
              />
              <div className="flex items-center gap-2 rounded-lg border border-dashed bg-surface-2/60 p-3">
                <span className="font-mono text-sm font-semibold" style={{ color: AGENT_COLOR_VAR[typing] }}>
                  {AGENT_LABELS[typing] ?? typing}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">thinking</span>
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </span>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mock ──────────────────────────────────────────────────────────────────────
export const MOCK_XOM_THREAD: ThreadMessage[] = [
  { id: "m1", agent: "cio", kind: "open", stance: "neutral",
    argument: "Committee, we're convening on XOM LONG. Trigger: Q4 FCF surprise +18% vs consensus, Pioneer integration ahead of schedule, Brent holding above $78. Bull thesis first, then Bear pressure. Risk Manager closes with sizing." },
  { id: "m2", agent: "fundamental", kind: "thesis", stance: "for", confidence: 78,
    argument: "XOM compounding cash at $36B FCF run-rate. Pioneer adds 16% reserves, breakeven ~$35/bbl. Buyback $20B/yr shrinks float ~5%/yr. At 11.4x EPS vs majors at 13x — ~22% upside, downside protected by 3.4% dividend." },
  { id: "m3", agent: "bear", kind: "attack", stance: "against", confidence: 71, replyTo: "fundamental",
    argument: "FCF assumes $78 Brent. Strip says $72 by Q3. Pioneer synergies back-loaded to 2027. 10-K flags $1.1B one-offs. The 22% upside is a $65 oil chart away from -15%." },
  { id: "m4", agent: "macro", kind: "msg", stance: "neutral", confidence: 60,
    argument: "Regime mildly risk-on, USD softening. BUT Chinese demand missed 3 months in a row, OPEC+ compliance fraying. Macro doesn't carry this if oil cracks $70." },
  { id: "m5", agent: "quant", kind: "stat", stance: "neutral", confidence: 67,
    argument: "156 analogs since 2005: median 90d return +6.4%, hit rate 61%, max drawdown -11%. Kelly suggests 3.8% NAV." },
  { id: "m6", agent: "risk", kind: "verdict", stance: "caution", confidence: 72,
    argument: "REDUCE_SIZE → APPROVE. Sizing: 3.2% NAV. Stop: $107.50 (-6.8%). Invalidation: Brent < $70 for 3 sessions." },
  { id: "m7", agent: "cio", kind: "memo", stance: "for", confidence: 70,
    argument: "6 FOR / 1 AGAINST / 2 NEUTRAL. Conviction: MEDIUM-HIGH. Action: LONG XOM 3.2% NAV, stop $107.50, target $135." },
];
