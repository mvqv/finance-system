import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { useUserRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Power, ShieldOff, ShieldCheck, Loader2,
  AlertTriangle, ExternalLink, TrendingDown,
} from "lucide-react";

export const Route = createFileRoute("/risk")({ component: RiskPage });

// ── helpers ───────────────────────────────────────────────────────────────────
const VERDICT_TONE: Record<string, string> = {
  approve:      "text-bull",
  reduce_size:  "text-warning",
  wait:         "text-muted-foreground",
  reject:       "text-bear",
  kill_switch:  "text-bear",
};
const VERDICT_BG: Record<string, string> = {
  approve:      "bg-bull/10 border-bull/30",
  reduce_size:  "bg-warning/10 border-warning/30",
  wait:         "bg-muted/10 border-muted/30",
  reject:       "bg-bear/10 border-bear/30",
  kill_switch:  "bg-bear/10 border-bear/30",
};

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Number(n).toFixed(1)}%`;
}

// ── data hooks ────────────────────────────────────────────────────────────────
function useRiskData() {
  const assessments = useQuery({
    queryKey: ["risk-assessments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("risk_assessments")
        .select("*, ideas(id, title, side, status)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const kill = useQuery({
    queryKey: ["kill-switch"],
    queryFn: async () => {
      const { data } = await supabase.from("kill_switch_state").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  const ideas = useQuery({
    queryKey: ["ideas-for-risk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ideas")
        .select("id, title, status")
        .in("status", ["draft", "researching", "debating", "approved"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const positions = useQuery({
    queryKey: ["positions-risk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("positions")
        .select("*, assets(ticker, name, sector)")
        .is("closed_at", null);
      return data ?? [];
    },
  });

  const snap = useQuery({
    queryKey: ["portfolio-snap-risk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("portfolio_snapshots")
        .select("*")
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const limits = useQuery({
    queryKey: ["market-limits"],
    queryFn: async () => {
      const { data } = await supabase.from("market_limits").select("*");
      return data ?? [];
    },
  });

  const stress = useQuery({
    queryKey: ["stress-results"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stress_results")
        .select("*, stress_scenarios(name, description)")
        .order("computed_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  return { assessments, kill, ideas, positions, snap, limits, stress };
}

// ── main page ─────────────────────────────────────────────────────────────────
function RiskPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const role = useUserRole();
  const isOwner = role === "owner";
  const isOperator = role === "owner" || role === "operator";
  const statusLabel = (status: string) => t(`status.${status}`, status);
  const sideLabel = (side: string) => t(`side.${side}`, side);
  const verdictLabel = (verdict: string) => t(`verdict.${verdict}`, String(verdict).replaceAll("_", " "));

  const { assessments, kill, ideas, positions, snap, limits, stress } = useRiskData();

  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [evalBusy, setEvalBusy] = useState(false);
  const [evalIdea, setEvalIdea] = useState("");

  // ── derived: verdict distribution ─────────────────────────────────────────
  const verdictDist = useMemo(() => {
    const counts: Record<string, number> = { approve: 0, reduce_size: 0, wait: 0, reject: 0, kill_switch: 0 };
    for (const a of assessments.data ?? []) counts[a.verdict] = (counts[a.verdict] ?? 0) + 1;
    return counts;
  }, [assessments.data]);

  // ── derived: sector concentration ─────────────────────────────────────────
  const sectorConc = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const p of positions.data ?? []) {
      const sector = (p.assets as any)?.sector ?? t("common.unknown");
      const w = Number(p.weight_pct ?? 0);
      map.set(sector, (map.get(sector) ?? 0) + w);
      total += w;
    }
    return Array.from(map.entries())
      .map(([sector, weight]) => ({ sector, weight, pct: total > 0 ? (weight / total) * 100 : 0 }))
      .sort((a, b) => b.weight - a.weight);
  }, [positions.data]);

  // ── derived: positions without stop-loss ──────────────────────────────────
  const noStop = useMemo(
    () => (positions.data ?? []).filter((p) => p.stop_loss == null),
    [positions.data]
  );

  // ── actions ───────────────────────────────────────────────────────────────
  async function reEvaluate() {
    if (!evalIdea) return toast.error(t("risk.pickIdea"));
    setEvalBusy(true);
    try {
      const langSource =
        i18n.resolvedLanguage ??
        i18n.language ??
        (typeof window !== "undefined" ? window.localStorage.getItem("atlantix:lang") : null) ??
        "tr";
      const lang = String(langSource).toLowerCase().startsWith("tr") ? "tr" : "en";

      const { error } = await supabase.functions.invoke("evaluate-risk", {
        body: { idea_id: evalIdea, lang },
      });
      if (error) throw error;
      toast.success(t("risk.reEvaluated"));
      qc.invalidateQueries({ queryKey: ["risk-assessments"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("risk.failed"));
    } finally { setEvalBusy(false); }
  }

  async function toggleKill(engage: boolean) {
    if (engage && !reason.trim()) return toast.error(t("risk.reasonRequired"));
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("kill_switch_state").update({
        engaged: engage,
        reason: engage ? reason : null,
        engaged_by: engage ? u.user?.id ?? null : null,
        engaged_at: engage ? new Date().toISOString() : null,
      }).eq("id", 1);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        actor_id: u.user?.id ?? null,
        action: engage ? "kill_switch_engage" : "kill_switch_disarm",
        target_type: "system",
        payload: { reason },
      });
      toast.success(engage ? t("risk.engagedToast") : t("risk.disarmedToast"));
      setReason("");
      qc.invalidateQueries({ queryKey: ["kill-switch"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("risk.failed"));
    } finally { setBusy(false); }
  }

  const killData = kill.data;
  const snapData = snap.data;

  return (
    <AppShell>
      <PageHeader title={t("risk.title")} subtitle={t("risk.subtitle")} />
      <div className="space-y-6 px-8 py-6">

        {/* ── Row 1: Kill switch + Daily risk + Verdict dist ── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Kill switch */}
          <div className={`panel p-4 col-span-1 ${killData?.engaged ? "border-bear bg-bear/5" : ""}`}>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("risk.killSwitch")}</div>
            <div className={`mt-1 font-display text-2xl font-bold ${killData?.engaged ? "text-bear" : "text-bull"}`}>
              {killData?.engaged ? t("risk.engaged") : t("risk.disarmed")}
            </div>
            {killData?.reason && <div className="mt-1 font-mono text-xs text-muted-foreground">{killData.reason}</div>}
            {isOwner && (
              <div className="mt-3 flex flex-col gap-2">
                {!killData?.engaged && (
                  <Input
                    placeholder={t("risk.reasonPlaceholder")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-xs"
                  />
                )}
                {killData?.engaged ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleKill(false)}>
                    <ShieldOff className="mr-1 h-3.5 w-3.5" /> {t("risk.disarm")}
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => toggleKill(true)}>
                    <Power className="mr-1 h-3.5 w-3.5" /> {t("risk.engage")}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Daily risk used */}
          <div className="panel p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("risk.dailyRiskUsed")}</div>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-display text-3xl font-bold">
                {pct(snapData?.daily_risk_used_pct)}
              </span>
              <span className="mb-1 font-mono text-xs text-muted-foreground">{t("risk.ofDailyLimit")}</span>
            </div>
            {/* Bar */}
            <div className="mt-3 h-2 w-full rounded-full bg-surface-3">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Number(snapData?.daily_risk_used_pct ?? 0))}%`,
                  backgroundColor: Number(snapData?.daily_risk_used_pct ?? 0) > 80
                    ? "oklch(0.62 0.20 25)"
                    : Number(snapData?.daily_risk_used_pct ?? 0) > 50
                    ? "oklch(0.78 0.15 75)"
                    : "oklch(0.70 0.18 145)",
                }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t("dashboard.totalEquity")}</div>
                <div className="font-mono font-semibold">${Number(snapData?.total_equity ?? 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t("dashboard.dailyPnl")}</div>
                <div className={`font-mono font-semibold ${Number(snapData?.daily_pnl ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>
                  {Number(snapData?.daily_pnl ?? 0) >= 0 ? "+" : ""}${Number(snapData?.daily_pnl ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Verdict distribution */}
          <div className="panel p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("risk.verdictDist")}</div>
            <div className="mt-3 space-y-2">
              {Object.entries(verdictDist).map(([v, count]) => {
                const total = Object.values(verdictDist).reduce((a, b) => a + b, 0);
                const pctVal = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={v} className="flex items-center gap-2">
                    <span className={`w-24 font-mono text-[10px] uppercase tracking-widest ${VERDICT_TONE[v]}`}>
                      {verdictLabel(v)}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-surface-3">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${pctVal}%`,
                          backgroundColor: v === "approve" ? "oklch(0.70 0.18 145)"
                            : v === "reduce_size" ? "oklch(0.78 0.15 75)"
                            : v === "reject" || v === "kill_switch" ? "oklch(0.62 0.20 25)"
                            : "oklch(0.65 0.18 280 / 0.5)",
                        }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono text-xs text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Row 2: Sector concentration + No stop-loss alert ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Sector concentration */}
          <div className="panel p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("risk.sectorConcentration")}
            </div>
            {sectorConc.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">{t("dashboard.noOpenPositions")}</div>
            ) : (
              <div className="space-y-3">
                {sectorConc.map(({ sector, weight, pct: pctVal }) => (
                  <div key={sector}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{sector}</span>
                      <span className={`font-mono ${pctVal > 40 ? "text-bear font-bold" : pctVal > 25 ? "text-warning" : "text-muted-foreground"}`}>
                        {weight.toFixed(1)}% {t("dashboard.navWeight")}
                        {pctVal > 40 && <AlertTriangle className="inline ml-1 h-3 w-3" />}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-3">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, pctVal)}%`,
                          backgroundColor: pctVal > 40
                            ? "oklch(0.62 0.20 25)"
                            : pctVal > 25
                            ? "oklch(0.78 0.15 75)"
                            : "oklch(0.65 0.18 280)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Positions without stop-loss */}
          <div className={`panel p-4 ${noStop.length > 0 ? "border-bear/40" : ""}`}>
            <div className="mb-3 flex items-center gap-2">
              {noStop.length > 0 && <AlertTriangle className="h-4 w-4 text-bear" strokeWidth={1.6} />}
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("risk.positionsNoStop")}
              </span>
              {noStop.length > 0 && (
                <span className="ml-auto rounded-full bg-bear/15 px-2 py-0.5 font-mono text-[10px] font-bold text-bear">
                  {t("risk.atRiskCount", { count: noStop.length })}
                </span>
              )}
            </div>
            {noStop.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-xs text-bull">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.6} />
                {t("risk.allHaveStop")}
              </div>
            ) : (
              <div className="space-y-2">
                {noStop.map((p) => {
                  const a = p.assets as { ticker?: string; sector?: string } | null;
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-bear/20 bg-bear/5 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="ticker rounded bg-surface px-1.5 py-0.5 text-[10px]">{a?.ticker ?? "—"}</span>
                        <span className={`font-mono text-[10px] uppercase ${p.side === "long" ? "text-bull" : "text-bear"}`}>{sideLabel(p.side)}</span>
                        <span className="text-muted-foreground">{a?.sector ?? ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono ${Number(p.unrealized_pnl ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>
                          {Number(p.unrealized_pnl ?? 0) >= 0 ? "+" : ""}${Number(p.unrealized_pnl ?? 0).toFixed(0)}
                        </span>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                          onClick={() => nav({ to: "/portfolio" })}>
                          {t("risk.setStop")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Market limits ── */}
        {(limits.data ?? []).length > 0 && (
          <div className="panel overflow-hidden">
            <div className="border-b bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("risk.marketLimits")}
            </div>
            <table className="w-full text-sm">
              <thead className="border-b font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">{t("risk.market")}</th>
                  <th className="px-4 py-2 text-left">{t("risk.maxPosition")}</th>
                  <th className="px-4 py-2 text-left">{t("risk.maxDailyRisk")}</th>
                  <th className="px-4 py-2 text-left">{t("risk.maxGrossExposure")}</th>
                  <th className="px-4 py-2 text-left">{t("risk.notes")}</th>
                </tr>
              </thead>
              <tbody>
                {limits.data?.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-surface-2">
                    <td className="px-4 py-2 font-mono font-semibold">{l.market}</td>
                    <td className="px-4 py-2 font-mono">{pct(l.max_position_pct)}</td>
                    <td className="px-4 py-2 font-mono">{pct(l.max_daily_risk_pct)}</td>
                    <td className="px-4 py-2 font-mono">{pct(l.max_gross_exposure_pct)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{l.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Stress tests ── */}
        {(stress.data ?? []).length > 0 && (
          <div className="panel overflow-hidden">
            <div className="border-b bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("risk.stressTests")}
            </div>
            <table className="w-full text-sm">
              <thead className="border-b font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">{t("risk.scenario")}</th>
                  <th className="px-4 py-2 text-left">{t("risk.projectedPnL")}</th>
                  <th className="px-4 py-2 text-left">{t("risk.maxDrawdown")}</th>
                  <th className="px-4 py-2 text-left">{t("risk.worstPosition")}</th>
                  <th className="px-4 py-2 text-left">{t("risk.computed")}</th>
                </tr>
              </thead>
              <tbody>
                {stress.data?.map((s) => {
                  const scenario = s.stress_scenarios as { name?: string; description?: string } | null;
                  const pnl = Number(s.projected_pnl ?? 0);
                  const dd = Number(s.projected_drawdown_pct ?? 0);
                  return (
                    <tr key={s.id} className="border-b hover:bg-surface-2">
                      <td className="px-4 py-2">
                        <div className="font-medium">{scenario?.name ?? s.scenario_id}</div>
                        {scenario?.description && (
                          <div className="text-xs text-muted-foreground">{scenario.description}</div>
                        )}
                      </td>
                      <td className={`px-4 py-2 font-mono font-semibold ${pnl >= 0 ? "text-bull" : "text-bear"}`}>
                        {pnl >= 0 ? "+" : ""}${pnl.toLocaleString()}
                      </td>
                      <td className={`px-4 py-2 font-mono ${dd < -10 ? "text-bear font-bold" : dd < -5 ? "text-warning" : "text-muted-foreground"}`}>
                        {dd.toFixed(1)}%
                        {dd < -10 && <TrendingDown className="inline ml-1 h-3 w-3" />}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {s.worst_position_ticker ? (
                          <span>
                            <span className="ticker rounded bg-surface px-1.5 py-0.5 text-[10px]">{s.worst_position_ticker}</span>
                            {s.worst_position_pnl != null && (
                              <span className="ml-1 text-bear">${Number(s.worst_position_pnl).toLocaleString()}</span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {new Date(s.computed_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Re-evaluate ── */}
        <div className="panel p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-warning" />
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("risk.reEvaluate")}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <select
              className="flex-1 rounded border bg-background px-2 py-1 text-sm"
              value={evalIdea}
              onChange={(e) => setEvalIdea(e.target.value)}
              disabled={!isOperator}
            >
              <option value="">{t("risk.selectIdea")}</option>
              {ideas.data?.map((i) => (
                <option key={i.id} value={i.id}>{i.title} · {statusLabel(i.status)}</option>
              ))}
            </select>
            <Button onClick={reEvaluate} disabled={!isOperator || evalBusy || !evalIdea}>
              {evalBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
              {t("risk.run")}
            </Button>
          </div>
        </div>

        {/* ── Recent verdicts ── */}
        <div className="panel overflow-hidden">
          <div className="border-b bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("risk.recentVerdicts")}
          </div>
          <table className="w-full text-sm">
            <thead className="border-b font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("risk.idea")}</th>
                <th className="px-4 py-2 text-left">{t("risk.side")}</th>
                <th className="px-4 py-2 text-left">{t("risk.verdict")}</th>
                <th className="px-4 py-2 text-left">{t("risk.maxPos")}</th>
                <th className="px-4 py-2 text-left">{t("risk.rationale")}</th>
                <th className="px-4 py-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {(assessments.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {t("risk.noVerdictsYet")}
                  </td>
                </tr>
              )}
              {assessments.data?.map((r) => {
                const idea = r.ideas as { id?: string; title?: string; side?: string; status?: string } | null;
                return (
                  <tr key={r.id} className="border-b hover:bg-surface-2">
                    <td className="px-4 py-2 font-medium">{idea?.title ?? "—"}</td>
                    <td className={`px-4 py-2 font-mono text-xs uppercase ${idea?.side === "long" ? "text-bull" : "text-bear"}`}>
                      {idea?.side ? sideLabel(idea.side) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${VERDICT_BG[r.verdict] ?? ""} ${VERDICT_TONE[r.verdict] ?? ""}`}>
                        {verdictLabel(String(r.verdict))}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {r.max_position_pct ? `${Number(r.max_position_pct).toFixed(1)}%` : "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-muted-foreground">
                      {r.rationale ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      {idea?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 gap-1 px-2 text-[10px]"
                          onClick={() => nav({ to: "/debate", search: { id: idea.id! } })}
                        >
                          <ExternalLink className="h-3 w-3" /> {t("risk.openDebate")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </AppShell>
  );
}
