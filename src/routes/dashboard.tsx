import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { RegimePill } from "@/components/atlantix/RegimePill";
import { ScoreBar } from "@/components/atlantix/ScoreBar";
import { ArrowUpRight, Activity, AlertTriangle, Shield, Clock, Layers, Brain, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: CommandCenter });

const HEALTH_COMPONENT_KEYS = [
  "market_data_sync",
  "ingest_news",
  "macro_snapshot",
  "broker_sync",
  "feature_snapshot",
  "database",
] as const;

function normalizeHealthComponent(component: unknown): (typeof HEALTH_COMPONENT_KEYS)[number] | null {
  const raw = String(component ?? "").trim();
  if (!raw) return null;
  const k = raw.toLowerCase().replace(/[\s-]+/g, "_");

  if (k === "market_data_sync" || k === "market_data" || k === "finnhub" || k === "yahoo") return "market_data_sync";
  if (k === "ingest_news" || k === "news" || k === "newsapi") return "ingest_news";
  if (k === "macro_snapshot" || k === "macro" || k === "fred") return "macro_snapshot";
  if (k === "broker_sync" || k === "broker" || k === "alpaca") return "broker_sync";
  if (k === "feature_snapshot" || k === "fundamental_snapshot" || k === "fundamental" || k === "feature") return "feature_snapshot";
  if (k === "database" || k === "db" || k === "postgres" || k === "supabase") return "database";

  return null;
}

function CommandCenter() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const statusLabel = (status: string) => t(`status.${status}`, status);
  const sideLabel = (side: string) => t(`side.${side}`, side);
  const verdictLabel = (verdict: string) => t(`verdict.${verdict}`, String(verdict).replaceAll("_", " "));

  const { data: snapshot } = useQuery({
    queryKey: ["snapshot"],
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

  const { data: ideas } = useQuery({
    queryKey: ["top-ideas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ideas")
        .select("id,title,side,status,edge_score,risk_score,consensus_score,assets(ticker)")
        .order("edge_score", { ascending: false, nullsFirst: false })
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const { data: health } = useQuery({
    queryKey: ["health-latest"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_health_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const latestHealth = useMemo(() => {
    const map: Record<string, NonNullable<typeof health>[number]> = {};
    for (const h of health ?? []) {
      const k = normalizeHealthComponent(h.component) ?? String(h.component ?? "").toLowerCase();
      if (!map[k]) map[k] = h;
    }
    return map;
  }, [health]);

  const uniqueHealth = useMemo(() => Object.values(latestHealth), [latestHealth]);

  const { data: positions } = useQuery({
    queryKey: ["positions-open"],
    queryFn: async () => {
      const { data } = await supabase
        .from("positions")
        .select("*,assets(ticker)")
        .is("closed_at", null);
      return data ?? [];
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: pendingIdeas } = useQuery({
    queryKey: ["pending-approval"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ideas")
        .select("id, title, side, assets(ticker)")
        .eq("status", "awaiting_approval")
        .order("updated_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: ideaCounts } = useQuery({
    queryKey: ["idea-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("ideas").select("status");
      const active   = (data ?? []).filter((i) => !["rejected","closed","invalidated"].includes(i.status)).length;
      const pending  = (data ?? []).filter((i) => i.status === "awaiting_approval").length;
      const debating = (data ?? []).filter((i) => i.status === "debating").length;
      return { total: (data ?? []).length, active, pending, debating };
    },
    refetchInterval: 30_000,
  });

  const { data: latestVerdict } = useQuery({
    queryKey: ["latest-verdict"],
    queryFn: async () => {
      const { data } = await supabase
        .from("risk_assessments")
        .select("verdict, created_at, ideas(title)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60_000,
  });

  const bulletinItems = [
    ...(pendingIdeas ?? []).map((i) => ({
      id: `idea-${i.id}`,
      severity: "warn" as const,
      text: t("dashboard.bulletinAwaitingApproval", {
        ticker: (i.assets as any)?.ticker ?? "?",
        side: sideLabel(String(i.side)).toUpperCase(),
      }),
      action: () => nav({ to: "/debate", search: { id: i.id } }),
      actionLabel: t("dashboard.review"),
      time: null as string | null,
    })),
    ...(alerts ?? []).map((a) => ({
      id: a.id,
      severity: a.severity === "critical" ? "danger" as const : "info" as const,
      text: a.title,
      action: null as (() => void) | null,
      actionLabel: null as string | null,
      time: a.created_at,
    })),
  ];

  return (
    <AppShell>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        actions={snapshot ? <RegimePill regime={snapshot.regime ?? "neutral"} /> : null}
      />

      <div className="px-8 py-6">

        {/* ── Top 4 stat cards ── */}
        <div className="grid grid-cols-4 gap-4">
          <Link to="/portfolio">
            <div className="panel p-4 hover:bg-surface-2 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("dashboard.openPositions")}</div>
                <Layers className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="mt-2 font-mono text-3xl font-bold">{(positions ?? []).length}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {(positions ?? []).filter((p) => p.side === "long").length} {sideLabel("long")} ·{" "}
                {(positions ?? []).filter((p) => p.side === "short").length} {sideLabel("short")}
              </div>
            </div>
          </Link>

          <Link to="/debate">
            <div className="panel p-4 hover:bg-surface-2 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("dashboard.activeIdeas")}</div>
                <Brain className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="mt-2 font-mono text-3xl font-bold">{ideaCounts?.active ?? "—"}</div>
              <div className="mt-1 font-mono text-xs">
                {(ideaCounts?.pending ?? 0) > 0
                  ? <span className="text-warning">{t("dashboard.awaitingApprovalCount", { count: ideaCounts?.pending ?? 0 })}</span>
                  : <span className="text-muted-foreground">{t("dashboard.debatingCount", { count: ideaCounts?.debating ?? 0 })}</span>
                }
              </div>
            </div>
          </Link>

          <Link to="/risk">
            <div className="panel p-4 hover:bg-surface-2 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("dashboard.lastVerdict")}</div>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              {latestVerdict ? (
                <>
                  <div className={`mt-2 font-mono text-lg font-bold uppercase tracking-wider ${
                    latestVerdict.verdict === "approve"      ? "text-bull" :
                    latestVerdict.verdict === "reduce_size"  ? "text-warning" :
                    latestVerdict.verdict === "reject" || latestVerdict.verdict === "kill_switch" ? "text-bear" :
                    "text-muted-foreground"
                  }`}>
                    {verdictLabel(String(latestVerdict.verdict))}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {(latestVerdict.ideas as any)?.title ?? "—"}
                  </div>
                </>
              ) : (
                <div className="mt-2 font-mono text-sm text-muted-foreground">{t("dashboard.noVerdictsYet")}</div>
              )}
            </div>
          </Link>

          <Link to="/health">
            <div className="panel p-4 hover:bg-surface-2 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("dashboard.system")}</div>
                <Activity className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              {uniqueHealth.length > 0 ? (
                <>
                  <div className={`mt-2 font-mono text-lg font-bold uppercase ${
                    uniqueHealth.some((h) => String(h.status) === "error" || h.status === "red") ? "text-bear" :
                    uniqueHealth.some((h) => String(h.status) === "warn" || h.status === "yellow") ? "text-warning" :
                    "text-bull"
                  }`}>
                    {uniqueHealth.some((h) => String(h.status) === "error" || h.status === "red") ? t("dashboard.issues") :
                     uniqueHealth.some((h) => String(h.status) === "warn" || h.status === "yellow") ? t("dashboard.degraded") :
                     t("dashboard.healthy")}
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {t("dashboard.lastAt", { time: new Date(health![0].created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
                  </div>
                </>
              ) : (
                <div className="mt-2 font-mono text-sm text-muted-foreground">{t("health.noDataYet")}</div>
              )}
            </div>
          </Link>
        </div>

        {/* ── Top ideas + system status ── */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="panel col-span-2 p-5">
            <SectionTitle icon={ArrowUpRight} title={t("dashboard.topEdgeIdeas")} />
            <div className="mt-4 space-y-3">
              {ideas?.map((i) => {
                const ticker = (i.assets as { ticker?: string } | null)?.ticker;
                return (
                  <Link
                    key={i.id}
                    to="/debate"
                    search={{ id: i.id }}
                    className="block rounded-md border bg-surface-2 p-3 transition-colors hover:bg-surface-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">{ticker ?? "—"}</span>
                          <span className={`font-mono text-[10px] uppercase tracking-widest ${i.side === "long" ? "text-bull" : "text-bear"}`}>
                            {sideLabel(i.side)}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            {statusLabel(i.status as string)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm">{i.title}</div>
                      </div>
                      <div className="grid w-72 shrink-0 grid-cols-3 gap-3">
                        <ScoreBar value={i.edge_score} label={t("dashboard.edge")} tone="edge" />
                        <ScoreBar value={i.risk_score} label={t("dashboard.risk")} tone="risk" />
                        <ScoreBar value={i.consensus_score} label={t("dashboard.consensus")} tone="atlantix" />
                      </div>
                    </div>
                  </Link>
                );
              })}
              {(!ideas || ideas.length === 0) && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t("dashboard.noActiveIdeas")}
                </div>
              )}
            </div>
          </div>

          <div className="panel p-5">
            <SectionTitle icon={Activity} title={t("dashboard.systemStatus")} />
            <div className="mt-4 space-y-2">
              {HEALTH_COMPONENT_KEYS.map((key) => {
                const h = latestHealth[key];
                return (
                  <div key={key} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
                    <div className="font-mono text-xs uppercase tracking-wider">
                      {t(`health.components.${key}`, key)}
                    </div>
                    <StatusDot status={String(h?.status ?? "unknown")} />
                  </div>
                );
              })}
              {uniqueHealth.length === 0 && (
                <div className="text-xs text-muted-foreground">{t("health.noDataYet")}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Open positions + bulletin ── */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="panel p-5">
            <SectionTitle icon={Shield} title={t("dashboard.openPositions")} />
            <div className="mt-4 space-y-2">
              {(positions ?? []).map((p) => {
                const ticker = (p.assets as { ticker?: string } | null)?.ticker;
                const pnl = Number(p.unrealized_pnl ?? 0);
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="ticker text-sm">{ticker}</span>
                      <span className={`font-mono text-[10px] uppercase tracking-widest ${p.side === "long" ? "text-bull" : "text-bear"}`}>
                        {t(`side.${p.side}`, p.side)}
                      </span>
                      {p.weight_pct != null && (
                        <span className="font-mono text-xs text-muted-foreground">{Number(p.weight_pct).toFixed(1)}% {t("dashboard.navWeight")}</span>
                      )}
                    </div>
                    <div className={`font-mono text-sm ${pnl >= 0 ? "text-bull" : "text-bear"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(0)}
                    </div>
                  </div>
                );
              })}
              {(positions ?? []).length === 0 && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t("dashboard.noOpenPositions")}
                </div>
              )}
            </div>
          </div>

          <div className="panel p-5">
            <SectionTitle icon={AlertTriangle} title={t("dashboard.operatorBulletin")} />
            {bulletinItems.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t("dashboard.noPendingActions")}
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {bulletinItems.map((item) => {
                  const dotColor   = item.severity === "danger" ? "bg-bear" : item.severity === "warn" ? "bg-warning" : "bg-muted-foreground";
                  const textColor  = item.severity === "danger" ? "text-bear" : item.severity === "warn" ? "text-warning" : "text-muted-foreground";
                  return (
                    <li key={item.id} className="flex items-start justify-between gap-3 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
                        <span className={`leading-snug ${textColor}`}>{item.text}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.time && (
                          <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {item.action && (
                          <button
                            onClick={item.action}
                            className="rounded border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-warning hover:bg-warning/20"
                          >
                            {item.actionLabel}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-atlantix" strokeWidth={1.5} />
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider">{title}</h2>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const { t } = useTranslation();
  const colorMap: Record<string, string> = {
    ok:     "oklch(0.70 0.18 145)",
    green:  "oklch(0.70 0.18 145)",
    warn:   "oklch(0.78 0.15 75)",
    yellow: "oklch(0.78 0.15 75)",
    error:  "oklch(0.62 0.20 25)",
    red:    "oklch(0.62 0.20 25)",
    black:  "oklch(0.62 0.20 25)",
  };
  const s = String(status ?? "").toLowerCase();
  const color = colorMap[s] ?? "var(--muted-foreground)";
  const label =
    s === "ok" || s === "green" ? t("health.online") :
    s === "warn" || s === "yellow" ? t("health.degraded") :
    s === "error" || s === "red" ? t("health.offline") :
    s === "black" ? t("health.fault") :
    t("health.unknown");
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>{label}</span>
    </div>
  );
}
