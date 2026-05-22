// Atlantix Lab — Feature Snapshot
// Computes per-asset quantitative features from Yahoo daily history and upserts asset_features.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";
import { yahooHistory, type Candle } from "../_shared/quotes.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function pctChange(a: number, b: number) {
  if (!a || !Number.isFinite(a)) return null;
  return ((b - a) / a) * 100;
}

function realizedVol(closes: number[]) {
  if (closes.length < 3) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(rets.length - 1, 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100; // annualised %
}

function computeFeatures(candles: Candle[]) {
  if (candles.length < 5) return null;
  const closes = candles.map((c) => c.c);
  const vols = candles.map((c) => c.v);
  const last = closes[closes.length - 1];
  const last20 = closes.slice(-20);
  const last60 = closes.slice(-60);
  const max52 = Math.max(...closes);
  const min52 = Math.min(...closes);
  const avgVol20 = vols.slice(-20).reduce((s, x) => s + x, 0) / Math.min(vols.length, 20);
  const latestVol = vols[vols.length - 1];

  return {
    vol_20d: realizedVol(last20),
    vol_60d: realizedVol(last60),
    momentum_5d: closes.length >= 6 ? pctChange(closes[closes.length - 6], last) : null,
    momentum_20d: closes.length >= 21 ? pctChange(closes[closes.length - 21], last) : null,
    rvol: avgVol20 > 0 ? latestVol / avgVol20 : null,
    dist_52w_high: max52 > 0 ? ((last - max52) / max52) * 100 : null,
    dist_52w_low: min52 > 0 ? ((last - min52) / min52) * 100 : null,
    latest_close: last,
    latest_volume: latestVol,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Universe: ALL assets in the registry (was: only watchlist ∪ positions ∪ ideas → most rows empty).
    const { data: assets } = await sb
      .from("assets")
      .select("id, ticker, country");

    let ok = 0;
    let fail = 0;
    const errors: any[] = [];

    for (const a of assets ?? []) {
      try {
        // BIST tickers need .IS suffix on Yahoo Finance (e.g. AKBNK → AKBNK.IS)
        const yahooSymbol = (a as any).country === "TR" && !a.ticker.includes(".")
          ? `${a.ticker}.IS`
          : a.ticker;
        const candles = await yahooHistory(yahooSymbol, "1y", "1d");
        const f = computeFeatures(candles);
        if (!f) {
          fail++;
          continue;
        }
        const { error } = await sb
          .from("asset_features")
          .upsert(
            { asset_id: a.id, as_of: new Date().toISOString().slice(0, 10), ...f },
            { onConflict: "asset_id,as_of" },
          );
        if (error) {
          fail++;
          errors.push({ ticker: a.ticker, error: error.message });
        } else {
          ok++;
        }
      } catch (e) {
        fail++;
        errors.push({ ticker: a.ticker, error: String(e) });
      }
    }

    await sb.from("system_health_log").insert({
      component: "feature_snapshot",
      status: fail === 0 ? "green" : ok === 0 ? "red" : "yellow",
      message: `features: ${ok} ok / ${fail} fail`,
      metadata: { errors: errors.slice(0, 10) },
    });

    return new Response(JSON.stringify({ ok: true, processed: ok, failed: fail }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
