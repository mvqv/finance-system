import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { ScoreBar } from "@/components/atlantix/ScoreBar";
import { STATUS_LABEL } from "@/lib/atlantix";
import { NewIdeaDialog } from "@/components/atlantix/NewIdeaDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { useShariahMode } from "@/hooks/useShariahMode";

export const Route = createFileRoute("/opportunities")({ component: OpportunitiesPage });

function OpportunitiesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [runningId, setRunningId] = useState<string | null>(null);
  const { isShariahModeEnabled } = useShariahMode();

  async function runCommittee(ideaId: string) {
    setRunningId(ideaId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const owner_id = user?.id ?? undefined;
      const { error } = await supabase.functions.invoke("run-committee", {
        body: { idea_id: ideaId, isShariahModeEnabled, owner_id },
      });
      if (error) throw error;
      toast.success(t("opportunities.committeeDispatched"));
      qc.invalidateQueries({ queryKey: ["all-ideas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("opportunities.failed"));
    } finally { setRunningId(null); }
  }

  const { data } = useQuery({
    queryKey: ["all-ideas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ideas")
        .select("id,title,side,status,edge_score,risk_score,consensus_score,timing_score,liquidity_score,asymmetry,assets(ticker,asset_class)")
        .order("edge_score", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  return (
    <AppShell>
      <PageHeader title={t("opportunities.title")} subtitle={t("opportunities.subtitle")} actions={<NewIdeaDialog />} />
      <div className="px-8 py-6">
        <div className="mb-4 grid gap-3 border-y bg-surface-2/30 px-4 py-3 text-sm md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-atlantix">{t("opportunities.workflowLabel")}</div>
            <p className="mt-1 text-muted-foreground">{t("opportunities.workflowBody")}</p>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("opportunities.metricsLabel")}</div>
            <p className="mt-1 text-muted-foreground">{t("opportunities.metricsBody")}</p>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("opportunities.nextLabel")}</div>
            <p className="mt-1 text-muted-foreground">{t("opportunities.nextBody")}</p>
          </div>
        </div>
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-surface-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">{t("opportunities.ticker")}</th>
                <th className="px-4 py-3 text-left">{t("opportunities.class")}</th>
                <th className="px-4 py-3 text-left">{t("opportunities.idea")}</th>
                <th className="px-4 py-3 text-left">{t("opportunities.side")}</th>
                <th className="px-4 py-3 text-left">{t("opportunities.status")}</th>
                <th className="px-4 py-3 text-left">{t("opportunities.edge")}</th>
                <th className="px-4 py-3 text-left">{t("opportunities.risk")}</th>
                <th className="px-4 py-3 text-left">{t("opportunities.consensus")}</th>
                <th className="px-4 py-3 text-left">{t("opportunities.rr")}</th>
                <th className="px-4 py-3 text-left">{t("opportunities.action")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((i) => {
                const a = i.assets as { ticker?: string; asset_class?: string } | null;
                return (
                  <tr key={i.id} className="border-b transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3"><span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">{a?.ticker ?? "—"}</span></td>
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">{a?.asset_class}</td>
                    <td className="px-4 py-3">
                      <Link to="/debate" search={{ id: i.id }} className="hover:text-atlantix">{i.title}</Link>
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs uppercase tracking-widest ${i.side === "long" ? "text-bull" : "text-bear"}`}>{i.side}</td>
                    <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{STATUS_LABEL[i.status as string] ?? i.status}</td>
                    <td className="w-28 px-4 py-3"><ScoreBar value={i.edge_score} label="" tone="edge" /></td>
                    <td className="w-28 px-4 py-3"><ScoreBar value={i.risk_score} label="" tone="risk" /></td>
                    <td className="w-28 px-4 py-3"><ScoreBar value={i.consensus_score} label="" tone="atlantix" /></td>
                    <td className="px-4 py-3 font-mono text-sm">{i.asymmetry ? `${i.asymmetry}R` : "—"}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" disabled={runningId === i.id} onClick={() => runCommittee(i.id)}>
                        <Play className="mr-1 h-3 w-3" />{runningId === i.id ? t("opportunities.running") : t("opportunities.run")}
                      </Button>
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
