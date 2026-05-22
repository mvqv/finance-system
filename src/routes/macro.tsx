import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { RegimePill } from "@/components/atlantix/RegimePill";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, ExternalLink,
} from "lucide-react";
import { STATUS_LABEL } from "@/lib/atlantix";

export const Route = createFileRoute("/macro")({ component: MacroPage });

// ── Regime metadata ───────────────────────────────────────────────────────────
const REGIME_META: Record<string, {
  label: string;
  color: string;
  bg: string;
  description: string;
  playbook: string[];
  warnings: string[];
}> = {
  bull: {
    label: "Bull",
    color: "oklch(0.70 0.18 145)",
    bg: "oklch(0.70 0.18 145 / 0.08)",
    description: "Spread positive, VIX low. Risk assets favoured. Momentum and growth factors outperform.",
    playbook: [
      "Favour LONG equities, especially growth and momentum",
      "Reduce cash drag — deploy into high-conviction ideas",
      "Tighten stop-losses to lock in gains",
      "Watch for complacency — VIX near lows can reverse fast",
    ],
    warnings: [],
  },
  bear: {
    label: "Bear",
    color: "oklch(0.62 0.20 25)",
    bg: "oklch(0.62 0.20 25 / 0.08)",
    description: "Yield curve inverted. Recession risk elevated. Defensive positioning warranted.",
    playbook: [
      "Reduce gross exposure — cut longs, add selective shorts",
      "Rotate into defensives: utilities, healthcare, staples",
      "Raise cash buffer above 20%",
      "Review all LONG ideas — invalidation conditions more likely",
    ],
    warnings: ["Inverted yield curve historically precedes recession by 6–18 months"],
  },
  neutral: {
    label: "Neutral",
    color: "oklch(0.65 0.18 280)",
    bg: "oklch(0.65 0.18 280 / 0.08)",
    description: "Mixed signals. No clear directional bias. Stock-picking alpha over beta.",
    playbook: [
      "Focus on idiosyncratic ideas with strong catalysts",
      "Keep position sizes moderate — no outsized bets",
      "Monitor macro for regime shift signals",
    ],
    warnings: [],
  },
  volatile: {
    label: "Volatile",
    color: "oklch(0.78 0.15 75)",
    bg: "oklch(0.78 0.15 75 / 0.08)",
    description: "VIX elevated (25–35). Intraday swings large. Risk of gap moves on news.",
    playbook: [
      "Reduce position sizes by 30–50%",
      "Widen stop-losses to avoid noise-driven stops",
      "Avoid adding new positions until VIX < 22",
      "Options hedges (puts, collars) cost-effective at elevated IV",
    ],
    warnings: ["Elevated VIX — gap risk on macro prints", "Liquidity thinner — slippage higher"],
  },
  crisis: {
    label: "Crisis",
    color: "oklch(0.62 0.20 25)",
    bg: "oklch(0.62 0.20 25 / 0.12)",
    description: "VIX ≥ 35. Systemic stress. Correlations spike to 1. Capital preservation first.",
    playbook: [
      "Activate kill switch — halt new idea approvals",
      "Close or hedge all speculative longs immediately",
      "Move to cash and short-duration treasuries",
      "Re-enter only after VIX closes below 28 for 3 sessions",
    ],
    warnings: [
      "CRISIS MODE — all correlations spike to 1",
      "Liquidity can evaporate — market orders dangerous",
      "Consider activating Kill Switch",
    ],
  },
};

// ── Indicator config: what each series means and what direction is "bad" ──────
const INDICATOR_META: Record<string, {
  description: string;
  badDirection: "up" | "down" | "both";
  thresholds?: { warn: number; danger: number };
}> = {
  VIXCLS:    { description: "Market fear gauge. >25 = stress, >35 = crisis.", badDirection: "up",   thresholds: { warn: 25, danger: 35 } },
  DFF:       { description: "Fed policy rate. Higher = tighter financial conditions.", badDirection: "up" },
  DGS10:     { description: "10-year Treasury yield. Benchmark for risk-free rate.", badDirection: "both" },
  DGS2:      { description: "2-year Treasury yield. Sensitive to Fed expectations.", badDirection: "both" },
  T10Y2Y:    { description: "Yield curve spread. Negative = inverted = recession signal.", badDirection: "down", thresholds: { warn: 0, danger: -0.5 } },
  CPIAUCSL:  { description: "Consumer Price Index. Inflation gauge.", badDirection: "up" },
  UNRATE:    { description: "Unemployment rate. Rising = labour market weakening.", badDirection: "up", thresholds: { warn: 5, danger: 7 } },
  DTWEXBGS:  { description: "USD broad index. Strong USD = headwind for EM and commodities.", badDirection: "both" },
  DCOILWTICO:{ description: "WTI crude oil price. Energy cost input for inflation.", badDirection: "both" },
};

function trendIcon(curr: number, prev: number | undefined, badDir: "up" | "down" | "both") {
  if (prev === undefined) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.01) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const up = diff > 0;
  const isBad = badDir === "both" ? false : (badDir === "up" ? up : !up);
  const color = isBad ? "text-bear" : "text-bull";
  return up
    ? <TrendingUp className={`h-3.5 w-3.5 ${color}`} />
    : <TrendingDown className={`h-3.5 w-3.5 ${color}`} />;
}

function indicatorStatus(series_id: string, value: number): "ok" | "warn" | "danger" {
  const meta = INDICATOR_META[series_id];
  if (!meta?.thresholds) return "ok";
  const { warn, danger } = meta.thresholds;
  if (meta.badDirection === "up") {
    if (value >= danger) return "danger";
    if (value >= warn) return "warn";
  } else if (meta.badDirection === "down") {
    if (value <= danger) return "danger";
    if (value <= warn) return "warn";
  }
  return "ok";
}

const STATUS_COLOR = { ok: "text-bull", warn: "text-warning", danger: "text-bear" };
const STATUS_DOT   = { ok: "bg-bull", warn: "bg-warning", danger: "bg-bear" };

// ── Regime impact on ideas ────────────────────────────────────────────────────
function regimeImpact(regime: string, side: string, sector: string | null): "favoured" | "neutral" | "headwind" {
  if (regime === "bull") return side === "long" ? "favoured" : "headwind";
  if (regime === "bear") return side === "short" ? "favoured" : "headwind";
  if (regime === "crisis") return side === "short" ? "favoured" : "headwind";
  if (regime === "volatile") return "neutral";
  return "neutral";
}

// ── Main ──────────────────────────────────────────────────────────────────────
function MacroPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: snap } = useQuery({
    queryKey: ["macro-snap"],
    queryFn: async () => {
      const { data } = await supabase
        .from("portfolio_snapshots")
        .select("regime, snapshot_at")
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: rawIndicators } = useQuery({
    queryKey: ["macro-indicators"],
    queryFn: async () => {
      // Fetch last 2 observations per series to compute trend
      const { data } = await supabase
        .from("macro_indicators")
        .select("*")
        .order("observed_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: ideas } = useQuery({
    queryKey: ["ideas-macro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ideas")
        .select("id, title, side, status, assets(ticker, sector)")
        .not("status", "in", '("rejected","closed","invalidated")')
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Dedupe: latest + previous per series
  const indicators = useMemo(() => {
    const byId = new Map<string, { latest: any; prev?: any }>();
    for (const r of rawIndicators ?? []) {
      const entry = byId.get(r.series_id);
      if (!entry) { byId.set(r.series_id, { latest: r }); }
      else if (!entry.prev) { byId.get(r.series_id)!.prev = r; }
    }
    return Array.from(byId.values());
  }, [rawIndicators]);

  const isTR = (id: string) => id.startsWith("TCMB_") || id.startsWith("TUIK_");
  const trList = indicators.filter((i) => isTR(i.latest.series_id));
  const usList = indicators.filter((i) => !isTR(i.latest.series_id));

  const regime = snap?.regime ?? "neutral";
  const regimeMeta = REGIME_META[regime] ?? REGIME_META.neutral;

  // Ideas impact
  const ideaImpact = useMemo(() => {
    return (ideas ?? []).map((idea) => {
      const asset = idea.assets as { ticker?: string; sector?: string } | null;
      const impact = regimeImpact(regime, idea.side as string, asset?.sector ?? null);
      return { ...idea, asset, impact };
    });
  }, [ideas, regime]);

  const favoured  = ideaImpact.filter((i) => i.impact === "favoured");
  const headwinds = ideaImpact.filter((i) => i.impact === "headwind");
  const neutral   = ideaImpact.filter((i) => i.impact === "neutral");

  const refresh = useMutation({
    mutationFn: async () => {
      setRefreshing(true);
      const { data, error } = await supabase.functions.invoke("macro-snapshot", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Synced — regime: ${d?.regime ?? "?"}`);
      qc.invalidateQueries({ queryKey: ["macro-snap"] });
      qc.invalidateQueries({ queryKey: ["macro-indicators"] });
    },
    onError: (e: any) => toast.error(`Sync failed: ${e?.message ?? e}`),
    onSettled: () => setRefreshing(false),
  });

  return (
    <AppShell>
      <PageHeader
        title="Macro Radar"
        subtitle="Live macro regime + impact on your ideas"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-4 text-xs text-muted-foreground bg-surface-2 px-3 py-1.5 rounded border border-dashed">
              <span className="font-mono text-[10px] uppercase tracking-widest text-atlantix">SOURCE:</span> 
              FRED / TCMB
            </div>
            {snap?.regime && <RegimePill regime={snap.regime} />}
            <Button size="sm" variant="outline" onClick={() => refresh.mutate()} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>
        }
      />

      <div className="space-y-6 px-8 py-6">

        {/* ── Regime card ── */}
        <div
          className="rounded-xl border p-6"
          style={{ borderColor: regimeMeta.color, backgroundColor: regimeMeta.bg }}
        >
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current Regime</div>
              <div className="mt-1 font-display text-4xl font-bold" style={{ color: regimeMeta.color }}>
                {regimeMeta.label}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{regimeMeta.description}</p>

              {/* Warnings */}
              {regimeMeta.warnings.length > 0 && (
                <div className="mt-3 space-y-1">
                  {regimeMeta.warnings.map((w) => (
                    <div key={w} className="flex items-center gap-2 text-xs text-bear">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Playbook */}
            <div className="w-80 shrink-0 rounded-lg border bg-surface-2 p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Playbook for this regime
              </div>
              <ul className="space-y-1.5">
                {regimeMeta.playbook.map((step) => (
                  <li key={step} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0 text-muted-foreground">→</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Last updated */}
          {snap?.snapshot_at && (
            <div className="mt-4 font-mono text-[10px] text-muted-foreground">
              Last updated: {new Date(snap.snapshot_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* ── Regime impact on ideas ── */}
        {ideaImpact.length > 0 && (
          <div className="panel p-5">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Regime Impact on Your Ideas
            </div>
            <div className="grid grid-cols-3 gap-4">
              {/* Favoured */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bull">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Favoured ({favoured.length})
                </div>
                <div className="space-y-1.5">
                  {favoured.length === 0
                    ? <div className="text-xs text-muted-foreground">None</div>
                    : favoured.map((i) => (
                      <IdeaChip key={i.id} idea={i} onClick={() => nav({ to: "/debate", search: { id: i.id } })} />
                    ))
                  }
                </div>
              </div>

              {/* Neutral */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Minus className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Neutral ({neutral.length})
                </div>
                <div className="space-y-1.5">
                  {neutral.length === 0
                    ? <div className="text-xs text-muted-foreground">None</div>
                    : neutral.map((i) => (
                      <IdeaChip key={i.id} idea={i} onClick={() => nav({ to: "/debate", search: { id: i.id } })} />
                    ))
                  }
                </div>
              </div>

              {/* Headwinds */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-bear">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Headwinds ({headwinds.length})
                </div>
                <div className="space-y-1.5">
                  {headwinds.length === 0
                    ? <div className="text-xs text-muted-foreground">None</div>
                    : headwinds.map((i) => (
                      <IdeaChip key={i.id} idea={i} onClick={() => nav({ to: "/debate", search: { id: i.id } })} />
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── No data state ── */}
        {indicators.length === 0 && (
          <div className="panel p-8 text-center">
            <div className="text-sm text-muted-foreground">
              No macro data yet. Hit <span className="font-mono text-foreground">Refresh FRED</span> to pull live indicators.
            </div>
          </div>
        )}

        {/* ── US Macro indicators ── */}
        {usList.length > 0 && (
          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              🇺🇸 US Macro — FRED
            </div>
            <div className="grid grid-cols-3 gap-4">
              {usList.map(({ latest, prev }) => (
                <IndicatorCard key={latest.series_id} latest={latest} prev={prev} />
              ))}
            </div>
          </div>
        )}

        {/* ── TR Macro indicators ── */}
        {trList.length > 0 && (
          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              🇹🇷 Türkiye Macro — TCMB · TÜİK
            </div>
            <div className="grid grid-cols-3 gap-4">
              {trList.map(({ latest, prev }) => (
                <IndicatorCard key={latest.series_id} latest={latest} prev={prev} />
              ))}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IndicatorCard({ latest, prev }: { latest: any; prev?: any }) {
  const meta = INDICATOR_META[latest.series_id];
  const status = indicatorStatus(latest.series_id, Number(latest.value));
  const prevVal = prev ? Number(prev.value) : undefined;
  const diff = prevVal !== undefined ? Number(latest.value) - prevVal : undefined;

  return (
    <div className={`panel p-4 ${status === "danger" ? "border-bear/50" : status === "warn" ? "border-warning/50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground leading-tight">
          {latest.label}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
          {meta && trendIcon(Number(latest.value), prevVal, meta.badDirection)}
        </div>
      </div>

      <div className={`mt-2 font-display text-2xl font-bold ${STATUS_COLOR[status]}`}>
        {Number(latest.value).toFixed(2)}
        <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{latest.unit}</span>
      </div>

      {diff !== undefined && (
        <div className={`mt-0.5 font-mono text-[10px] ${diff > 0 ? "text-bull" : diff < 0 ? "text-bear" : "text-muted-foreground"}`}>
          {diff > 0 ? "+" : ""}{diff.toFixed(2)} vs prev
        </div>
      )}

      {meta?.description && (
        <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {meta.description}
        </div>
      )}

      <div className="mt-2 font-mono text-[9px] text-muted-foreground">
        {new Date(latest.observed_at).toLocaleDateString()}
      </div>
    </div>
  );
}

function IdeaChip({
  idea,
  onClick,
}: {
  idea: { id: string; title: string; side: string; status: string; asset: { ticker?: string; sector?: string } | null };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-2 rounded-md border bg-surface-2 px-2.5 py-2 text-left text-xs transition-colors hover:bg-surface-3"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="ticker shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px]">
          {idea.asset?.ticker ?? "—"}
        </span>
        <span className={`shrink-0 font-mono text-[10px] uppercase ${idea.side === "long" ? "text-bull" : "text-bear"}`}>
          {idea.side}
        </span>
        <span className="truncate text-muted-foreground">{idea.title}</span>
      </div>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
