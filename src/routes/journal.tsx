import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentBadge } from "@/components/atlantix/AgentBadge";
import { toast } from "sonner";
import { FileText, Loader2, CheckCircle2, XCircle, Plus } from "lucide-react";

export const Route = createFileRoute("/journal")({ component: JournalPage });

type Debate = { agent: string; stance: string | null; argument: string; confidence: number | null };

function evaluateAgent(stance: string | null, side: string | null, pnl: number): "correct" | "wrong" | "neutral" {
  if (!stance) return "neutral";
  const s = stance.toLowerCase();
  const bullish = s === "for" || s === "approve" || s === "bull";
  const bearish = s === "against" || s === "reject" || s === "bear";
  if (!bullish && !bearish) return "neutral";
  const tradeWon = pnl > 0;
  const longSide = side === "long";
  // Trade made money on a long means bullish stance was right.
  const stanceBullishIsRight = (longSide && tradeWon) || (!longSide && !tradeWon);
  if (bullish) return stanceBullishIsRight ? "correct" : "wrong";
  return stanceBullishIsRight ? "wrong" : "correct";
}

function JournalPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [openTrade, setOpenTrade] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["trade-journal"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trade_journal")
        .select("*, assets(ticker), ideas(title)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const ideaIds = (data ?? []).map((t) => t.idea_id).filter((x): x is string => !!x);

  const { data: debatesByIdea } = useQuery({
    queryKey: ["journal-debates", ideaIds],
    enabled: ideaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_debates")
        .select("idea_id, agent, stance, argument, confidence, created_at")
        .in("idea_id", ideaIds)
        .order("created_at", { ascending: true });
      const map: Record<string, Debate[]> = {};
      for (const d of data ?? []) {
        if (!d.idea_id) continue;
        (map[d.idea_id] ??= []).push(d as Debate);
      }
      return map;
    },
  });

  const { data: postmortems } = useQuery({
    queryKey: ["postmortems"],
    queryFn: async () => {
      const { data } = await supabase.from("postmortems").select("*");
      const map: Record<string, NonNullable<typeof data>[number]> = {};
      (data ?? []).forEach((p) => {
        if (p.idea_id) map[p.idea_id] = p;
      });
      return map;
    },
  });

  async function generate(idea_id: string) {
    setPending(idea_id);
    try {
      const { error } = await supabase.functions.invoke("generate-postmortem", {
        body: { idea_id },
      });
      if (error) throw error;
      toast.success(t("journal.postMortemGenerated"));
      qc.invalidateQueries({ queryKey: ["postmortems"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(null);
    }
  }

  const activeTrade = data?.find((t) => t.id === openTrade) ?? null;
  const activeDebates = activeTrade?.idea_id ? debatesByIdea?.[activeTrade.idea_id] ?? [] : [];
  const activePm = activeTrade?.idea_id ? postmortems?.[activeTrade.idea_id] ?? null : null;

  return (
    <AppShell>
      <PageHeader
        title={t("journal.title")}
        subtitle={t("journal.subtitle")}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2 text-xs text-muted-foreground bg-surface-2 px-3 py-1.5 rounded border border-dashed">
              <span className="font-mono text-[10px] uppercase tracking-widest text-atlantix">SOURCE:</span> 
              Supabase / Gemini
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Trade
            </Button>
          </div>
        }
      />
      <div className="space-y-4 px-8 py-6">
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-surface-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("journal.closed")}</th>
                <th className="px-4 py-2 text-left">{t("journal.ticker")}</th>
                <th className="px-4 py-2 text-left">{t("journal.idea")}</th>
                <th className="px-4 py-2 text-left">{t("journal.side")}</th>
                <th className="px-4 py-2 text-left">{t("journal.pnl")}</th>
                <th className="px-4 py-2 text-left">{t("journal.agentAccuracy")}</th>
                <th className="px-4 py-2 text-left">{t("journal.triggerReason")}</th>
                <th className="px-4 py-2 text-left">{t("journal.postMortem")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {t("journal.noClosedTrades")}
                  </td>
                </tr>
              )}
              {data?.map((tr) => {
                const a = tr.assets as { ticker?: string } | null;
                const i = tr.ideas as { title?: string } | null;
                const pnl = Number(tr.pnl ?? 0);
                const pm = tr.idea_id ? postmortems?.[tr.idea_id] : null;
                const debs = tr.idea_id ? debatesByIdea?.[tr.idea_id] ?? [] : [];
                const latest = new Map<string, Debate>();
                for (const d of debs) latest.set(d.agent, d);
                return (
                  <tr key={tr.id} className="border-b hover:bg-surface-2 cursor-pointer" onClick={() => setOpenTrade(tr.id)}>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{tr.closed_at ? new Date(tr.closed_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2"><span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">{a?.ticker}</span></td>
                    <td className="px-4 py-2 text-xs">{i?.title ?? "—"}</td>
                    <td className={`px-4 py-2 font-mono text-xs uppercase ${tr.side === "long" ? "text-bull" : "text-bear"}`}>{tr.side}</td>
                    <td className={`px-4 py-2 font-mono ${pnl >= 0 ? "text-bull" : "text-bear"}`}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {Array.from(latest.values()).slice(0, 6).map((d) => {
                          const verdict = evaluateAgent(d.stance, tr.side, pnl);
                          const color = verdict === "correct" ? "text-bull" : verdict === "wrong" ? "text-bear" : "text-muted-foreground";
                          return (
                            <span key={d.agent} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${color}`}>
                              {verdict === "correct" ? <CheckCircle2 className="h-2.5 w-2.5" /> : verdict === "wrong" ? <XCircle className="h-2.5 w-2.5" /> : null}
                              {d.agent}
                            </span>
                          );
                        })}
                        {latest.size === 0 && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-muted-foreground">{tr.reason_out ?? tr.reason_in ?? "—"}</td>
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      {pm ? (
                        <Button size="sm" variant="outline" onClick={() => setOpenTrade(tr.id)}>
                          <FileText className="mr-1 h-3 w-3" /> {t("journal.score")} {pm.score ?? "—"}
                        </Button>
                      ) : tr.idea_id ? (
                        <Button size="sm" variant="outline" disabled={pending === tr.idea_id} onClick={() => generate(tr.idea_id!)}>
                          {pending === tr.idea_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><FileText className="mr-1 h-3 w-3" /> {t("journal.run")}</>}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!openTrade} onOpenChange={(o) => !o && setOpenTrade(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("journal.dialogTitle")} · {(activeTrade?.assets as { ticker?: string } | null)?.ticker} ·{" "}
              <span className={Number(activeTrade?.pnl ?? 0) >= 0 ? "text-bull" : "text-bear"}>
                {Number(activeTrade?.pnl ?? 0) >= 0 ? "+" : ""}${Number(activeTrade?.pnl ?? 0).toFixed(2)}
              </span>
            </DialogTitle>
          </DialogHeader>
          {activeTrade && (
            <div className="space-y-4 text-sm">
              {activePm && (
                <div className="rounded border bg-surface-2 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("journal.summary")}</div>
                  <div className="mt-1">{activePm.summary}</div>
                  {activePm.what_worked && <div className="mt-2"><span className="font-mono text-[10px] uppercase tracking-widest text-bull">{t("journal.whatWorked")}</span> {activePm.what_worked}</div>}
                  {activePm.what_failed && <div className="mt-1"><span className="font-mono text-[10px] uppercase tracking-widest text-bear">{t("journal.whatFailed")}</span> {activePm.what_failed}</div>}
                  {activePm.lessons && <div className="mt-1"><span className="font-mono text-[10px] uppercase tracking-widest text-warning">{t("journal.lessons")}</span> {activePm.lessons}</div>}
                </div>
              )}
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("journal.originalDebate")}</div>
                <div className="space-y-2">
                  {activeDebates.length === 0 && <div className="text-xs text-muted-foreground">{t("journal.noDebateRecorded")}</div>}
                  {activeDebates.map((d, idx) => {
                    const verdict = evaluateAgent(d.stance, activeTrade.side, Number(activeTrade.pnl ?? 0));
                    const color = verdict === "correct" ? "hsl(var(--bull))" : verdict === "wrong" ? "hsl(var(--bear))" : "hsl(var(--muted-foreground))";
                    return (
                      <div key={idx} className="rounded border bg-surface-2 p-3" style={{ borderLeft: `3px solid ${color}` }}>
                        <div className="flex items-center justify-between">
                          <AgentBadge agent={d.agent} size="sm" />
                          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
                            {d.stance ?? "neutral"} · {verdict}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{d.argument}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AddTradeDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["trade-journal"] });
          setAddOpen(false);
        }}
      />
    </AppShell>
  );
}

// ── Add Trade Dialog ──────────────────────────────────────────────────────────
function AddTradeDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [ticker, setTicker] = useState("");
  const [side, setSide] = useState<"long" | "short">("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [closedAt, setClosedAt] = useState("");
  const [reasonIn, setReasonIn] = useState("");
  const [reasonOut, setReasonOut] = useState("");

  const pnl = (() => {
    const entry = parseFloat(entryPrice);
    const exit  = parseFloat(exitPrice);
    if (!isFinite(entry) || !isFinite(exit)) return null;
    return side === "long" ? exit - entry : entry - exit;
  })();

  async function save() {
    if (!ticker.trim()) return toast.error("Ticker is required");
    if (!entryPrice || !exitPrice) return toast.error("Entry and exit price required");
    setBusy(true);
    try {
      // Find or create asset
      let { data: asset } = await supabase
        .from("assets")
        .select("id")
        .eq("ticker", ticker.toUpperCase().trim())
        .maybeSingle();

      if (!asset) {
        const { data: newAsset, error } = await supabase
          .from("assets")
          .insert({ ticker: ticker.toUpperCase().trim(), name: ticker.toUpperCase().trim(), asset_class: "equity" })
          .select("id")
          .single();
        if (error) throw error;
        asset = newAsset;
      }

      const { error } = await supabase.from("trade_journal").insert({
        asset_id: asset!.id,
        side,
        entry_price: parseFloat(entryPrice),
        exit_price:  parseFloat(exitPrice),
        pnl,
        opened_at:  openedAt  || null,
        closed_at:  closedAt  || new Date().toISOString(),
        reason_in:  reasonIn  || null,
        reason_out: reasonOut || null,
      });
      if (error) throw error;

      toast.success("Trade added to journal");
      // Reset
      setTicker(""); setSide("long"); setEntryPrice(""); setExitPrice("");
      setOpenedAt(""); setClosedAt(""); setReasonIn(""); setReasonOut("");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Trade Manually</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {/* Ticker + Side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Ticker</label>
              <Input
                placeholder="AAPL"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Side</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSide("long")}
                  className={`flex-1 rounded border py-1.5 font-mono text-xs uppercase transition-colors ${side === "long" ? "border-bull bg-bull/10 text-bull" : "border-border text-muted-foreground hover:border-bull/50"}`}
                >
                  Long
                </button>
                <button
                  onClick={() => setSide("short")}
                  className={`flex-1 rounded border py-1.5 font-mono text-xs uppercase transition-colors ${side === "short" ? "border-bear bg-bear/10 text-bear" : "border-border text-muted-foreground hover:border-bear/50"}`}
                >
                  Short
                </button>
              </div>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Entry Price</label>
              <Input placeholder="178.50" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} type="number" step="0.01" />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Exit Price</label>
              <Input placeholder="192.00" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} type="number" step="0.01" />
            </div>
          </div>

          {/* P&L preview */}
          {pnl !== null && (
            <div className={`rounded-md border px-3 py-2 font-mono text-sm font-semibold ${pnl >= 0 ? "border-bull/30 bg-bull/8 text-bull" : "border-bear/30 bg-bear/8 text-bear"}`}>
              P&L per share: {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} USD
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Opened At</label>
              <Input type="date" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Closed At</label>
              <Input type="date" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} />
            </div>
          </div>

          {/* Reasons */}
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Why entered</label>
            <Input placeholder="Supply shock thesis, Q4 FCF beat..." value={reasonIn} onChange={(e) => setReasonIn(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Why exited</label>
            <Input placeholder="Stop hit, thesis invalidated, target reached..." value={reasonOut} onChange={(e) => setReasonOut(e.target.value)} />
          </div>

          <Button className="w-full" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Save Trade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
