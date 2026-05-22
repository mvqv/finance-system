// Atlantix Lab — TRY Crisis Monitor
// Sustained or sudden TRY devaluation > threshold triggers:
//   - alert row (severity=critical)
//   - portfolio_snapshots regime=try_crisis
//   - Telegram notify (best-effort)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TG_CHAT  = Deno.env.get("TELEGRAM_CHAT_ID");

const THRESHOLD_PCT = 3.0; // sudden 1-day move

async function sendTelegram(text: string) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "Markdown" }),
    });
  } catch (e) { console.error("telegram failed", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: rows, error } = await sb
      .from("macro_indicators")
      .select("value, observed_at")
      .eq("series_id", "TCMB_USDTRY")
      .order("observed_at", { ascending: false })
      .limit(2);

    if (error) throw error;
    if (!rows || rows.length < 2) {
      return new Response(JSON.stringify({ ok: true, skipped: "need >=2 USDTRY observations" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const latest = Number(rows[0].value);
    const prev   = Number(rows[1].value);
    const pct = ((latest - prev) / prev) * 100;
    const triggered = pct >= THRESHOLD_PCT;

    if (triggered) {
      const title = `🚨 TRY crisis: USD/TRY +${pct.toFixed(2)}% in 1 step`;
      const body  = `USD/TRY moved from ${prev.toFixed(4)} → ${latest.toFixed(4)}. Threshold ${THRESHOLD_PCT}%.`;

      await sb.from("alerts").insert({
        title, body, category: "macro", severity: "critical",
        source: "try-crisis-monitor",
        metadata: { latest, prev, pct, threshold: THRESHOLD_PCT },
      });

      // Snapshot with crisis regime (best-effort: needs cash/equity numbers)
      const { data: last } = await sb
        .from("portfolio_snapshots")
        .select("cash, total_equity")
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      await sb.from("portfolio_snapshots").insert({
        cash: last?.cash ?? 0,
        total_equity: last?.total_equity ?? 0,
        regime: "try_crisis",
      });

      await sendTelegram(`*${title}*\n${body}`);
    }

    await sb.from("system_health_log").insert({
      component: "try-crisis-monitor",
      status: "ok",
      message: triggered ? "TRY crisis triggered" : "TRY stable",
      metadata: { latest, prev, pct, triggered },
    });

    return new Response(JSON.stringify({ ok: true, triggered, pct, latest, prev }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
