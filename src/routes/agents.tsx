import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { AgentBadge } from "@/components/atlantix/AgentBadge";
import { AGENT_LABELS } from "@/lib/atlantix";
import { TrendingUp, TrendingDown, Minus, Clock, Brain, Target } from "lucide-react";

export const Route = createFileRoute("/agents")({ component: AgentScorecards });

// ── data ──────────────────────────────────────────────────────────────────────
function useAgentData() {
  // All debate rows with idea outcome
  const debates = useQuery({
    queryKey: ["agent-debates-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_debates")
        .select("id, agent, stance, confidence, latency_ms, model, created_at, idea_id")
        .order("created_at", { ascending: false })
        .limit(2000);
      return data ?? [];
    },
  });

  // Risk assessments to know outcome per idea
  const assessments = useQuery({
    queryKey: ["risk-assessments-agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("risk_assessments")
        .select("idea_id, verdict");
      return data ?? [];
    },
  });

  // Closed ideas with final status
  const ideas = useQuery({
    queryKey: ["ideas-outcomes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ideas")
        .select("id, status, side");
      return data ?? [];
    },
  });

  return { debates, assessments, ideas };
}

// ── compute per-agent stats from raw debate rows ──────────────────────────────
function computeStats(
  debates: Array<{ agent: string; stance: string | null; confidence: number | null; latency_ms: number | null; idea_id: string }>,
  verdictByIdea: Map<string, string>,
  statusByIdea: Map<string, string>,
) {
  // "correct" = agent was FOR and idea got approved/executed, or AGAINST and idea got rejected/kill_switch
  const byAgent = new Map<string, {
    total: number;
    correct: number;
    confidences: number[];
    latencies: number[];
    for: number;
    against: number;
    neutral: number;
    calibration: number[]; // confidence when correct
    overconfident: number[]; // confidence when wrong
  }>();

  for (const d of debates) {
    if (!byAgent.has(d.agent)) {
      byAgent.set(d.agent, { total: 0, correct: 0, confidences: [], latencies: [], for: 0, against: 0, neutral: 0, calibration: [], overconfident: [] });
    }
    const s = byAgent.get(d.agent)!;
    s.total++;

    const stance = (d.stance ?? "neutral").toLowerCase();
    if (stance === "for") s.for++;
    else if (stance === "against") s.against++;
    else s.neutral++;

    if (d.confidence != null) s.confidences.push(d.confidence);
    if (d.latency_ms != null) s.latencies.push(d.latency_ms);

    // Outcome matching
    const verdict = verdictByIdea.get(d.idea_id);
    const ideaStatus = statusByIdea.get(d.idea_id);
    const ideaApproved = verdict === "approve" || verdict === "reduce_size" || ideaStatus === "approved" || ideaStatus === "executed";
    const ideaRejected = verdict === "reject" || verdict === "kill_switch" || ideaStatus === "rejected";

    if (ideaApproved || ideaRejected) {
      const wasCorrect =
        (stance === "for" && ideaApproved) ||
        (stance === "against" && ideaRejected) ||
        (stance === "neutral"); // neutral always "correct" — no directional bet

      if (wasCorrect) {
        s.correct++;
        if (d.confidence != null) s.calibration.push(d.confidence);
      } else {
        if (d.confidence != null) s.overconfident.push(d.confidence);
      }
    }
  }

  return byAgent;
}

function avg(arr: number[]) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ── main ──────────────────────────────────────────────────────────────────────
function AgentScorecards() {
  const { debates, assessments, ideas } = useAgentData();

  const verdictByIdea = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assessments.data ?? []) m.set(a.idea_id, a.verdict);
    return m;
  }, [assessments.data]);

  const statusByIdea = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of ideas.data ?? []) m.set(i.id, i.status);
    return m;
  }, [ideas.data]);

  const stats = useMemo(
    () => computeStats(debates.data ?? [], verdictByIdea, statusByIdea),
    [debates.data, verdictByIdea, statusByIdea],
  );

  // Build sorted rows
  const rows = useMemo(() => {
    return Array.from(stats.entries())
      .map(([agent, s]) => {
        const resolved = s.correct + s.overconfident.length; // debates with known outcome
        const hitRate = resolved > 0 ? (s.correct / resolved) * 100 : null;
        const avgConf = avg(s.confidences);
        const avgLat = avg(s.latencies);
        const avgCalib = avg(s.calibration);
        const avgOver = avg(s.overconfident);
        // Calibration gap: how much more confident when wrong vs right
        const calibGap = avgCalib != null && avgOver != null ? avgOver - avgCalib : null;
        return { agent, ...s, hitRate, avgConf, avgLat, avgCalib, avgOver, calibGap, resolved };
      })
      .sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0));
  }, [stats]);

  const isLoading = debates.isLoading || assessments.isLoading || ideas.isLoading;
  const hasData = rows.length > 0;

  const top    = rows[0];
  const bottom = rows[rows.length - 1];
  const totalDebates = (debates.data ?? []).length;
  const totalIdeas   = new Set((debates.data ?? []).map((d) => d.idea_id)).size;

  return (
    <AppShell>
      <PageHeader
        title="Agent Quality Scorecards"
        subtitle="Real stats from your debate history — hit rate, calibration, latency"
      />
      <div className="space-y-6 px-8 py-6">

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-4 gap-4">
          <div className="panel p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <Brain className="h-3.5 w-3.5" /> Total Debates
            </div>
            <div className="mt-1 font-display text-3xl font-bold">{totalDebates}</div>
            <div className="font-mono text-xs text-muted-foreground">{totalIdeas} ideas</div>
          </div>

          <div className="panel p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-bull" /> Top Agent
            </div>
            {top ? (
              <>
                <div className="mt-1 font-display text-lg font-semibold">{AGENT_LABELS[top.agent] ?? top.agent}</div>
                <div className="font-mono text-xs text-bull">
                  {top.hitRate != null ? `${top.hitRate.toFixed(1)}% hit rate` : `${top.total} signals`}
                </div>
              </>
            ) : <div className="mt-1 text-sm text-muted-foreground">—</div>}
          </div>

          <div className="panel p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5 text-bear" /> Watch Agent
            </div>
            {bottom && bottom !== top ? (
              <>
                <div className="mt-1 font-display text-lg font-semibold">{AGENT_LABELS[bottom.agent] ?? bottom.agent}</div>
                <div className="font-mono text-xs text-bear">
                  {bottom.hitRate != null ? `${bottom.hitRate.toFixed(1)}% hit rate` : `${bottom.total} signals`}
                </div>
              </>
            ) : <div className="mt-1 text-sm text-muted-foreground">—</div>}
          </div>

          <div className="panel p-4">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Avg Confidence
            </div>
            <div className="mt-1 font-display text-3xl font-bold">
              {rows.length > 0
                ? `${(rows.reduce((s, r) => s + (r.avgConf ?? 0), 0) / rows.length).toFixed(0)}`
                : "—"}
            </div>
            <div className="font-mono text-xs text-muted-foreground">across all agents</div>
          </div>
        </div>

        {/* ── No data state ── */}
        {!isLoading && !hasData && (
          <div className="panel p-10 text-center">
            <Brain className="mx-auto h-10 w-10 opacity-20" strokeWidth={1} />
            <div className="mt-3 text-sm text-muted-foreground">
              No debate data yet. Run the committee on an idea to start collecting agent stats.
            </div>
          </div>
        )}

        {/* ── Main table ── */}
        {hasData && (
          <div className="panel overflow-hidden">
            <div className="border-b bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Per-Agent Performance · from {totalDebates} real debate turns
            </div>
            <table className="w-full text-sm">
              <thead className="border-b font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Agent</th>
                  <th className="px-4 py-2 text-left">Turns</th>
                  <th className="px-4 py-2 text-left">Hit Rate</th>
                  <th className="px-4 py-2 text-left">Stance Mix</th>
                  <th className="px-4 py-2 text-left">Avg Confidence</th>
                  <th className="px-4 py-2 text-left">Calibration</th>
                  <th className="px-4 py-2 text-left">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const hr = r.hitRate;
                  const hrColor = hr == null ? "var(--muted-foreground)"
                    : hr >= 70 ? "oklch(0.70 0.18 145)"
                    : hr >= 55 ? "oklch(0.78 0.15 75)"
                    : "oklch(0.62 0.20 25)";

                  const totalStance = r.for + r.against + r.neutral || 1;
                  const forPct     = (r.for     / totalStance) * 100;
                  const againstPct = (r.against / totalStance) * 100;
                  const neutralPct = (r.neutral / totalStance) * 100;

                  // Calibration: green = confident when right, red = confident when wrong
                  const calibGapColor = r.calibGap == null ? "text-muted-foreground"
                    : r.calibGap > 10 ? "text-bear"   // overconfident when wrong
                    : r.calibGap < -5 ? "text-bull"   // more confident when right
                    : "text-muted-foreground";

                  return (
                    <tr key={r.agent} className="border-b hover:bg-surface-2">
                      {/* Agent */}
                      <td className="px-4 py-3">
                        <AgentBadge agent={r.agent} size="sm" />
                      </td>

                      {/* Turns */}
                      <td className="px-4 py-3 font-mono text-xs">
                        <div>{r.total} turns</div>
                        {r.resolved > 0 && (
                          <div className="text-muted-foreground">{r.resolved} resolved</div>
                        )}
                      </td>

                      {/* Hit rate */}
                      <td className="px-4 py-3">
                        {hr != null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
                              <div className="h-full rounded-full" style={{ width: `${hr}%`, backgroundColor: hrColor }} />
                            </div>
                            <span className="font-mono text-xs font-semibold" style={{ color: hrColor }}>
                              {hr.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">
                            no resolved ideas yet
                          </span>
                        )}
                      </td>

                      {/* Stance mix */}
                      <td className="px-4 py-3">
                        <div className="flex h-2 w-32 overflow-hidden rounded-full">
                          <div style={{ width: `${forPct}%`, backgroundColor: "oklch(0.70 0.18 145)" }} title={`FOR ${r.for}`} />
                          <div style={{ width: `${againstPct}%`, backgroundColor: "oklch(0.62 0.20 25)" }} title={`AGAINST ${r.against}`} />
                          <div style={{ width: `${neutralPct}%`, backgroundColor: "oklch(0.65 0.18 280 / 0.4)" }} title={`NEUTRAL ${r.neutral}`} />
                        </div>
                        <div className="mt-1 flex gap-2 font-mono text-[9px] text-muted-foreground">
                          <span className="text-bull">{r.for}F</span>
                          <span className="text-bear">{r.against}A</span>
                          <span>{r.neutral}N</span>
                        </div>
                      </td>

                      {/* Avg confidence */}
                      <td className="px-4 py-3">
                        {r.avgConf != null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
                              <div className="h-full rounded-full bg-atlantix" style={{ width: `${r.avgConf}%` }} />
                            </div>
                            <span className="font-mono text-xs">{r.avgConf.toFixed(0)}</span>
                          </div>
                        ) : "—"}
                      </td>

                      {/* Calibration gap */}
                      <td className={`px-4 py-3 font-mono text-xs ${calibGapColor}`}>
                        {r.calibGap != null ? (
                          <div>
                            <div>
                              {r.calibGap > 0
                                ? `+${r.calibGap.toFixed(0)} overconfident`
                                : r.calibGap < 0
                                ? `${r.calibGap.toFixed(0)} well-calibrated`
                                : "neutral"}
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              {r.avgCalib != null ? `✓ conf ${r.avgCalib.toFixed(0)}` : ""}
                              {r.avgOver != null ? ` · ✗ conf ${r.avgOver.toFixed(0)}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Latency */}
                      <td className="px-4 py-3">
                        {r.avgLat != null ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" strokeWidth={1.6} />
                            <span className={`font-mono text-xs ${r.avgLat > 5000 ? "text-warning" : "text-muted-foreground"}`}>
                              {r.avgLat > 1000
                                ? `${(r.avgLat / 1000).toFixed(1)}s`
                                : `${r.avgLat.toFixed(0)}ms`}
                            </span>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Calibration explainer ── */}
        {hasData && (
          <div className="rounded-md border border-dashed bg-surface-2/40 p-4 text-xs text-muted-foreground space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-foreground mb-2">How stats are computed</div>
            <div><span className="text-foreground">Hit Rate</span> — % of turns where agent's stance matched the final outcome (FOR + approved idea, AGAINST + rejected idea). Only counts ideas with a resolved verdict.</div>
            <div><span className="text-foreground">Calibration</span> — difference between avg confidence when wrong vs right. Positive = agent is overconfident when wrong (bad). Negative = more confident when correct (good).</div>
            <div><span className="text-foreground">Stance Mix</span> — green/red/grey bar shows how often each agent goes FOR / AGAINST / NEUTRAL across all debates.</div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
