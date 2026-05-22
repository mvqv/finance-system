import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useShariahMode } from "@/hooks/useShariahMode";
import {
  MoonStar,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  HelpCircle,
  Coins,
} from "lucide-react";

export const Route = createFileRoute("/shariah-guard")({
  component: ShariahGuardPage,
});

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation();

  if (status === "compliant") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
        <ShieldCheck className="h-3 w-3" />
        {t("shariahGuard.compliant")}
      </span>
    );
  }
  if (status === "non-compliant") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-red-400">
        <ShieldX className="h-3 w-3" />
        {t("shariahGuard.nonCompliant")}
      </span>
    );
  }
  if (status === "questionable") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-400">
        <ShieldAlert className="h-3 w-3" />
        {t("shariahGuard.questionable")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      <HelpCircle className="h-3 w-3" />
      {t("shariahGuard.notScreened")}
    </span>
  );
}

// ── Pct formatter ─────────────────────────────────────────────────────────────
function fmtPct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);
}

// ── Page ──────────────────────────────────────────────────────────────────────
function ShariahGuardPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { isShariahModeEnabled, setShariahMode } = useShariahMode();
  const [syncing, setSyncing] = useState(false);

  // ── Watchlist assets with Shariah columns ──────────────────────────────────
  const { data: watchlistAssets } = useQuery({
    queryKey: ["shariah-watchlist"],
    queryFn: async () => {
      const { data } = await supabase
        .from("watchlist")
        .select(
          "id, asset_id, assets(id, ticker, name, asset_class, shariah_status, debt_to_market_cap, interest_bearing_cash, haram_revenue_pct)",
        )
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  // ── Purification amounts from trade_journal (current month) ───────────────
  // NOTE: purification_amount column not present on trade_journal yet —
  // returning an empty list until the schema lands. Cast keeps render code
  // (which expects { assets, id, closed_at, purification_amount }) happy.
  const { data: purificationData } = useQuery({
    queryKey: ["shariah-purification"],
    queryFn: async () => {
      return [] as Array<{
        id: string;
        purification_amount: number | null;
        assets: { ticker?: string } | null;
        closed_at: string | null;
      }>;
    },
    refetchInterval: 30_000,
  });

  const totalPurification = purificationData?.reduce(
    (sum, row) => sum + (row.purification_amount ?? 0),
    0,
  ) ?? 0;

  // ── Sync with Zoya ─────────────────────────────────────────────────────────
  async function syncZoya() {
    if (!watchlistAssets?.length) {
      toast.error(t("shariahGuard.noWatchlist"));
      return;
    }
    setSyncing(true);
    try {
      const tickers = watchlistAssets
        .map((w) => (w.assets as any)?.ticker)
        .filter(Boolean) as string[];

      const { data, error } = await supabase.functions.invoke("zoya-sync", {
        body: { tickers },
      });
      if (error) throw error;

      const result = data as { synced: number; mock?: boolean };
      toast.success(t("shariahGuard.syncSuccess", { n: result.synced }));
      if (result.mock) {
        toast.info(t("shariahGuard.mockNote"), { duration: 5000 });
      }
      qc.invalidateQueries({ queryKey: ["shariah-watchlist"] });
    } catch (e) {
      toast.error(t("shariahGuard.syncFailed"));
      console.error(e);
    } finally {
      setSyncing(false);
    }
  }

  const currentMonthLabel = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell>
      <PageHeader
        title={t("shariahGuard.title")}
        subtitle={t("shariahGuard.subtitle")}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={syncZoya}
            disabled={syncing}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? t("shariahGuard.syncing") : t("shariahGuard.syncZoya")}
          </Button>
        }
      />

      <div className="space-y-6 px-8 py-6">
        {/* ── Block 1: Strict Shariah Mode Toggle ─────────────────────────── */}
        <div className="panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg border"
                style={{
                  borderColor: isShariahModeEnabled
                    ? "oklch(0.75 0.15 145 / 0.4)"
                    : "var(--border)",
                  backgroundColor: isShariahModeEnabled
                    ? "oklch(0.75 0.15 145 / 0.1)"
                    : "transparent",
                }}
              >
                <MoonStar
                  className="h-5 w-5"
                  style={{
                    color: isShariahModeEnabled
                      ? "oklch(0.75 0.15 145)"
                      : "var(--muted-foreground)",
                  }}
                />
              </div>
              <div>
                <div className="font-semibold">{t("shariahGuard.strictMode")}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {t("shariahGuard.strictModeDesc")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isShariahModeEnabled && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                  Active
                </span>
              )}
              <Switch
                id="shariah-mode-toggle"
                checked={isShariahModeEnabled}
                onCheckedChange={(checked) => {
                  setShariahMode(checked);
                  toast.success(
                    checked
                      ? "Strict Shariah Mode enabled"
                      : "Strict Shariah Mode disabled",
                  );
                }}
              />
              <Label htmlFor="shariah-mode-toggle" className="sr-only">
                {t("shariahGuard.strictMode")}
              </Label>
            </div>
          </div>

          {isShariahModeEnabled && (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <ul className="space-y-1 font-mono text-[11px] text-emerald-400">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3 shrink-0" />
                  Short selling disabled in New Idea Dialog &amp; Execution Console
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3 shrink-0" />
                  Options Desk skipped in committee (derivatives not permissible)
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3 shrink-0" />
                  Compliance agent acts as Shariah Scholar — FATWA: BLOCK on non-compliant assets
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* ── Block 2: Compliance Monitor ──────────────────────────────────── */}
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <div className="font-semibold">{t("shariahGuard.complianceMonitor")}</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {t("shariahGuard.complianceDesc")}
              </div>
            </div>
          </div>

          {!watchlistAssets?.length ? (
            <div className="px-5 py-8 text-center font-mono text-sm text-muted-foreground">
              {t("shariahGuard.noWatchlist")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-surface-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">{t("shariahGuard.ticker")}</th>
                  <th className="px-4 py-3 text-left">{t("shariahGuard.name")}</th>
                  <th className="px-4 py-3 text-left">{t("shariahGuard.status")}</th>
                  <th className="px-4 py-3 text-right">{t("shariahGuard.debtMc")}</th>
                  <th className="px-4 py-3 text-right">{t("shariahGuard.cashMc")}</th>
                  <th className="px-4 py-3 text-right">{t("shariahGuard.haramRev")}</th>
                </tr>
              </thead>
              <tbody>
                {watchlistAssets.map((w) => {
                  const a = w.assets as {
                    id?: string;
                    ticker?: string;
                    name?: string;
                    asset_class?: string;
                    shariah_status?: string | null;
                    debt_to_market_cap?: number | null;
                    interest_bearing_cash?: number | null;
                    haram_revenue_pct?: number | null;
                  } | null;
                  return (
                    <tr
                      key={w.id}
                      className="border-b transition-colors hover:bg-surface-2"
                    >
                      <td className="px-4 py-3">
                        <span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">
                          {a?.ticker ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {a?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a?.shariah_status ?? null} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span
                          className={
                            a?.debt_to_market_cap != null &&
                            a.debt_to_market_cap > 0.33
                              ? "text-red-400"
                              : ""
                          }
                        >
                          {fmtPct(a?.debt_to_market_cap)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span
                          className={
                            a?.interest_bearing_cash != null &&
                            a.interest_bearing_cash > 0.33
                              ? "text-red-400"
                              : ""
                          }
                        >
                          {fmtPct(a?.interest_bearing_cash)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span
                          className={
                            a?.haram_revenue_pct != null &&
                            a.haram_revenue_pct > 5
                              ? "text-red-400"
                              : ""
                          }
                        >
                          {a?.haram_revenue_pct != null
                            ? `${a.haram_revenue_pct.toFixed(1)}%`
                            : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Block 3: Purification Engine ─────────────────────────────────── */}
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
              <Coins className="h-4.5 w-4.5 text-amber-400" />
            </div>
            <div>
              <div className="font-semibold">{t("shariahGuard.purificationEngine")}</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {t("shariahGuard.purificationDesc")}
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-border bg-surface-2 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("shariahGuard.currentMonth")} — {currentMonthLabel}
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-amber-400">
              {fmtCurrency(totalPurification)}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {t("shariahGuard.totalPurification")}
            </div>
          </div>

          {!purificationData?.length ? (
            <div className="py-4 text-center font-mono text-sm text-muted-foreground">
              {t("shariahGuard.noPurification")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="pb-2 text-left">Ticker</th>
                  <th className="pb-2 text-left">Closed</th>
                  <th className="pb-2 text-right">Purification</th>
                </tr>
              </thead>
              <tbody>
                {purificationData.map((row) => {
                  const a = row.assets as { ticker?: string } | null;
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2">
                        <span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">
                          {a?.ticker ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {row.closed_at
                          ? new Date(row.closed_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-amber-400">
                        {fmtCurrency(row.purification_amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
