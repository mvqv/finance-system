import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { Button } from "@/components/ui/button";
import { Activity, Database, Newspaper, LineChart, Brain, Zap, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/health")({ component: HealthPage });

const COMPONENTS: Array<{ key: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "market_data_sync", icon: LineChart },
  { key: "ingest_news", icon: Newspaper },
  { key: "macro_snapshot", icon: Activity },
  { key: "broker_sync", icon: Zap },
  { key: "feature_snapshot", icon: Brain },
  { key: "database", icon: Database },
];

function normalizeHealthComponent(component: unknown): string | null {
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

function HealthPage() {
  const { t } = useTranslation();

  const STATUS_TONE: Record<string, { color: string; label: string }> = {
    green: { color: "hsl(var(--bull))", label: t("health.online") },
    yellow: { color: "hsl(var(--warning))", label: t("health.degraded") },
    red: { color: "hsl(var(--bear))", label: t("health.offline") },
    black: { color: "hsl(var(--bear))", label: t("health.fault") },
  };

  const { data: logs, refetch, isFetching } = useQuery({
    queryKey: ["health-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_health_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const latest = useMemo(() => {
    const map: Record<string, NonNullable<typeof logs>[number]> = {};
    for (const l of logs ?? []) {
      const key = normalizeHealthComponent(l.component) ?? l.component;
      if (!map[key]) map[key] = l;
    }
    return map;
  }, [logs]);

  const runCheck = async () => {
    await supabase.functions.invoke("system-health-check");
    refetch();
  };

  return (
    <AppShell>
      <PageHeader
        title={t("health.title")}
        subtitle={t("health.subtitle")}
        actions={
          <Button size="sm" variant="outline" onClick={runCheck} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> {t("health.runCheck")}
          </Button>
        }
      />
      <div className="space-y-6 px-8 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {COMPONENTS.map(({ key, icon: Icon }) => {
            const l = latest[key];
            const tone = STATUS_TONE[l?.status as string] ?? { color: "hsl(var(--muted-foreground))", label: t("health.unknown") };
            const label = t(`health.components.${key}`);
            return (
              <div key={key} className="panel p-4" style={{ borderTop: `2px solid ${tone.color}` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="font-display text-sm">{label}</div>
                  </div>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest" style={{ color: tone.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone.color, boxShadow: `0 0 6px ${tone.color}` }} />
                    {tone.label}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                  {l?.message === "no key" || l?.message === "no keys" 
                    ? t("health.missingKey") 
                    : l?.message ?? t("health.noDataYet")}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {l ? new Date(l.created_at).toLocaleTimeString() : "—"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b bg-surface-2 px-4 py-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("health.liveLog")}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-bull">{t("health.autoRefresh")}</div>
          </div>
          <div className="max-h-[480px] overflow-auto bg-surface p-3 font-mono text-xs">
            {(logs ?? []).length === 0 && (
              <div className="text-center text-muted-foreground">{t("health.noLog")}</div>
            )}
            {(logs ?? []).map((l) => {
              const tone = STATUS_TONE[l.status as string] ?? { color: "hsl(var(--muted-foreground))", label: l.status };
              return (
                <div key={l.id} className="flex gap-3 border-b border-border/40 py-1.5">
                  <span className="shrink-0 text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()}</span>
                  <span className="shrink-0 uppercase tracking-widest" style={{ color: tone.color }}>● {l.status}</span>
                  <span className="shrink-0 text-atlantix">{l.component}</span>
                  <span className="truncate text-muted-foreground">{l.message ?? ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
