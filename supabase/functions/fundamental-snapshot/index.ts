// Atlantix Lab — Fundamental Snapshot
// Pulls P/E, EPS, margins, ROE, debt/equity, 52w from Finnhub /stock/metric
// and merges into asset_features.metadata so analyst-agent stops hallucinating.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";

const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Fundamentals {
  pe_ttm?: number;
  ps_ttm?: number;
  pb?: number;
  eps_ttm?: number;
  revenue_growth_yoy?: number;
  gross_margin?: number;
  operating_margin?: number;
  net_margin?: number;
  roe?: number;
  debt_to_equity?: number;
  high_52w?: number;
  low_52w?: number;
  market_cap?: number;
  fetched_at: string;
}

async function fetchFundamentals(ticker: string): Promise<Fundamentals | null> {
  if (!FINNHUB_API_KEY) return null;
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all&token=${FINNHUB_API_KEY}`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const m = j?.metric ?? {};
    if (!m || Object.keys(m).length === 0) return null;
    const num = (v: any) => Number.isFinite(Number(v)) ? Number(v) : undefined;
    return {
      pe_ttm: num(m.peTTM),
      ps_ttm: num(m.psTTM),
      pb: num(m.pbAnnual),
      eps_ttm: num(m.epsTTM),
      revenue_growth_yoy: num(m.revenueGrowthTTMYoy),
      gross_margin: num(m.grossMarginTTM),
      operating_margin: num(m.operatingMarginTTM),
      net_margin: num(m.netProfitMarginTTM),
      roe: num(m.roeTTM),
      debt_to_equity: num(m["totalDebt/totalEquityAnnual"]),
      high_52w: num(m["52WeekHigh"]),
      low_52w: num(m["52WeekLow"]),
      market_cap: num(m.marketCapitalization),
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// Fetch fundamentals for BIST tickers via Yahoo Finance (Finnhub doesn't cover BIST)
async function fetchFundamentalsBIST(ticker: string): Promise<Fundamentals | null> {
  try {
    const symbol = ticker.includes(".") ? ticker : `${ticker}.IS`;
    const r = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData,summaryDetail`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "application/json",
        },
      },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const ks = j?.quoteSummary?.result?.[0]?.defaultKeyStatistics ?? {};
    const fd = j?.quoteSummary?.result?.[0]?.financialData ?? {};
    const sd = j?.quoteSummary?.result?.[0]?.summaryDetail ?? {};
    const num = (v: any) => Number.isFinite(Number(v?.raw ?? v)) ? Number(v?.raw ?? v) : undefined;
    const result: Fundamentals = {
      pe_ttm: num(sd.trailingPE),
      ps_ttm: num(ks.priceToSalesTrailing12Months),
      pb: num(ks.priceToBook),
      eps_ttm: num(ks.trailingEps),
      revenue_growth_yoy: num(fd.revenueGrowth),
      gross_margin: num(fd.grossMargins),
      operating_margin: num(fd.operatingMargins),
      net_margin: num(fd.profitMargins),
      roe: num(fd.returnOnEquity),
      debt_to_equity: num(fd.debtToEquity),
      high_52w: num(sd.fiftyTwoWeekHigh),
      low_52w: num(sd.fiftyTwoWeekLow),
      market_cap: num(sd.marketCap),
      fetched_at: new Date().toISOString(),
    };
    // Return null if we got nothing useful
    const hasData = Object.entries(result).some(([k, v]) => k !== "fetched_at" && v !== undefined);
    return hasData ? result : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Universe: ALL assets (was: watchlist ∪ positions ∪ ideas → empty)
    const { data: assets } = await sb.from("assets")
      .select("id, ticker, country, metadata");

    let ok = 0, fail = 0;
    for (const a of (assets ?? []) as any[]) {
      // Use BIST-specific fetcher for Turkish assets, Finnhub for the rest
      const f = a.country === "TR"
        ? await fetchFundamentalsBIST(a.ticker)
        : await fetchFundamentals(a.ticker);
      if (!f) { fail++; continue; }

      // Merge into asset_features.metadata for latest as_of
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await sb.from("asset_features")
        .select("id, metadata").eq("asset_id", a.id).eq("as_of", today).maybeSingle();

      const newMeta = { ...(existing?.metadata ?? {}), fundamentals: f };
      if (existing) {
        await sb.from("asset_features").update({ metadata: newMeta }).eq("id", existing.id);
      } else {
        await sb.from("asset_features").insert({ asset_id: a.id, as_of: today, metadata: newMeta });
      }

      // Also store on assets.metadata for quick access
      await sb.from("assets").update({
        metadata: { ...(a.metadata ?? {}), fundamentals: f },
      }).eq("id", a.id);
      ok++;
    }

    await sb.from("system_health_log").insert({
      component: "fundamental-snapshot",
      status: fail === 0 ? "green" : ok === 0 ? "red" : "yellow",
      message: `fundamentals: ${ok} ok / ${fail} fail`,
    });

    return new Response(JSON.stringify({ ok: true, processed: ok, failed: fail }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
