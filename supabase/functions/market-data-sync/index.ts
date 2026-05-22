// Atlantix Lab — Market Data Sync
// Refreshes positions.current_price / unrealized_pnl using Finnhub → Yahoo cascade.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";
import { getQuote } from "../_shared/quotes.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const tickersFilter: string[] = Array.isArray(body.tickers) ? body.tickers : [];

    // Also refresh watchlist tickers (so /watchlist shows live prices),
    // but PnL is only computed for open positions.
    const { data: positions, error } = await sb
      .from("positions")
      .select("id, quantity, avg_price, side, asset_id, assets:asset_id(ticker)")
      .is("closed_at", null);
    if (error) throw error;

    let updated = 0;
    const results: any[] = [];
    const errors: any[] = [];

    for (const p of positions || []) {
      const ticker = (p as any).assets?.ticker;
      if (!ticker) continue;
      if (tickersFilter.length && !tickersFilter.includes(ticker)) continue;

      const quote = await getQuote(ticker);
      if (!quote) {
        errors.push({ ticker, error: "no quote" });
        continue;
      }

      const qty = Number(p.quantity);
      const avg = Number(p.avg_price);
      const sign = p.side === "short" ? -1 : 1;
      const pnl = sign * (quote.price - avg) * qty;

      const { error: upErr } = await sb
        .from("positions")
        .update({
          current_price: quote.price,
          unrealized_pnl: pnl,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (!upErr) {
        updated++;
        results.push({ ticker, price: quote.price, pnl, source: quote.source });
      } else {
        errors.push({ ticker, error: upErr.message });
      }
    }

    await sb.from("system_health_log").insert({
      component: "market-data-sync",
      status: errors.length > 0 && updated === 0 ? "error" : "ok",
      message: `Updated ${updated} positions, ${errors.length} errors`,
      metadata: { results, errors },
    });

    return new Response(JSON.stringify({ ok: true, updated, results, errors }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
