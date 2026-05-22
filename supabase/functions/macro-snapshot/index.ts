// Atlantix Lab — Macro Snapshot
// Fetches a set of macro series from FRED and writes them to macro_indicators.
// Also writes a fresh portfolio_snapshots row with a regime classification.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";

const FRED_API_KEY = Deno.env.get("FRED_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Series {
  id: string;
  label: string;
  unit: string;
}

const SERIES: Series[] = [
  { id: "DFF",         label: "Fed Funds Rate",          unit: "%"   },
  { id: "DGS10",       label: "US 10Y Treasury",         unit: "%"   },
  { id: "DGS2",        label: "US 2Y Treasury",          unit: "%"   },
  { id: "T10Y2Y",      label: "10Y-2Y Spread",           unit: "%"   },
  { id: "CPIAUCSL",    label: "CPI (Index)",             unit: "idx" },
  { id: "UNRATE",      label: "Unemployment Rate",       unit: "%"   },
  { id: "DTWEXBGS",    label: "USD Broad Index (DXY-ish)", unit: "idx" },
  { id: "DCOILWTICO", label: "WTI Crude Oil",           unit: "USD" },
  { id: "VIXCLS",      label: "VIX",                     unit: "idx" },
];

async function fetchFred(seriesId: string) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FRED ${seriesId} ${r.status}`);
  const j = await r.json();
  const obs = j.observations?.[0];
  if (!obs || obs.value === "." ) return null;
  return { value: Number(obs.value), date: obs.date as string };
}

function classifyRegime(map: Record<string, number>): "bull"|"bear"|"neutral"|"volatile"|"crisis" {
  const vix = map["VIXCLS"] ?? 15;
  const spread = map["T10Y2Y"] ?? 0;
  if (vix >= 35) return "crisis";
  if (vix >= 25) return "volatile";
  if (spread < -0.5) return "bear";
  if (spread > 0.5 && vix < 18) return "bull";
  return "neutral";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (!FRED_API_KEY) throw new Error("FRED_API_KEY not configured");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const map: Record<string, number> = {};
    const rows: any[] = [];
    for (const s of SERIES) {
      try {
        const obs = await fetchFred(s.id);
        if (!obs) continue;
        map[s.id] = obs.value;
        rows.push({
          series_id: s.id,
          label: s.label,
          value: obs.value,
          unit: s.unit,
          observed_at: new Date(obs.date).toISOString(),
        });
      } catch (e) {
        console.error("FRED fetch failed", s.id, e);
      }
    }

    if (rows.length) {
      const { error } = await sb.from("macro_indicators")
        .upsert(rows, { onConflict: "series_id,observed_at" });
      if (error) throw error;
    }

    const regime = classifyRegime(map);

    // append a portfolio snapshot (carrying forward last equity/cash if exists)
    const { data: lastSnap } = await sb.from("portfolio_snapshots")
      .select("total_equity, cash, daily_pnl, daily_risk_used_pct")
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await sb.from("portfolio_snapshots").insert({
      total_equity: lastSnap?.total_equity ?? 100000,
      cash: lastSnap?.cash ?? 100000,
      daily_pnl: lastSnap?.daily_pnl ?? 0,
      daily_risk_used_pct: lastSnap?.daily_risk_used_pct ?? 0,
      regime,
    });

    await sb.from("system_health_log").insert({
      component: "macro-snapshot",
      status: "ok",
      message: `Synced ${rows.length}/${SERIES.length} FRED series; regime=${regime}`,
      metadata: { regime, count: rows.length },
    });

    return new Response(JSON.stringify({ ok: true, count: rows.length, regime, map }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
