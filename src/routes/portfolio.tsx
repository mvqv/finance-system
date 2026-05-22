import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { RegimePill } from "@/components/atlantix/RegimePill";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Activity } from "lucide-react";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });

function PortfolioPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"sync" | "prices" | null>(null);

  const { data: snap } = useQuery({
    queryKey: ["portfolio-latest"],
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

  const { data: positions } = useQuery({
    queryKey: ["positions-open"],
    queryFn: async () => {
      const { data } = await supabase
        .from("positions")
        .select("*, assets(ticker, name, asset_class)")
        .is("closed_at", null)
        .order("opened_at", { ascending: false });
      return data ?? [];
    },
  });

  const syncBroker = useMutation({
    mutationFn: async () => {
      setBusy("sync");
      const { data, error } = await supabase.functions.invoke("broker-sync-portfolio", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`${t("portfolio.syncBroker")} — $${Number(d?.equity ?? 0).toLocaleString()}, ${d?.positions ?? 0}`);
      qc.invalidateQueries({ queryKey: ["portfolio-latest"] });
      qc.invalidateQueries({ queryKey: ["positions-open"] });
    },
    onError: (e: any) => toast.error(`${t("portfolio.syncBroker")}: ${e?.message ?? e}`),
    onSettled: () => setBusy(null),
  });

  const refreshPrices = useMutation({
    mutationFn: async () => {
      setBusy("prices");
      const { data, error } = await supabase.functions.invoke("market-data-sync", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`${t("portfolio.refreshPrices")}: ${d?.updated ?? 0}`);
      qc.invalidateQueries({ queryKey: ["positions-open"] });
    },
    onError: (e: any) => toast.error(`${t("portfolio.refreshPrices")}: ${e?.message ?? e}`),
    onSettled: () => setBusy(null),
  });

  return (
    <AppShell>
      <PageHeader
        title={t("portfolio.title")}
        subtitle={t("portfolio.subtitle")}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-4 text-xs text-muted-foreground bg-surface-2 px-3 py-1.5 rounded border border-dashed">
              <span className="font-mono text-[10px] uppercase tracking-widest text-atlantix">SOURCE:</span>
              Yahoo Finance (live quotes)
            </div>
            {snap?.regime ? <RegimePill regime={snap.regime as never} /> : null}
            <Button size="sm" variant="outline" onClick={() => refreshPrices.mutate()} disabled={!!busy}>
              <Activity className={`h-3.5 w-3.5 mr-1.5 ${busy === "prices" ? "animate-pulse" : ""}`} />
              {t("portfolio.refreshPrices")}
            </Button>
            <Button size="sm" onClick={() => syncBroker.mutate()} disabled={!!busy}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${busy === "sync" ? "animate-spin" : ""}`} />
              {t("portfolio.syncBroker")}
            </Button>
          </div>
        }
      />
      <div className="space-y-6 px-8 py-6">
        <div className="grid grid-cols-4 gap-4">
          <Metric label={t("portfolio.totalEquity")} value={snap ? `$${Number(snap.total_equity).toLocaleString()}` : "—"} />
          <Metric label={t("portfolio.cash")} value={snap ? `$${Number(snap.cash).toLocaleString()}` : "—"} />
          <Metric
            label={t("portfolio.dailyPnl")}
            value={snap ? `${Number(snap.daily_pnl) >= 0 ? "+" : ""}$${Number(snap.daily_pnl).toLocaleString()}` : "—"}
            tone={snap && Number(snap.daily_pnl) >= 0 ? "bull" : "bear"}
          />
          <Metric label={t("portfolio.dailyRiskUsed")} value={snap ? `${Number(snap.daily_risk_used_pct).toFixed(2)}%` : "—"} />
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("portfolio.openPositions")}
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-surface font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("portfolio.ticker")}</th>
                <th className="px-4 py-2 text-left">{t("portfolio.side")}</th>
                <th className="px-4 py-2 text-left">{t("portfolio.qty")}</th>
                <th className="px-4 py-2 text-left">{t("portfolio.avg")}</th>
                <th className="px-4 py-2 text-left">{t("portfolio.mark")}</th>
                <th className="px-4 py-2 text-left">{t("portfolio.weight")}</th>
                <th className="px-4 py-2 text-left">{t("portfolio.upnl")}</th>
                <th className="px-4 py-2 text-left">{t("portfolio.slTp")}</th>
              </tr>
            </thead>
            <tbody>
              {positions?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {t("portfolio.noOpenPositions")}
                  </td>
                </tr>
              )}
              {positions?.map((p) => {
                const a = p.assets as { ticker?: string; name?: string } | null;
                const pnl = Number(p.unrealized_pnl ?? 0);
                return (
                  <tr key={p.id} className="border-b hover:bg-surface-2">
                    <td className="px-4 py-2"><span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">{a?.ticker}</span></td>
                    <td className={`px-4 py-2 font-mono text-xs uppercase ${p.side === "long" ? "text-bull" : "text-bear"}`}>{p.side}</td>
                    <td className="px-4 py-2 font-mono">{Number(p.quantity)}</td>
                    <td className="px-4 py-2 font-mono">${Number(p.avg_price).toFixed(2)}</td>
                    <td className="px-4 py-2 font-mono">{p.current_price ? `$${Number(p.current_price).toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-2 font-mono">{p.weight_pct ? `${Number(p.weight_pct).toFixed(2)}%` : "—"}</td>
                    <td className={`px-4 py-2 font-mono ${pnl >= 0 ? "text-bull" : "text-bear"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {p.stop_loss ? `$${Number(p.stop_loss).toFixed(2)}` : "—"} / {p.take_profit ? `$${Number(p.take_profit).toFixed(2)}` : "—"}
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div className="panel p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""}`}>{value}</div>
    </div>
  );
}
