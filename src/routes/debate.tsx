import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { AgentBadge } from "@/components/atlantix/AgentBadge";
import { AgentThread, type ThreadMessage } from "@/components/atlantix/AgentThread";
import { ScoreBar } from "@/components/atlantix/ScoreBar";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, AGENT_LABELS } from "@/lib/atlantix";
import { useModeGuard } from "@/components/atlantix/TerminalMode";
import { useShariahMode } from "@/hooks/useShariahMode";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ShieldAlert, History, Radio } from "lucide-react";

type Search = { id?: string };

export const Route = createFileRoute("/debate")({
  component: DebateRoom,
  validateSearch: (s: Record<string, unknown>): Search => ({ id: typeof s.id === "string" ? s.id : undefined }),
});

function DebateRoom() {
  const { t } = useTranslation();
  const { id } = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();

  // State — must be declared before any hooks that reference them
  const [running, setRunning] = useState(false);
  const [debates, setDebates] = useState<Array<{ id: string; agent: string; stance: string | null; argument: string; confidence: number | null; created_at: string }>>([]);
  const [transcriptTab, setTranscriptTab] = useState<"live" | "history">("live");
  const threadEndRef = useRef<HTMLDivElement>(null);

  const { data: ideas } = useQuery({
    queryKey: ["ideas-list-for-debate"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ideas")
        .select("id,title,side,status,assets(ticker)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!id && ideas && ideas.length > 0) {
      nav({ to: "/debate", search: { id: ideas[0].id }, replace: true });
    }
  }, [id, ideas, nav]);

  const { data: idea } = useQuery({
    queryKey: ["idea", id],
    enabled: !!id,
    refetchInterval: running ? 3000 : 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("ideas")
        .select("*,assets(ticker,name,asset_class)")
        .eq("id", id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: memo } = useQuery({
    queryKey: ["memo", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("investment_memos")
        .select("*")
        .eq("idea_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Ordered list of agent kinds matching run-committee sequence
  const AGENT_SEQUENCE = ["cio","fundamental","bear","fundamental","bear","macro","quant","news","options","flow","operations","risk","cio"] as const;

  // Which agent is currently "typing" — next in sequence after last received
  const typingAgent = running
    ? (() => {
        if (debates.length === 0) return "cio";
        const lastIdx = AGENT_SEQUENCE.indexOf(
          debates[debates.length - 1].agent as typeof AGENT_SEQUENCE[number]
        );
        const nextIdx = Math.min(lastIdx + 1, AGENT_SEQUENCE.length - 1);
        return AGENT_SEQUENCE[nextIdx] ?? "cio";
      })()
    : null;

  // Poll debates from DB while committee is running (backup for realtime)
  useEffect(() => {
    if (!running || !id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("agent_debates")
        .select("id,agent,stance,argument,confidence,created_at")
        .eq("idea_id", id)
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setDebates(data);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [running, id]);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debates.length]);

  useEffect(() => {
    if (!id) return;
    let active = true;

    // Initial load
    supabase
      .from("agent_debates")
      .select("id,agent,stance,argument,confidence,created_at")
      .eq("idea_id", id)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (active) setDebates(data ?? []); });

    // Realtime: new debate messages
    const debateChannel = supabase
      .channel(`debates-${id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "agent_debates", filter: `idea_id=eq.${id}`,
      }, (payload) => {
        setDebates((prev) => [...prev, payload.new as never]);
      })
      .subscribe();

    // Realtime: risk assessment inserted → refetch risk + idea
    const riskChannel = supabase
      .channel(`risk-${id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "risk_assessments", filter: `idea_id=eq.${id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["risk", id] });
        qc.invalidateQueries({ queryKey: ["idea", id] });
      })
      .subscribe();

    // Realtime: idea status updated
    const ideaChannel = supabase
      .channel(`idea-${id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "ideas", filter: `id=eq.${id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["idea", id] });
        qc.invalidateQueries({ queryKey: ["ideas-list-for-debate"] });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(debateChannel);
      supabase.removeChannel(riskChannel);
      supabase.removeChannel(ideaChannel);
    };
  }, [id, qc]);

  const { data: risk } = useQuery({
    queryKey: ["risk", id],
    enabled: !!id,
    refetchInterval: running ? 3000 : 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("risk_assessments")
        .select("*")
        .eq("idea_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // History: all past committee runs for ALL ideas (for history tab)
  const { data: historyRuns } = useQuery({
    queryKey: ["debate-history"],
    queryFn: async () => {
      // Get distinct idea_ids that have debates, with idea info
      const { data } = await supabase
        .from("agent_debates")
        .select("idea_id, created_at, ideas:idea_id(title, side, status, assets(ticker))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!data) return [];
      // Group by idea_id, keep latest created_at per idea
      const map = new Map<string, { idea_id: string; created_at: string; title: string; side: string; status: string; ticker: string; count: number }>();
      for (const d of data) {
        const key = d.idea_id;
        const idea = d.ideas as any;
        if (!map.has(key)) {
          map.set(key, {
            idea_id: key,
            created_at: d.created_at,
            title: idea?.title ?? "—",
            side: idea?.side ?? "—",
            status: idea?.status ?? "—",
            ticker: idea?.assets?.ticker ?? "—",
            count: 1,
          });
        } else {
          map.get(key)!.count++;
        }
      }
      return Array.from(map.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    refetchInterval: 60_000,
  });

  const { allowed: canApprove, currentMode } = useModeGuard(["risk_review", "committee"]);
  const { isShariahModeEnabled } = useShariahMode();

  async function runCommittee() {
    if (!id) return;
    setRunning(true);
    setDebates([]); // clear old debates before new run
    try {
      const activeLanguage =
        (i18n.resolvedLanguage ?? i18n.language ?? window.localStorage.getItem("atlantix:lang") ?? "en")
          .toLowerCase()
          .startsWith("tr")
          ? "tr"
          : "en";
      // Get current user id so edge function can set owner_id on inserts
      const { data: { user } } = await supabase.auth.getUser();
      const owner_id = user?.id ?? undefined;

      await supabase.from("ideas").update({ status: "debating" }).eq("id", id);
      const { error } = await supabase.functions.invoke("run-committee", {
        body: { idea_id: id, lang: activeLanguage, isShariahModeEnabled, owner_id },
      });
      if (error) throw error;
      toast.success(t("debate.committeeToast"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("debate.committeeFailed"));
    } finally {
      setRunning(false);
      // Force reload debates after committee finishes — in case realtime missed any
      if (id) {
        const { data } = await supabase
          .from("agent_debates")
          .select("id,agent,stance,argument,confidence,created_at")
          .eq("idea_id", id)
          .order("created_at", { ascending: true });
        if (data && data.length > 0) setDebates(data);
      }
      qc.invalidateQueries({ queryKey: ["idea", id] });
      qc.invalidateQueries({ queryKey: ["risk", id] });
    }
  }

  async function approveIdea() {
    if (!id) return;
    if (!canApprove) {
      toast.error(t("debate.approveBlocked", { mode: currentMode }));
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("ideas").update({ status: "approved" }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: u.user?.id ?? null, action: "idea_approved", target_type: "idea", target_id: id,
    });

    // Create an order in the orders table so it appears in Emir Yürütme
    if (idea?.asset_id) {
      const { error: orderError } = await supabase.from("orders").insert({
        idea_id: id,
        asset_id: idea.asset_id,
        side: idea.side,
        order_type: "market",
        quantity: 1,
        limit_price: null,
        status: "pending_approval",
        approved_by: u.user?.id ?? null,
      });
      if (orderError) toast.error(`Order creation failed: ${orderError.message}`);
    }

    toast.success(t("debate.ideaApproved"));
    // Navigate to next pending idea, or to execution
    const next = ideas?.find((i) => i.id !== id && !["approved","rejected"].includes(i.status as string));
    if (next) nav({ to: "/debate", search: { id: next.id } });
    else nav({ to: "/execution" });
  }

  async function rejectIdea() {
    if (!id) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("ideas").update({ status: "rejected" }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: u.user?.id ?? null, action: "idea_rejected", target_type: "idea", target_id: id,
    });
    toast.success(t("debate.ideaRejected"));
    // Navigate to next pending idea
    const next = ideas?.find((i) => i.id !== id && !["approved","rejected"].includes(i.status as string));
    if (next) nav({ to: "/debate", search: { id: next.id } });
  }

  return (
    <AppShell>
      <PageHeader
        title={t("debate.title")}
        subtitle={idea ? `${(idea.assets as { ticker?: string } | null)?.ticker} — ${idea.title}` : t("debate.selectIdeaSubtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={runCommittee} disabled={running || !id}>
              {running ? t("debate.dispatching") : t("debate.rerun")}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-[1fr_300px] gap-0">
        <section className="min-w-0 space-y-4 px-5 py-4">

          {/* Ideas horizontal strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("debate.ideas")}
            </span>
            <div className="flex gap-1.5">
              {ideas?.map((i) => {
                const ticker = (i.assets as { ticker?: string } | null)?.ticker;
                const active = i.id === id;
                return (
                  <button
                    key={i.id}
                    onClick={() => nav({ to: "/debate", search: { id: i.id } })}
                    className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                      active
                        ? "border-atlantix/50 bg-surface-3"
                        : "border-border hover:bg-surface-2"
                    }`}
                  >
                    <span className="ticker rounded bg-surface px-1 py-0.5 text-[10px]">{ticker}</span>
                    <span className={`font-mono text-[9px] uppercase ${i.side === "long" ? "text-bull" : "text-bear"}`}>
                      {i.side}
                    </span>
                    <span className="max-w-[120px] truncate text-[11px] text-muted-foreground">
                      {(i as any).title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conflict Matrix */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-widest text-atlantix">{t("debate.conflictMatrix")}</div>
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-bull" /> {t("debate.for")}</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-bear" /> {t("debate.against")}</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> {t("debate.caution")}</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> {t("debate.neutral")}</span>
              </div>
            </div>
            <ConflictMatrix debates={debates} />
          </div>

          {/* Transcript panel */}
          <div className="panel p-4">
            {/* Tab bar */}
            <div className="mb-3 flex items-center gap-1 border-b pb-2.5">
              <button
                onClick={() => setTranscriptTab("live")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${transcriptTab === "live" ? "bg-surface-3 text-atlantix" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Radio className="h-3 w-3" /> Live
                {debates.length > 0 && (
                  <span className="ml-1 rounded-full bg-atlantix/20 px-1.5 py-0.5 text-[9px] text-atlantix">{debates.length}</span>
                )}
              </button>
              <button
                onClick={() => setTranscriptTab("history")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${transcriptTab === "history" ? "bg-surface-3 text-atlantix" : "text-muted-foreground hover:text-foreground"}`}
              >
                <History className="h-3 w-3" /> History
                {(historyRuns ?? []).length > 0 && (
                  <span className="ml-1 rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] text-muted-foreground">{(historyRuns ?? []).length}</span>
                )}
              </button>
            </div>

            {transcriptTab === "live" ? (
              <>
                {debates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-surface-2/40 px-4 py-10 text-center">
                    <Radio className="h-5 w-5 text-muted-foreground" />
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {t("debate.noDebatesYet") || "No committee run yet for this idea"}
                    </div>
                    <Button size="sm" onClick={runCommittee} disabled={running || !id}>
                      {running ? t("debate.dispatching") : (t("debate.runFirstCommittee") || "Run committee now")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <AgentThread
                      messages={(() => {
                        const seen = new Map<string, number>();
                        return debates.map((d) => {
                          const n = (seen.get(d.agent) ?? 0) + 1;
                          seen.set(d.agent, n);
                          const isRebuttal = n > 1;
                          const kind: ThreadMessage["kind"] =
                            d.agent === "cio" ? (isRebuttal ? "memo" : "open") :
                            d.agent === "fundamental" ? (isRebuttal ? "attack" : "thesis") :
                            d.agent === "bear" ? "attack" :
                            d.agent === "quant" ? "stat" :
                            d.agent === "risk" ? "verdict" : "msg";
                          return { id: d.id, agent: d.agent, stance: d.stance, argument: d.argument, confidence: d.confidence, created_at: d.created_at, kind } as ThreadMessage;
                        });
                      })()}
                      typing={typingAgent}
                    />
                    <div ref={threadEndRef} />
                  </>
                )}
              </>
            ) : (
              <div className="space-y-1">
                {(historyRuns ?? []).length === 0 ? (
                  <div className="py-8 text-center font-mono text-xs text-muted-foreground">No committee runs yet</div>
                ) : (
                  (historyRuns ?? []).map((run) => (
                    <button
                      key={run.idea_id}
                      onClick={() => { nav({ to: "/debate", search: { id: run.idea_id } }); setTranscriptTab("live"); }}
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-surface-3 ${run.idea_id === id ? "border-atlantix/40 bg-surface-3" : "border-border bg-surface-2"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="ticker rounded bg-surface px-1.5 py-0.5 text-[10px]">{run.ticker}</span>
                        <span className={`font-mono text-[10px] uppercase ${run.side === "long" ? "text-bull" : "text-bear"}`}>{run.side}</span>
                        <span className="flex-1 truncate text-xs">{run.title}</span>
                        <span className="shrink-0 font-mono text-[9px] text-muted-foreground">{run.count} msgs</span>
                        <span className="shrink-0 font-mono text-[9px] text-muted-foreground">{new Date(run.created_at).toLocaleDateString()}</span>
                        <span className={`shrink-0 font-mono text-[9px] uppercase ${run.status === "approved" ? "text-bull" : run.status === "rejected" ? "text-bear" : "text-muted-foreground"}`}>
                          {STATUS_LABEL[run.status] ?? run.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
            
            {/* AI Execution Transparency Footer */}
            <div className="mt-4 border-t pt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              <span>Execution Engine: Gemini 2.5 Flash / Pro</span>
              <span>Powered by GEMINI_API_KEY (direct)</span>
            </div>
          </div>
        </section>

        <aside className="border-l p-6">
          {idea && (
            <>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("debate.status")}</div>
              <div className="mt-1 font-display text-lg font-semibold">{STATUS_LABEL[idea.status as string] ?? idea.status}</div>

              <div className="mt-6 space-y-3">
                <ScoreBar value={idea.edge_score} label={t("debate.edge")} tone="edge" />
                <ScoreBar value={idea.risk_score} label={t("debate.risk")} tone="risk" />
                <ScoreBar value={idea.consensus_score} label={t("debate.consensus")} tone="atlantix" />
                <ScoreBar value={idea.timing_score} label={t("debate.timing")} tone="atlantix" />
                <ScoreBar value={idea.liquidity_score} label={t("debate.liquidity")} tone="atlantix" />
                {idea.asymmetry && (
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("debate.rrAsymmetry")}</span>
                    <span className="font-mono text-sm font-semibold text-atlantix">{idea.asymmetry}R</span>
                  </div>
                )}
              </div>

              {risk && (
                <div className="mt-6 rounded-md border bg-surface-2 p-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-atlantix" strokeWidth={1.5} />
                    <span className="font-mono text-[10px] uppercase tracking-widest">{t("debate.riskVerdict")}</span>
                  </div>
                  <div className="mt-1 font-mono text-sm uppercase tracking-wider text-atlantix">{risk.verdict}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{risk.rationale}</div>
                  {risk.max_position_pct && (
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-widest">
                      {t("debate.maxSize")} <span className="text-atlantix">{risk.max_position_pct}% NAV</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── What to do ── */}
              <ActionAdvice
                verdict={risk?.verdict ?? null}
                status={idea.status as string}
                maxPct={risk?.max_position_pct ?? null}
              />

              {memo && (
                <div className="mt-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("debate.investmentMemo")}</div>
                  <div className="mt-2 space-y-2 rounded-md border bg-surface-2 p-3 text-xs">
                    {Object.entries(memo.content as Record<string, string>).map(([k, v]) => (
                      <div key={k}>
                        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k.replace(/_/g, " ")}</div>
                        <div className="text-foreground">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {["approved", "rejected"].includes(idea.status as string) ? (
                <div className={`mt-6 rounded-md border p-3 text-center font-mono text-sm font-semibold uppercase tracking-widest ${
                  idea.status === "approved"
                    ? "border-bull/40 bg-bull/10 text-bull"
                    : "border-bear/40 bg-bear/10 text-bear"
                }`}>
                  {idea.status === "approved" ? "✓ Approved" : "✕ Rejected"}
                </div>
              ) : (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    <Button onClick={approveIdea} className="bg-bull text-primary-foreground hover:opacity-90">
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> {t("debate.approve")}
                    </Button>
                    <Button onClick={rejectIdea} variant="destructive">
                      <XCircle className="mr-1.5 h-4 w-4" /> {t("debate.reject")}
                    </Button>
                  </div>
                  {idea.status !== "awaiting_approval" && (
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-warning">
                      {t("debate.overrideMode")}
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 border-t pt-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("debate.committeeRoster")}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.keys(AGENT_LABELS).slice(0, 10).map((a) => <AgentBadge key={a} agent={a} size="sm" />)}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

// ---------- Action Advice ----------

function ActionAdvice({
  verdict,
  status,
  maxPct,
}: {
  verdict: string | null;
  status: string;
  maxPct: number | null;
}) {
  const { t } = useTranslation();

  const COLORS: Record<string, { color: string; bg: string; border: string }> = {
    approve:      { color: "oklch(0.70 0.18 145)", bg: "oklch(0.70 0.18 145 / 0.08)", border: "oklch(0.70 0.18 145 / 0.35)" },
    reduce_size:  { color: "oklch(0.78 0.15 75)",  bg: "oklch(0.78 0.15 75 / 0.08)",  border: "oklch(0.78 0.15 75 / 0.35)"  },
    wait:         { color: "oklch(0.65 0.18 280)", bg: "oklch(0.65 0.18 280 / 0.08)", border: "oklch(0.65 0.18 280 / 0.35)" },
    reject:       { color: "oklch(0.62 0.20 25)",  bg: "oklch(0.62 0.20 25 / 0.08)",  border: "oklch(0.62 0.20 25 / 0.35)"  },
    kill_switch:  { color: "oklch(0.62 0.20 25)",  bg: "oklch(0.62 0.20 25 / 0.10)",  border: "oklch(0.62 0.20 25 / 0.50)"  },
    no_verdict:   { color: "oklch(0.65 0.18 280)", bg: "oklch(0.65 0.18 280 / 0.06)", border: "oklch(0.65 0.18 280 / 0.25)" },
  };

  const key = verdict ?? "no_verdict";
  const c = COLORS[key] ?? COLORS.no_verdict;
  const adviceKey = `debate.actionAdvice.${key}` as const;
  const title = t(`${adviceKey}.title`);
  const steps = t(`${adviceKey}.steps`, { returnObjects: true }) as string[];

  return (
    <div
      className="mt-4 rounded-md border p-3"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    >
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: c.color }}>
        {t("debate.actionAdvice.label")}
      </div>
      <div className="mb-2.5 font-display text-sm font-semibold" style={{ color: c.color }}>
        {title}
      </div>
      {maxPct != null && verdict && ["approve", "reduce_size"].includes(verdict) && (
        <div
          className="mb-2.5 rounded px-2 py-1 font-mono text-[11px]"
          style={{ backgroundColor: c.border, color: c.color }}
        >
          {t("debate.actionAdvice.positionSize", { pct: maxPct })}
        </div>
      )}
      <ol className="space-y-1.5">
        {Array.isArray(steps) && steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold"
              style={{ backgroundColor: c.border, color: c.color }}
            >
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- Debate helpers ----------

type Debate = { id: string; agent: string; stance: string | null; argument: string; confidence: number | null; created_at: string };

function stanceTone(stance: string | null): { color: string; bg: string } {
  const s = (stance ?? "").toLowerCase();
  if (s === "for" || s === "approve" || s === "bull") return { color: "hsl(var(--bull))", bg: "hsl(var(--bull) / 0.12)" };
  if (s === "against" || s === "reject" || s === "bear") return { color: "hsl(var(--bear))", bg: "hsl(var(--bear) / 0.12)" };
  if (s === "caution" || s === "warn") return { color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.12)" };
  return { color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted-foreground) / 0.12)" };
}

function stanceLabel(stance: string | null): string {
  if (!stance) return "NEUTRAL";
  const s = stance.toLowerCase();
  if (s === "for" || s === "approve") return "FOR";
  if (s === "against" || s === "reject") return "AGAINST";
  if (s === "caution" || s === "warn") return "CAUTION";
  return stance.toUpperCase();
}

function ConflictMatrix({ debates }: { debates: Debate[] }) {
  // Pick the latest stance per agent.
  const latest = new Map<string, Debate>();
  for (const d of debates) latest.set(d.agent, d);
  const slots = ["macro", "fundamental", "news", "options", "flow", "quant", "bear", "risk", "portfolio"];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {slots.map((agent) => {
        const d = latest.get(agent);
        const tone = stanceTone(d?.stance ?? null);
        return (
          <div
            key={agent}
            className="flex min-h-[140px] flex-col rounded-md border bg-surface-2 p-3"
            style={{ borderTop: `3px solid ${tone.color}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <AgentBadge agent={agent} size="sm" />
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest"
                style={{ backgroundColor: tone.bg, color: tone.color }}
              >
                {d ? stanceLabel(d.stance) : "—"}
              </span>
            </div>
            <div className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
              {d?.argument ?? "Awaiting input…"}
            </div>
            {d?.confidence !== null && d?.confidence !== undefined && (
              <div className="mt-2 border-t pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                conf {d.confidence}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
