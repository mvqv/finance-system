// Atlantix Lab — Place Order (manual execution, no broker)
// Records the order as "submitted" in the DB and creates a position entry.
// Actual execution is done manually by the trader.
// Works for any market: US, BIST (.IS), crypto, etc.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";
import { getQuote } from "../_shared/quotes.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id required");

    const { data: order, error } = await sb
      .from("orders")
      .select("*, assets:asset_id(ticker, name)")
      .eq("id", order_id)
      .single();
    if (error || !order) throw new Error("order not found");

    if (!["pending_approval", "approved"].includes(order.status)) {
      throw new Error(`order status is ${order.status}, cannot submit`);
    }

    const ticker = (order as any).assets?.ticker as string | undefined;
    if (!ticker) throw new Error("asset ticker missing");

    // Get live price from Yahoo Finance
    const quote = await getQuote(ticker);
    const fillPrice = quote?.price ?? Number(order.limit_price ?? 0);

    // Mark order as submitted (manual execution)
    await sb.from("orders").update({
      status:       "submitted",
      filled_price: fillPrice,
      submitted_at: new Date().toISOString(),
    }).eq("id", order_id);

    // Create or update position
    const { data: existing } = await sb
      .from("positions")
      .select("id, quantity, avg_price")
      .eq("asset_id", order.asset_id)
      .is("closed_at", null)
      .maybeSingle();

    if (existing) {
      // Average into existing position
      const oldQty = Number(existing.quantity);
      const newQty = oldQty + Number(order.quantity);
      const newAvg = (oldQty * Number(existing.avg_price) + Number(order.quantity) * fillPrice) / newQty;
      await sb.from("positions").update({
        quantity:        newQty,
        avg_price:       newAvg,
        current_price:   fillPrice,
        last_synced_at:  new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      // New position
      await sb.from("positions").insert({
        asset_id:       order.asset_id,
        idea_id:        order.idea_id ?? null,
        side:           order.side,
        quantity:       Number(order.quantity),
        avg_price:      fillPrice,
        current_price:  fillPrice,
        unrealized_pnl: 0,
        last_synced_at: new Date().toISOString(),
      });
    }

    await sb.from("audit_log").insert({
      actor_id:    null,
      action:      "order.submitted",
      target_type: "order",
      target_id:   order_id,
      payload:     { ticker, fill_price: fillPrice, qty: order.quantity, source: "manual" },
    });

    // Notify
    try {
      await sb.functions.invoke("notify", {
        body: {
          channel: "both",
          level:   "info",
          subject: `Order recorded: ${ticker} ${order.side} ${order.quantity}`,
          body:    `Fill price: ${fillPrice}\nExecute this order manually in your broker app.`,
        },
      });
    } catch (_) { /* non-fatal */ }

    return new Response(
      JSON.stringify({ ok: true, fill_price: fillPrice, ticker, note: "Execute manually in your broker app" }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
