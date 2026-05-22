import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, ShieldCheck } from "lucide-react";
import { useShariahMode } from "@/hooks/useShariahMode";

export function NewIdeaDialog() {
  const { isShariahModeEnabled } = useShariahMode();
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState<string>("");
  const [newTicker, setNewTicker] = useState("");
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState("equity");
  const [newCountry, setNewCountry] = useState("US");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newExchange, setNewExchange] = useState("");
  const [title, setTitle] = useState("");
  const [thesis, setThesis] = useState("");
  const [side, setSide] = useState<"long" | "short">("long");
  const [trigger, setTrigger] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const { data: assets } = useQuery({
    queryKey: ["assets-list"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("id,ticker,name,asset_class").order("ticker");
      return data ?? [];
    },
  });

  async function submit() {
    if (!title || !thesis) return toast.error("Title & thesis required");
    setBusy(true);
    try {
      let finalAssetId = assetId;
      if (assetId === "__new__") {
        if (!newTicker) throw new Error("Ticker required for new asset");
        const { data: a, error: ae } = await supabase
          .from("assets")
          .insert({
            ticker: newTicker.toUpperCase(),
            name: newName || newTicker.toUpperCase(),
            asset_class: newClass,
            country: newCountry || null,
            currency: newCurrency || null,
            exchange: newExchange || null,
          })
          .select("id")
          .single();
        if (ae) throw ae;
        finalAssetId = a.id;
      }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("ideas").insert({
        title,
        thesis,
        side,
        trigger: trigger || null,
        asset_id: finalAssetId || null,
        status: "draft",
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Idea created");
      qc.invalidateQueries({ queryKey: ["all-ideas"] });
      qc.invalidateQueries({ queryKey: ["ideas-list-for-debate"] });
      setOpen(false);
      setTitle(""); setThesis(""); setTrigger(""); setAssetId(""); setNewTicker(""); setNewName("");
      setNewCountry("US"); setNewCurrency("USD"); setNewExchange("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />New Idea</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Investment Idea</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Asset</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
              <SelectContent>
                {assets?.map((a) => <SelectItem key={a.id} value={a.id}>{a.ticker} — {a.name}</SelectItem>)}
                <SelectItem value="__new__">+ New asset</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {assetId === "__new__" && (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Ticker (AKBNK)" value={newTicker} onChange={(e) => setNewTicker(e.target.value)} />
                <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Select value={newClass} onValueChange={setNewClass}>
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
              <div className="grid grid-cols-3 gap-2">
                <Select value={newCountry} onValueChange={(v) => {
                  setNewCountry(v);
                  if (v === "TR") { setNewCurrency("TRY"); setNewExchange("BIST"); }
                  else if (v === "US") { setNewCurrency("USD"); setNewExchange(""); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">🇺🇸 US</SelectItem>
                    <SelectItem value="TR">🇹🇷 TR (BIST)</SelectItem>
                    <SelectItem value="GB">🇬🇧 GB</SelectItem>
                    <SelectItem value="DE">🇩🇪 DE</SelectItem>
                    <SelectItem value="JP">🇯🇵 JP</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Currency (TRY/USD)" value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)} />
                <Input placeholder="Exchange (BIST)" value={newExchange} onChange={(e) => setNewExchange(e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Side</Label>
              <Select
                value={side}
                onValueChange={(v) => setSide(v as "long" | "short")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem
                    value="short"
                    disabled={isShariahModeEnabled}
                  >
                    Short
                    {isShariahModeEnabled && (
                      <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-amber-500">
                        <ShieldCheck className="h-3 w-3" />
                        Shariah
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
              <Label>Trigger</Label>
              <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="catalyst..." />
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Long XOM on supply shock" />
          </div>
          <div>
            <Label>Thesis</Label>
            <Textarea value={thesis} onChange={(e) => setThesis(e.target.value)} rows={4} placeholder="Why this trade..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create Idea"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
