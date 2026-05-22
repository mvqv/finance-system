import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/news")({ component: NewsPage });

function NewsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [minImp, setMinImp] = useState(0);
  const [filterTicker, setFilterTicker] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["events-news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*, assets(ticker)")
        .order("occurred_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const ingest = useMutation({
    mutationFn: async () => {
      setBusy(true);
      const body = filterTicker.trim()
        ? { tickers: filterTicker.trim().toUpperCase().split(/[\s,]+/) }
        : {};
      const { data, error } = await supabase.functions.invoke("ingest-news", { body });
      if (error) throw error;
      return data as { ingested: number; tickers: string[] };
    },
    onSuccess: (d) => {
      toast.success(t("news.ingestedToast", { n: d.ingested }));
      qc.invalidateQueries({ queryKey: ["events-news"] });
    },
    onError: (e: any) => toast.error(`${t("news.ingestFailed")}: ${e?.message ?? e}`),
    onSettled: () => setBusy(false),
  });

  const filtered = (data ?? []).filter((e: any) => {
    if (e.importance < minImp) return false;
    if (filterTicker.trim()) {
      const tk = (e.assets?.ticker || "").toUpperCase();
      if (!tk.includes(filterTicker.trim().toUpperCase())) return false;
    }
    return true;
  });

  return (
    <AppShell>
      <PageHeader
        title={t("news.title")}
        subtitle={t("news.subtitle")}
        actions={
          <Button size="sm" onClick={() => ingest.mutate()} disabled={busy}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {busy ? t("news.ingesting") : t("news.ingest")}
          </Button>
        }
      />
      <div className="px-8 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder={t("news.filterTickers")}
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("news.minImportance")}
            <Input
              type="number"
              min={0}
              max={100}
              value={minImp}
              onChange={(e) => setMinImp(Number(e.target.value) || 0)}
              className="w-20"
            />
          </div>
          <div className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {filtered.length} / {data?.length ?? 0}
          </div>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="panel p-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {t("news.noEventsBefore")} <span className="text-atlantix">{t("news.ingest")}</span> {t("news.noEventsAfter")}
            </div>
          )}
          {filtered.map((e: any) => {
            const a = e.assets as { ticker?: string } | null;
            const sent = e.sentiment !== null && e.sentiment !== undefined ? Number(e.sentiment) : null;
            return (
              <div key={e.id} className="panel flex items-start gap-4 p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-32 shrink-0">
                  {new Date(e.occurred_at).toLocaleString()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {a?.ticker && <span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">{a.ticker}</span>}
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{e.event_type}</span>
                    {e.source && <span className="font-mono text-[10px] text-muted-foreground">· {e.source}</span>}
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-atlantix">{t("news.imp")} {e.importance}</span>
                  </div>
                  <div className="mt-1 font-medium">{e.headline}</div>
                  {e.summary && <div className="mt-1 text-sm text-muted-foreground">{e.summary}</div>}
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer"
                       className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-atlantix hover:underline">
                      {t("news.open")} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {sent !== null && (
                  <div className={`font-mono text-xs ${sent > 0 ? "text-bull" : sent < 0 ? "text-bear" : "text-muted-foreground"}`}>
                    {sent > 0 ? "+" : ""}{sent.toFixed(2)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
