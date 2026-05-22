import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Clock, ExternalLink, Play, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/operations")({ component: OperationsConsole });

// ── helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ORDER_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pending_approval: { color: "oklch(0.78 0.15 75)",  bg: "oklch(0.78 0.15 75 / 0.12)",  label: "Pending" },
  approved:         { color: "oklch(0.70 0.18 145)", bg: "oklch(0.70 0.18 145 / 0.12)", label: "Approved" },
  submitted:        { color: "oklch(0.65 0.18 280)", bg: "oklch(0.65 0.18 280 / 0.12)", label: "Submitted" },
  filled:           { color: "oklch(0.70 0.18 145)", bg: "oklch(0.70 0.18 145 / 0.12)", label: "Filled" },
  rejected:         { color: "oklch(0.62 0.20 25)",  bg: "oklch(0.62 0.20 25 / 0.12)",  label: "Rejected" },
  cancelled:        { color: "oklch(0.65 0.18 280 / 0.5)", bg: "oklch(0.65 0.18 280 / 0.08)", label: "Cancelled" },
};

const RECON_STATUS_STYLE: Record<string, { color: string; label: string }> = {
  ok:          { color: "oklch(0.70 0.18 145)", label: "OK" },
  mismatch:    { color: "oklch(0.62 0.20 25)",  label: "Mismatch" },
  price_drift: { color: "oklch(0.78 0.15 75)",  label: "Price Drift" },
  pending:     { color: "oklch(0.65 0.18 280)", label: "Pending" },
};

// ── main ──────────────────────────────────────────────────────────────────────
function OperationsConsole() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [syncBusy, setSyncBusy] = useState(false);
  const [reconBusy, setReconBusy] = useState(false);
  const [stopBusy, setStopBusy] = useState(false);

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: orders } = useQuery({
    queryKey: ["ops-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, assets:asset_id(ticker, name)")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const { data: recon } = useQuery({
    queryKey: ["ops-recon"],
    queryFn: async () => {
      const { data } = await supabase
        .from("position_reconciliation")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { data: auditLog } = useQuery({
    queryKey: ["ops-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 20_000,
  });

  const { data: alerts } = useQuery({
    queryKey: ["ops-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const { data: healthLogs } = useQuery({
    queryKey: ["ops-health"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_health_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  // ── derived ───────────────────────────────────────────────────────────────
  const pendingOrders  = (orders ?? []).filter((o) => o.status === "pending_approval" || o.status === "approved");
  const recentOrders   = (orders ?? []).filter((o) => !["pending_approval", "approved"].includes(o.status)).slice(0, 10);
  const mismatches     = (recon ?? []).filter((r) => r.status !== "ok");
  const criticalAlerts = (alerts ?? []).filter((a) => a.severity === "critical");

  // ── actions ───────────────────────────────────────────────────────────────
  async function syncBroker() {
    setSyncBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("broker-sync-portfolio", { body: {} });
      if (error) throw error;
      toast.success(`Synced — equity $${Number((data as any)?.equity ?? 0).toLocaleString()}, ${(data as any)?.positions ?? 0} positions`);
      qc.invalidateQueries({ queryKey: ["ops-orders"] });
      qc.invalidateQueries({ queryKey: ["ops-recon"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally { setSyncBusy(false); }
  }

  async function runStopWatcher() {
    setStopBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("stop-loss-watcher", { body: {} });
      if (error) throw error;
      const d = data as any;
      toast.success(`Stop watcher — checked ${d?.checked ?? 0}, closed ${d?.closed ?? 0}`);
      qc.invalidateQueries({ queryKey: ["ops-orders"] });
      qc.invalidateQueries({ queryKey: ["ops-alerts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stop watcher failed");
    } finally { setStopBusy(false); }
  }

  async function submitOrder(orderId: string) {
    try {
      const { error } = await supabase.functions.invoke("broker-place-order", { body: { order_id: orderId } });
      if (error) throw error;
      toast.success("Order submitted to Alpaca");
      qc.invalidateQueries({ queryKey: ["ops-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  }

  async function dismissAlert(id: string) {
    await supabase.from("alerts").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["ops-alerts"] });
  }

  async function runRecon() {
    setReconBusy(true);
    try {
      const { error } = await supabase.functions.invoke("broker-sync-portfolio", { body: {} });
      if (error) throw error;
      toast.success("Reconciliation complete");
      qc.invalidateQueries({ queryKey: ["ops-recon"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reconciliation failed");
    } finally { setReconBusy(false); }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <PageHeader
        title="Operations Console"
        subtitle="Alpaca Paper · orders, reconciliation, stop-loss watcher, audit log"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={runStopWatcher} disabled={stopBusy}>
              <ShieldCheck className={`mr-1.5 h-3.5 w-3.5 ${stopBusy ? "animate-pulse" : ""}`} />
              Run Stop Watcher
            </Button>
            <Button size="sm" onClick={syncBroker} disabled={syncBusy}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncBusy ? "animate-spin" : ""}`} />
              Sync Alpaca
            </Button>
          </div>
        }
      />

      <div className="space-y-6 px-8 py-6">

        {/* ── Top stats ── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Pending Orders"
            value={String(pendingOrders.length)}
            tone={pendingOrders.length > 0 ? "warn" : "ok"}
          />
          <StatCard
            label="Recon Mismatches"
            value={String(mismatches.length)}
            tone={mismatches.length > 0 ? "danger" : "ok"}
          />
          <StatCard
            label="Active Alerts"
            value={String(criticalAlerts.length)}
            tone={criticalAlerts.length > 0 ? "danger" : "ok"}
          />
          <StatCard
            label="Last Sync"
            value={healthLogs?.[0] ? timeAgo(healthLogs[0].created_at) : "—"}
            tone="ok"
          />
        </div>

        {/* ── Critical alerts ── */}
        {criticalAlerts.length > 0 && (
          <div className="rounded-xl border border-bear/40 bg-bear/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-bear" strokeWidth={1.6} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-bear">
                Critical Alerts ({criticalAlerts.length})
              </span>
            </div>
            <div className="space-y-2">
              {criticalAlerts.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-bear/20 bg-background px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{a.title}</div>
                    {a.body && <div className="mt-0.5 text-xs text-muted-foreground">{a.body}</div>}
                    <div className="mt-1 font-mono text-[9px] text-muted-foreground">{timeAgo(a.created_at)}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-[10px]"
                    onClick={() => dismissAlert(a.id)}>
                    Dismiss
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Pending orders ── */}
        {pendingOrders.length > 0 && (
          <div className="panel overflow-hidden">
            <div className="border-b bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-warning">
              ⚡ Pending Orders — Action Required
            </div>
            <table className="w-full text-sm">
              <thead className="border-b font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Ticker</th>
                  <th className="px-4 py-2 text-left">Side</th>
                  <th className="px-4 py-2 text-left">Qty</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Limit</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Created</th>
                  <th className="px-4 py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((o) => {
                  const asset = o.assets as { ticker?: string } | null;
                  const s = ORDER_STATUS_STYLE[o.status] ?? ORDER_STATUS_STYLE.pending_approval;
                  return (
                    <tr key={o.id} className="border-b hover:bg-surface-2">
                      <td className="px-4 py-2">
                        <span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">{asset?.ticker ?? "—"}</span>
                      </td>
                      <td className={`px-4 py-2 font-mono text-xs uppercase ${o.side === "long" ? "text-bull" : "text-bear"}`}>{o.side}</td>
                      <td className="px-4 py-2 font-mono text-xs">{o.quantity}</td>
                      <td className="px-4 py-2 font-mono text-xs uppercase">{o.order_type}</td>
                      <td className="px-4 py-2 font-mono text-xs">{o.limit_price ? `$${Number(o.limit_price).toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-2">
                        <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                          style={{ color: s.color, borderColor: s.color, backgroundColor: s.bg }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{timeAgo(o.created_at)}</td>
                      <td className="px-4 py-2">
                        {o.status === "approved" && (
                          <Button size="sm" className="h-6 gap-1 px-2 text-[10px] bg-bull hover:opacity-90"
                            onClick={() => submitOrder(o.id)}>
                            <Play className="h-3 w-3" /> Submit
                          </Button>
                        )}
                        {o.idea_id && (
                          <Button size="sm" variant="ghost" className="ml-1 h-6 px-2 text-[10px]"
                            onClick={() => nav({ to: "/debate", search: { id: o.idea_id! } })}>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Position reconciliation ── */}
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b bg-surface-2 px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Position Reconciliation (Internal vs Alpaca)
            </span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
              onClick={runRecon} disabled={reconBusy}>
              <RefreshCw className={`mr-1 h-3 w-3 ${reconBusy ? "animate-spin" : ""}`} /> Reconcile
            </Button>
          </div>
          {(recon ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No reconciliation data — click Sync Alpaca to populate
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Ticker</th>
                  <th className="px-4 py-2 text-left">Internal Qty</th>
                  <th className="px-4 py-2 text-left">Broker Qty</th>
                  <th className="px-4 py-2 text-left">Δ Qty</th>
                  <th className="px-4 py-2 text-left">Δ Value</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(recon ?? []).map((r) => {
                  const s = RECON_STATUS_STYLE[r.status] ?? RECON_STATUS_STYLE.pending;
                  const hasDelta = r.delta_quantity !== 0 || (r.delta_value && Math.abs(Number(r.delta_value)) > 0.01);
                  return (
                    <tr key={r.id} className="border-b hover:bg-surface-2">
                      <td className="px-4 py-2 font-mono font-semibold">{r.ticker}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.internal_quantity ?? "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.broker_quantity ?? "—"}</td>
                      <td className={`px-4 py-2 font-mono text-xs ${hasDelta ? "text-bear font-semibold" : "text-muted-foreground"}`}>
                        {r.delta_quantity ?? 0}
                      </td>
                      <td className={`px-4 py-2 font-mono text-xs ${hasDelta ? "text-bear" : "text-muted-foreground"}`}>
                        {r.delta_value ? `$${Number(r.delta_value).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                          style={{ color: s.color, borderColor: s.color }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Recent order history ── */}
        <div className="panel overflow-hidden">
          <div className="border-b bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Order History
          </div>
          {recentOrders.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">No submitted orders yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Ticker</th>
                  <th className="px-4 py-2 text-left">Side</th>
                  <th className="px-4 py-2 text-left">Qty</th>
                  <th className="px-4 py-2 text-left">Filled @ </th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Broker ID</th>
                  <th className="px-4 py-2 text-left">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => {
                  const asset = o.assets as { ticker?: string } | null;
                  const s = ORDER_STATUS_STYLE[o.status] ?? ORDER_STATUS_STYLE.pending_approval;
                  return (
                    <tr key={o.id} className="border-b hover:bg-surface-2">
                      <td className="px-4 py-2">
                        <span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">{asset?.ticker ?? "—"}</span>
                      </td>
                      <td className={`px-4 py-2 font-mono text-xs uppercase ${o.side === "long" ? "text-bull" : "text-bear"}`}>{o.side}</td>
                      <td className="px-4 py-2 font-mono text-xs">{o.quantity}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {o.filled_price ? `$${Number(o.filled_price).toFixed(2)}` : "—"}
                        {o.filled_quantity && o.filled_quantity !== o.quantity
                          ? <span className="ml-1 text-warning">({o.filled_quantity} filled)</span>
                          : null}
                      </td>
                      <td className="px-4 py-2">
                        <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                          style={{ color: s.color, borderColor: s.color, backgroundColor: s.bg }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {o.broker_order_id ?? "—"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {o.submitted_at ? timeAgo(o.submitted_at) : timeAgo(o.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Audit log ── */}
        <div className="panel overflow-hidden">
          <div className="border-b bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Audit Log
          </div>
          <div className="max-h-72 overflow-auto bg-surface p-3 font-mono text-xs">
            {(auditLog ?? []).length === 0 ? (
              <div className="text-center text-muted-foreground">No audit events yet</div>
            ) : (
              (auditLog ?? []).map((l) => {
                const isDestructive = l.action.includes("kill_switch") || l.action.includes("rejected") || l.action.includes("auto_closed");
                const isPositive = l.action.includes("approved") || l.action.includes("submitted") || l.action.includes("filled");
                return (
                  <div key={l.id} className="flex gap-3 border-b border-border/30 py-1.5">
                    <span className="shrink-0 text-muted-foreground">{timeAgo(l.created_at)}</span>
                    <span className={`shrink-0 ${isDestructive ? "text-bear" : isPositive ? "text-bull" : "text-atlantix"}`}>
                      {isDestructive ? "✕" : isPositive ? "✓" : "·"}
                    </span>
                    <span className={`shrink-0 font-semibold ${isDestructive ? "text-bear" : isPositive ? "text-bull" : "text-foreground"}`}>
                      {l.action}
                    </span>
                    {l.target_type && (
                      <span className="text-muted-foreground">{l.target_type}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "danger" }) {
  const color = tone === "ok" ? "oklch(0.70 0.18 145)" : tone === "warn" ? "oklch(0.78 0.15 75)" : "oklch(0.62 0.20 25)";
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? Clock : XCircle;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4" style={{ color }} strokeWidth={1.6} />
      </div>
      <div className="mt-1 font-display text-3xl font-bold" style={{ color: value !== "0" && tone !== "ok" ? color : undefined }}>
        {value}
      </div>
    </div>
  );
}
