// Atlantix Lab — TR Macro Snapshot
// Refreshes Turkish macro indicators: USD/TRY (live via Frankfurter/ECB),
// TCMB politika faizi, TÜFE, ÜFE, TCMB rezervleri, KKM payı.
// Free indicators (FX) come from public APIs; policy/CPI/PPI use the latest
// known values stored in the table (manually curatable).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fetchUsdTry(): Promise<number | null> {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY");
    if (!r.ok) return null;
    const j = await r.json();
    const v = j?.rates?.TRY;
    return typeof v === "number" ? v : null;
  } catch (e) {
    console.error("USD/TRY fetch failed", e);
    return null;
  }
}

async function fetchEurTry(): Promise<number | null> {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=TRY");
    if (!r.ok) return null;
    const j = await r.json();
    const v = j?.rates?.TRY;
    return typeof v === "number" ? v : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();
    const rows: Array<Record<string, unknown>> = [];

    const usdtry = await fetchUsdTry();
    if (usdtry) rows.push({ series_id: "TCMB_USDTRY", label: "USD/TRY", value: usdtry, unit: "TRY", observed_at: now });

    const eurtry = await fetchEurTry();
    if (eurtry) rows.push({ series_id: "TCMB_EURTRY", label: "EUR/TRY", value: eurtry, unit: "TRY", observed_at: now });

    if (rows.length) {
      const { error } = await sb.from("macro_indicators").insert(rows);
      if (error) throw error;
    }

    // Log health
    await sb.from("system_health_log").insert({
      component: "tr-macro-snapshot",
      status: "ok",
      message: `Refreshed ${rows.length} TR macro series`,
      metadata: { usdtry, eurtry },
    });

    return new Response(JSON.stringify({ ok: true, refreshed: rows.length, usdtry, eurtry }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
