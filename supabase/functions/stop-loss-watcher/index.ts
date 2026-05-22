// Atlantix Lab — Stop-Loss / Take-Profit Watcher
// Polls open positions, fetches live quote, and auto-closes via Alpaca paper if
// stop_loss / take_profit thresholds are breached. Runs every 60s via pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";
import { getQuote } from "../_shared/quotes.ts";

const ALPACA_KEY_ID = Deno.env.get("ALPACA_KEY_ID")!;
const ALPACA_SECRET_KEY = Deno.env.get("ALPACA_SECRET_KEY")!;
const ALPACA_BASE = "https://paper-api.alpaca.markets";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function alpacaClose(symbol: string) {
  const r = await fetch(`${ALPACA_BASE}/v2/positions/${encodeURIComponent(symbol)}`, {
    method: "DELETE",
    headers: {
      "APCA-API-KEY-ID": ALPACA_KEY_ID,
      "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
    },
  });
  if (!r.ok && r.status !== 404) {
    throw new Error(`Alpaca close ${symbol} ${r.status}: ${await r.text()}`);
  }
  return r.ok ? await r.json() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: positions } = await sb
      .from("positions")
      .select("id, side, quantity, avg_price, stop_loss, take_profit, asset_id, assets:asset_id(ticker, country)")
      .is("closed_at", null);

    let checked = 0, breached = 0, closed = 0, skipped = 0;
    const events: any[] = [];

    for (const p of (positions ?? []) as any[]) {
      const ticker = p.assets?.ticker as string | undefined;
      if (!ticker) { skipped++; continue; }
      // BIST = paper-only, no broker — skip live close
      const isBist = p.assets?.country === "TR";
      if (isBist) { skipped++; continue; }
      if (!p.stop_loss && !p.take_profit) { skipped++; continue; }

      checked++;
      const q = await getQuote(ticker);
      if (!q) continue;
      const price = q.price;

      let trigger: "stop_loss" | "take_profit" | null = null;
      if (p.side === "long") {
        if (p.stop_loss && price <= Number(p.stop_loss)) trigger = "stop_loss";
        else if (p.take_profit && price >= Number(p.take_profit)) trigger = "take_profit";
      } else {
        if (p.stop_loss && price >= Number(p.stop_loss)) trigger = "stop_loss";
        else if (p.take_profit && price <= Number(p.take_profit)) trigger = "take_profit";
      }

      // Always update current_price
      await sb.from("positions").update({
        current_price: price,
        last_synced_at: new Date().toISOString(),
      }).eq("id", p.id);

      if (!trigger) continue;
      breached++;

      try {
        if (ALPACA_KEY_ID && ALPACA_SECRET_KEY) await alpacaClose(ticker);
        await sb.from("positions").update({
          closed_at: new Date().toISOString(),
          current_price: price,
        }).eq("id", p.id);
        await sb.from("alerts").insert({
          severity: trigger === "stop_loss" ? "critical" : "info",
          category: "execution",
          source: "stop-loss-watcher",
          title: `${trigger === "stop_loss" ? "🛑 Stop hit" : "🎯 Take-profit hit"}: ${ticker}`,
          body: `Side ${p.side}, qty ${p.quantity}, threshold ${trigger === "stop_loss" ? p.stop_loss : p.take_profit}, mark ${price.toFixed(2)}`,
          ticker,
          metadata: { position_id: p.id, trigger, price, threshold: trigger === "stop_loss" ? p.stop_loss : p.take_profit },
        });
        await sb.from("audit_log").insert({
          actor_id: null,
          action: `position.auto_closed.${trigger}`,
          target_type: "position",
          target_id: p.id,
          payload: { ticker, price, side: p.side, qty: p.quantity },
        });
        try {
          await sb.functions.invoke("notify", {
            body: {
              channel: "both",
              level: trigger === "stop_loss" ? "critical" : "info",
              subject: `${trigger.toUpperCase()} hit: ${ticker} @ ${price.toFixed(2)}`,
              body: `Position ${p.side} ${p.quantity} ${ticker} auto-closed.`,
            },
          });
        } catch (_) {/* non-fatal */}
        closed++;
        events.push({ ticker, trigger, price });
      } catch (e) {
        await sb.from("system_health_log").insert({
          component: "stop-loss-watcher",
          status: "red",
          message: `Failed to close ${ticker}: ${String(e)}`,
        });
      }
    }

    await sb.from("system_health_log").insert({
      component: "stop-loss-watcher",
      status: closed > 0 ? "yellow" : "green",
      message: `checked=${checked} breached=${breached} closed=${closed} skipped=${skipped}`,
      metadata: { events },
    });

    return new Response(JSON.stringify({ ok: true, checked, breached, closed, skipped, events }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
