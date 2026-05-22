// Atlantix Lab — Portfolio Sync (Yahoo Finance, no broker)
// Refreshes all open position prices via Yahoo Finance and updates
// portfolio_snapshots with current equity/cash/pnl.
// Works for any market including BIST (.IS tickers).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";
import { getQuote } from "../_shared/quotes.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load all open positions
    const { data: positions, error: posErr } = await sb
      .from("positions")
      .select("id, quantity, avg_price, side, weight_pct, asset_id, assets:asset_id(ticker)")
      .is("closed_at", null);

    if (posErr) throw new Error(`positions query failed: ${posErr.message}`);

    // Get last snapshot to carry forward equity/cash
    const { data: lastSnap } = await sb
      .from("portfolio_snapshots")
      .select("total_equity, cash, regime")
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let totalUnrealizedPnl = 0;
    let grossMarketValue = 0;   // sum of |qty * current_price| across positions
    let longExposure = 0;        // sum of qty * price for longs (consumes cash)
    let updated = 0;
    const errors: { ticker: string; error: string }[] = [];
    // Collect per-position updates so we can compute weight_pct after equity is known
    const synced: { id: string; price: number; pnl: number; mv: number }[] = [];

    for (const p of positions ?? []) {
      const ticker = (p as any).assets?.ticker as string | undefined;
      if (!ticker) continue;

      try {
        const quote = await getQuote(ticker);
        if (!quote) {
          errors.push({ ticker, error: "no quote from Yahoo" });
          continue;
        }

        const qty   = Number(p.quantity);
        const avg   = Number(p.avg_price);
        const sign  = p.side === "short" ? -1 : 1;
        const pnl   = sign * (quote.price - avg) * qty;
        const mv    = qty * quote.price;          // market value (absolute)
        totalUnrealizedPnl += pnl;
        grossMarketValue   += mv;
        if (p.side !== "short") longExposure += mv;

        synced.push({ id: p.id, price: quote.price, pnl, mv });
        updated++;
      } catch (tickerErr) {
        errors.push({ ticker, error: String(tickerErr) });
      }
    }

    // Cash is preserved from last snapshot (real broker wiring would update it).
    // If we have no prior snapshot, seed a clean $100k paper account.
    const cash = Number(lastSnap?.cash ?? 100_000);

    // Real equity = cash + market value of longs + unrealized PnL on shorts.
    // (Shorts don't add positive market value to NAV; only their PnL does.)
    const shortPnl = synced.reduce((s, x) => {
      const pos = (positions ?? []).find((p: any) => p.id === x.id);
      return pos?.side === "short" ? s + x.pnl : s;
    }, 0);
    const totalEquity = cash + longExposure + shortPnl;

    // Daily PnL = equity change vs the first snapshot taken today (UTC).
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: firstToday } = await sb
      .from("portfolio_snapshots")
      .select("total_equity")
      .gte("snapshot_at", todayStart.toISOString())
      .order("snapshot_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const dailyPnl = firstToday?.total_equity != null
      ? totalEquity - Number(firstToday.total_equity)
      : totalUnrealizedPnl;

    // Now persist per-position price + weight (using fresh equity).
    for (const s of synced) {
      await sb.from("positions").update({
        current_price:  s.price,
        unrealized_pnl: s.pnl,
        weight_pct:     totalEquity > 0 ? (s.mv / totalEquity) * 100 : 0,
        last_synced_at: new Date().toISOString(),
      }).eq("id", s.id);
    }

    await sb.from("portfolio_snapshots").insert({
      total_equity:        totalEquity,
      cash,
      daily_pnl:           dailyPnl,
      daily_risk_used_pct: totalEquity > 0
        ? Math.min(100, Math.abs(dailyPnl) / totalEquity * 100)
        : 0,
      regime: lastSnap?.regime ?? "neutral",
    });

    await sb.from("system_health_log").insert({
      component: "broker-sync-portfolio",
      status:    errors.length > 0 && updated === 0 ? "error" : "ok",
      message:   `Yahoo sync: ${updated} positions, equity $${totalEquity.toFixed(0)}, daily P&L $${dailyPnl.toFixed(2)}`,
      metadata:  { updated, errors, totalEquity, dailyPnl, grossMarketValue },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        updated,
        positions: updated,
        equity: totalEquity,
        cash,
        daily_pnl: dailyPnl,
        unrealized_pnl: totalUnrealizedPnl,
        errors,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("broker-sync-portfolio error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
