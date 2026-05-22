import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { useModeGuard, useTerminalMode } from "@/components/atlantix/TerminalMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Send, X, ShieldCheck } from "lucide-react";
import { useShariahMode } from "@/hooks/useShariahMode";

export const Route = createFileRoute("/execution")({ component: ExecutionPage });

const flag = (c?: string | null) => (c === "TR" ? "🇹🇷" : c === "US" ? "🇺🇸" : "🌐");

function ExecutionPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [marketFilter, setMarketFilter] = useState<"all" | "US" | "BIST">("all");
  const { allowed: canSend, currentMode } = useModeGuard(["execution"]);
  const { setMode } = useTerminalMode();

  const { data: ordersRaw } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, assets(ticker, country), ideas(title)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const orders = (ordersRaw ?? []).filter((o: any) => {
    if (marketFilter === "all") return true;
    const c = (o.assets as { country?: string } | null)?.country ?? "US";
    return marketFilter === "BIST" ? c === "TR" : c !== "TR";
  });

  const hasBistPending = (ordersRaw ?? []).some(
    (o: any) => (o.assets as any)?.country === "TR" &&
      (o.status === "pending_approval" || o.status === "approved"),
  );

  const submit = useMutation({
    mutationFn: async (orderId: string) => {
      if (!canSend) throw new Error(`Order submission blocked — terminal mode is "${currentMode}", switch to EXE first.`);
      const { data, error } = await supabase.functions.invoke("broker-place-order", {
        body: { order_id: orderId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`${t("execution.submitted")} (${d?.broker_order_id?.slice(0, 8) ?? "?"})`);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: any) => toast.error(`${t("execution.submitFailed")}: ${e?.message ?? e}`),
  });

  const cancel = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders").update({ status: "cancelled" }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("execution.cancelled"));
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return (
    <AppShell>
      <PageHeader
        title={t("execution.title")}
        subtitle={t("execution.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded border border-border bg-surface-2 p-0.5 font-mono text-[10px] uppercase tracking-widest">
              {(["all","US","BIST"] as const).map((m) => (
                <button key={m}
                  onClick={() => setMarketFilter(m)}
                  className={`px-2 py-1 rounded ${marketFilter === m ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {m === "all" ? "All" : m === "US" ? "🇺🇸 US" : "🇹🇷 BIST"}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />{t("execution.newOrder")}
            </Button>
          </div>
        }
      />
      <div className="px-8 py-6 space-y-4">
        {hasBistPending && (
          <div className="rounded-md border border-warning/40 bg-warning/5 px-4 py-3">
            <div className="font-mono uppercase tracking-widest text-warning text-[10px] mb-1">🇹🇷 BIST paper-mode</div>
            <div className="text-xs text-muted-foreground">
              No live broker connected for Borsa İstanbul (THYAO/GARAN/etc). BIST orders execute as paper-trades only —
              connect Midas / İş Yatırım API in <span className="font-mono">Settings → Brokers</span> to enable live routing.
            </div>
          </div>
        )}
        {!canSend && (
          <div className="rounded-md border border-warning/40 bg-warning/5 px-4 py-3 flex items-center justify-between gap-4">
            <div className="text-xs">
              <div className="font-mono uppercase tracking-widest text-warning text-[10px] mb-1">Mode lock active</div>
              <div className="text-muted-foreground">
                Order submission is disabled outside <span className="font-mono uppercase text-foreground">EXE</span>.
                Current mode: <span className="font-mono uppercase text-foreground">{currentMode}</span>.
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setMode("execution", "manual override from execution page")}>
              Switch to EXE
            </Button>
          </div>
        )}
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-surface-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("execution.time")}</th>
                <th className="px-4 py-2 text-left">{t("execution.ticker")}</th>
                <th className="px-4 py-2 text-left">{t("execution.idea")}</th>
                <th className="px-4 py-2 text-left">{t("execution.side")}</th>
                <th className="px-4 py-2 text-left">{t("execution.type")}</th>
                <th className="px-4 py-2 text-left">{t("execution.qty")}</th>
                <th className="px-4 py-2 text-left">{t("execution.limit")}</th>
                <th className="px-4 py-2 text-left">{t("execution.status")}</th>
                <th className="px-4 py-2 text-left">{t("execution.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {orders?.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("execution.noOrders")}</td></tr>
              )}
              {orders?.map((o: any) => {
                const a = o.assets as { ticker?: string; country?: string } | null;
                const i = o.ideas as { title?: string } | null;
                const pending = o.status === "pending_approval" || o.status === "approved";
                return (
                  <tr key={o.id} className="border-b hover:bg-surface-2">
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">
                        <span className="mr-1">{flag(a?.country)}</span>{a?.ticker}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{i?.title ?? "—"}</td>
                    <td className={`px-4 py-2 font-mono text-xs uppercase ${o.side === "long" ? "text-bull" : "text-bear"}`}>{o.side}</td>
                    <td className="px-4 py-2 font-mono text-xs uppercase">{o.order_type}</td>
                    <td className="px-4 py-2 font-mono">{Number(o.quantity)}</td>
                    <td className="px-4 py-2 font-mono">{o.limit_price ? `$${Number(o.limit_price).toFixed(2)}` : "MKT"}</td>
                    <td className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{o.status.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2">
                      {pending && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 px-2"
                            disabled={submit.isPending || !canSend}
                            title={!canSend ? `Blocked: terminal mode is "${currentMode}", switch to EXE` : undefined}
                            onClick={() => submit.mutate(o.id)}>
                            <Send className="h-3 w-3 mr-1" />{t("execution.send")}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2"
                            onClick={() => cancel.mutate(o.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {o.error_message && <span className="font-mono text-[10px] text-bear">{o.error_message.slice(0, 40)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <NewOrderDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["orders"] })} />
    </AppShell>
  );
}

function NewOrderDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const { isShariahModeEnabled } = useShariahMode();
  const [ticker, setTicker] = useState("");
  const [side, setSide] = useState<"long" | "short">("long");
  const [type, setType] = useState<"market" | "limit">("limit");
  const [qty, setQty] = useState("1");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!ticker.trim()) return toast.error(t("execution.tickerRequired"));
    setBusy(true);
    try {
      const T = ticker.trim().toUpperCase();
      let { data: asset } = await supabase.from("assets").select("id").eq("ticker", T).maybeSingle();
      if (!asset) {
        const ins = await supabase.from("assets").insert({
          ticker: T, name: T, asset_class: "equity", currency: "USD",
        }).select("id").single();
        if (ins.error) throw ins.error;
        asset = ins.data!;
      }
      const { error } = await supabase.from("orders").insert({
        asset_id: asset.id,
        side,
        order_type: type,
        quantity: Number(qty),
        limit_price: type === "limit" ? Number(limit) : null,
        status: "pending_approval",
      });
      if (error) throw error;
      toast.success(t("execution.orderCreated"));
      onCreated();
      onOpenChange(false);
      setTicker(""); setQty("1"); setLimit("");
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("execution.newOrder")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>{t("execution.ticker")}</Label><Input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("execution.side")}</Label>
              <Select value={side} onValueChange={(v) => setSide(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">{t("execution.longBuy")}</SelectItem>
                  <SelectItem value="short" disabled={isShariahModeEnabled}>
                    {t("execution.shortSell")}
                    {isShariahModeEnabled && (
                      <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-amber-500">
                        <ShieldCheck className="h-3 w-3" />Shariah
                      </span>
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
              {isShariahModeEnabled && (
                <p className="mt-1 font-mono text-[10px] text-amber-500">
                  Short selling disabled in Strict Shariah Mode
                </p>
              )}
            </div>
            <div>
              <Label>{t("execution.type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="market">{t("execution.market")}</SelectItem>
                  <SelectItem value="limit">{t("execution.limitOpt")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t("execution.quantity")}</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            {type === "limit" && (
              <div><Label>{t("execution.limitPrice")}</Label><Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("execution.cancel")}</Button>
          <Button onClick={onCreate} disabled={busy}>{t("execution.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
