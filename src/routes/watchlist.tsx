import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Rocket, Trash2, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const countryFlag = (c?: string | null) =>
  c === "TR" ? "🇹🇷" : c === "US" ? "🇺🇸" : c === "DE" ? "🇩🇪" : c === "GB" ? "🇬🇧" : "🌐";

export const Route = createFileRoute("/watchlist")({ component: WatchlistPage });

function WatchlistPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigate();

  const { data } = useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const { data } = await supabase
        .from("watchlist")
        .select("*, assets(id, ticker, name, asset_class, sector, country, katilim_compliant)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [klass, setKlass] = useState("equity");
  const [note, setNote] = useState("");
  const [countryFilter, setCountryFilter] = useState<"all" | "TR" | "US">("all");
  const [katilimOnly, setKatilimOnly] = useState(false);

  async function seedBistTop() {
    try {
      const tickers = ["THYAO", "ASELS", "KCHOL", "GARAN", "AKBNK", "BIMAS", "EREGL", "SISE", "TUPRS"];
      const { data: u } = await supabase.auth.getUser();
      const { data: assets } = await supabase
        .from("assets").select("id, ticker").in("ticker", tickers);
      const { data: existing } = await supabase
        .from("watchlist").select("asset_id");
      const existingSet = new Set((existing ?? []).map((w) => w.asset_id));
      const rows = (assets ?? [])
        .filter((a) => !existingSet.has(a.id))
        .map((a) => ({ asset_id: a.id, added_by: u.user?.id ?? null, trigger_note: "BIST large-cap liquidity universe — seeded for monitoring" }));
      if (!rows.length) return toast.info(t("watchlist.seedExists"));
      const { error } = await supabase.from("watchlist").insert(rows);
      if (error) throw error;
      toast.success(t("watchlist.seeded", { n: rows.length }));
      qc.invalidateQueries({ queryKey: ["watchlist"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : t("watchlist.seedFailed")); }
  }

  async function addAsset() {
    if (!ticker) return toast.error(t("watchlist.tickerRequired"));
    try {
      const { data: u } = await supabase.auth.getUser();
      const upper = ticker.toUpperCase();
      const { data: existing } = await supabase.from("assets").select("id").eq("ticker", upper).maybeSingle();
      let assetId = existing?.id;
      if (!assetId) {
        const { data: a, error } = await supabase
          .from("assets")
          .insert({ ticker: upper, name: name || upper, asset_class: klass })
          .select("id")
          .single();
        if (error) throw error;
        assetId = a.id;
      }
      const { error: we } = await supabase.from("watchlist").insert({
        asset_id: assetId, trigger_note: note || null, added_by: u.user?.id ?? null,
      });
      if (we) throw we;
      toast.success(t("watchlist.added"));
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      setAddOpen(false); setTicker(""); setName(""); setNote("");
    } catch (e) { toast.error(e instanceof Error ? e.message : t("watchlist.failed")); }
  }

  async function promote(assetId: string, ticker?: string, triggerNote?: string | null) {
    const { data: u } = await supabase.auth.getUser();
    const { data: idea, error } = await supabase
      .from("ideas")
      .insert({
        asset_id: assetId,
        title: `New idea on ${ticker ?? "asset"}`,
        thesis: triggerNote ?? "Promoted from watchlist — needs thesis.",
        side: "long",
        status: "draft",
        trigger: triggerNote ?? null,
        created_by: u.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    toast.success(t("watchlist.promoted"));
    nav({ to: "/debate", search: { id: idea.id } });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("watchlist").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["watchlist"] });
  }

  return (
    <AppShell>
      <PageHeader
        title={t("watchlist.title")}
        subtitle={t("watchlist.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={seedBistTop}>
              <Sparkles className="mr-1 h-3 w-3" />{t("watchlist.seedBist")}
            </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />{t("watchlist.addTicker")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("watchlist.addToWatchlist")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>{t("watchlist.ticker")}</Label><Input value={ticker} onChange={(e) => setTicker(e.target.value)} /></div>
                  <div><Label>{t("watchlist.name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div>
                    <Label>{t("watchlist.class")}</Label>
                    <Select value={klass} onValueChange={setKlass}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equity">Equity</SelectItem>
                        <SelectItem value="etf">ETF</SelectItem>
                        <SelectItem value="commodity">Commodity</SelectItem>
                        <SelectItem value="fx">FX</SelectItem>
                        <SelectItem value="crypto">Crypto</SelectItem>
                        <SelectItem value="bond">Bond</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>{t("watchlist.triggerNote")}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
              </div>
              <DialogFooter><Button onClick={addAsset}>{t("watchlist.add")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        }
      />
      <div className="flex items-center gap-4 border-b bg-surface-2/40 px-8 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{t("watchlist.filter")}:</span>
        <button onClick={() => setCountryFilter("all")} className={countryFilter === "all" ? "text-foreground" : "hover:text-foreground"}>{t("watchlist.all")}</button>
        <button onClick={() => setCountryFilter("TR")} className={countryFilter === "TR" ? "text-foreground" : "hover:text-foreground"}>🇹🇷 BIST</button>
        <button onClick={() => setCountryFilter("US")} className={countryFilter === "US" ? "text-foreground" : "hover:text-foreground"}>🇺🇸 US</button>
        <label className="ml-4 flex items-center gap-2 normal-case tracking-normal">
          <Checkbox checked={katilimOnly} onCheckedChange={(v) => setKatilimOnly(v === true)} />
          <span>{t("watchlist.shariahOnly")}</span>
        </label>
      </div>
      <div className="px-8 py-6">
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-surface-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{t("watchlist.country")}</th>
                <th className="px-4 py-2 text-left">{t("watchlist.ticker")}</th>
                <th className="px-4 py-2 text-left">{t("watchlist.name")}</th>
                <th className="px-4 py-2 text-left">{t("watchlist.class")}</th>
                <th className="px-4 py-2 text-left">{t("watchlist.sector")}</th>
                <th className="px-4 py-2 text-left">{t("watchlist.shariahColumn")}</th>
                <th className="px-4 py-2 text-left">{t("watchlist.trigger")}</th>
                <th className="px-4 py-2 text-left">{t("watchlist.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = (data ?? []).filter((w) => {
                  const a = w.assets as { country?: string | null; katilim_compliant?: boolean | null } | null;
                  if (countryFilter !== "all" && a?.country !== countryFilter) return false;
                  if (katilimOnly && !a?.katilim_compliant) return false;
                  return true;
                });
                if (filtered.length === 0) {
                  return (
                    <tr><td colSpan={8} className="px-4 py-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("watchlist.empty")}</td></tr>
                  );
                }
                return filtered.map((w) => {
                  const a = w.assets as { id?: string; ticker?: string; name?: string; asset_class?: string; sector?: string; country?: string | null; katilim_compliant?: boolean | null } | null;
                  return (
                    <tr key={w.id} className="border-b hover:bg-surface-2">
                      <td className="px-4 py-2 text-base">{countryFlag(a?.country)}</td>
                      <td className="px-4 py-2"><span className="ticker rounded bg-surface px-1.5 py-0.5 text-xs">{a?.ticker}</span></td>
                      <td className="px-4 py-2">{a?.name}</td>
                      <td className="px-4 py-2 font-mono text-xs uppercase text-muted-foreground">{a?.asset_class}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{a?.sector ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{a?.katilim_compliant ? <span title="Sharia-compliant" className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-emerald-500">☪ Halal</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="max-w-md px-4 py-2 text-xs">{w.trigger_note ?? "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => a?.id && promote(a.id, a.ticker, w.trigger_note)}>
                            <Rocket className="mr-1 h-3 w-3" />{t("watchlist.promote")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(w.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
