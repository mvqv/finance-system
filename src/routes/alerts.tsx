import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { Bell, AlertOctagon, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/alerts")({ component: AlertsInbox });

type AlertRow = {
  id: string;
  severity: string;
  category: string;
  source: string | null;
  title: string;
  body: string | null;
  ticker: string | null;
  idea_id: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

const MOCK_ALERTS: AlertRow[] = [
  { id: "a1", severity: "critical", category: "risk", source: "Risk Engine", title: "Daily loss limit 80% consumed", body: "Portfolio is within 0.4% of triggering the daily kill-switch threshold.", ticker: null, idea_id: null, read_at: null, dismissed_at: null, created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: "a2", severity: "warning", category: "event", source: "News Agent", title: "XOM scope-3 EU hearing scheduled", body: "Regulatory hearing on day 22 may invalidate current LONG thesis.", ticker: "XOM", idea_id: null, read_at: null, dismissed_at: null, created_at: new Date(Date.now() - 1000 * 60 * 22).toISOString() },
  { id: "a3", severity: "info", category: "execution", source: "Execution Agent", title: "Order filled: NVDA +120 @ 487.20", body: "Limit order completed in 3 child fills, avg slippage 4bps.", ticker: "NVDA", idea_id: null, read_at: null, dismissed_at: null, created_at: new Date(Date.now() - 1000 * 60 * 47).toISOString() },
  { id: "a4", severity: "warning", category: "operations", source: "Operations Agent", title: "Position reconciliation drift", body: "AAPL: internal 500 vs broker 498. Delta 2 shares (~$340). Investigating.", ticker: "AAPL", idea_id: null, read_at: null, dismissed_at: null, created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
  { id: "a5", severity: "critical", category: "system", source: "Health Monitor", title: "Options data feed lagging", body: "CBOE OPRA feed has 18s latency vs 1s SLO. Auto-failover engaged.", ticker: null, idea_id: null, read_at: null, dismissed_at: null, created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
  { id: "a6", severity: "info", category: "memory", source: "Memory Agent", title: "Analog match: 14 setups like current TLT", body: "Median +3.1% / 90d, hit rate 64%. Logged to Research Library.", ticker: "TLT", idea_id: null, read_at: null, dismissed_at: new Date().toISOString(), created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
];

const SEV_STYLE: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  critical: { icon: AlertOctagon, color: "hsl(var(--bear))", bg: "hsl(var(--bear) / 0.08)" },
  warning: { icon: AlertTriangle, color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.08)" },
  info: { icon: Info, color: "hsl(var(--atlantix))", bg: "hsl(var(--atlantix) / 0.08)" },
  success: { icon: CheckCircle2, color: "hsl(var(--bull))", bg: "hsl(var(--bull) / 0.08)" },
};

function fmtAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function AlertsInbox() {
  const { data, refetch } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = (data ?? []) as unknown as AlertRow[];
      return rows.length ? rows : MOCK_ALERTS;
    },
  });

  const alerts = data ?? MOCK_ALERTS;
  const active = alerts.filter((a) => !a.dismissed_at);
  const dismissed = alerts.filter((a) => a.dismissed_at);

  async function dismiss(id: string) {
    const client = supabase as unknown as { from: (t: string) => { update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } };
    const { error } = await client.from("alerts").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Dismissed"); refetch(); }
  }

  async function markRead(id: string) {
    const client = supabase as unknown as { from: (t: string) => { update: (v: unknown) => { eq: (k: string, v: string) => Promise<unknown> } } };
    await client.from("alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
    refetch();
  }

  return (
    <AppShell>
      <PageHeader
        title="Alert Inbox"
        subtitle={`${active.length} active · ${dismissed.length} archived`}
      />
      <div className="px-8 py-6 space-y-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-atlantix" strokeWidth={1.5} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-atlantix">Active</span>
          </div>
          <div className="space-y-2">
            {active.map((a) => {
              const sty = SEV_STYLE[a.severity] ?? SEV_STYLE.info;
              const Icon = sty.icon;
              return (
                <div
                  key={a.id}
                  className="rounded-md border p-4 transition-colors"
                  style={{ borderLeft: `3px solid ${sty.color}`, backgroundColor: a.read_at ? undefined : sty.bg }}
                  onMouseEnter={() => !a.read_at && markRead(a.id)}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.6} style={{ color: sty.color }} />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-semibold">{a.title}</span>
                        {a.ticker && <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px]">{a.ticker}</span>}
                        <span className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: sty.color, border: `1px solid ${sty.color}` }}>
                          {a.severity}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{a.category}</span>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{fmtAgo(a.created_at)}</span>
                      </div>
                      {a.body && <p className="mt-1 text-sm text-foreground/80">{a.body}</p>}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{a.source}</span>
                        <Button size="sm" variant="ghost" onClick={() => dismiss(a.id)}>Dismiss</Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {active.length === 0 && (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">All clear — no active alerts.</div>
            )}
          </div>
        </section>

        {dismissed.length > 0 && (
          <section>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Archived</div>
            <div className="space-y-1">
              {dismissed.map((a) => (
                <div key={a.id} className="rounded-md border bg-surface-2 px-4 py-2 text-sm text-muted-foreground">
                  <span className="mr-2 font-mono text-[10px] uppercase tracking-widest">{a.severity}</span>
                  {a.title}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
