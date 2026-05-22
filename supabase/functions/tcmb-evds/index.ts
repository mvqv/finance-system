// Atlantix Lab — TCMB EVDS pull
// Pulls Turkish macro series from TCMB EVDS API (https://evds2.tcmb.gov.tr/)
// Series: politika faizi (1 hafta repo), TÜFE YoY, ÜFE YoY, TCMB brüt rezervler.
// Requires TCMB_EVDS_KEY secret (free, register at evds2.tcmb.gov.tr).
// Without the key, gracefully no-ops and logs a health warning.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TCMB_KEY = Deno.env.get("TCMB_EVDS_KEY") ?? "";

// EVDS series codes
const SERIES = [
  { code: "TP.APIFON1", id: "TCMB_POLICY_RATE", label: "TCMB 1W Repo (Politika Faizi)", unit: "%" },
  { code: "TP.FG.J0",   id: "TUIK_CPI_YOY",     label: "TÜFE Yıllık (CPI YoY)",         unit: "%" },
  { code: "TP.TUFE1YI.T1", id: "TUIK_PPI_YOY",  label: "ÜFE Yıllık (PPI YoY)",          unit: "%" },
  { code: "TP.AB.A1",   id: "TCMB_RESERVES",    label: "TCMB Brüt Rezervler",           unit: "USD mn" },
];

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

async function fetchSeries(code: string): Promise<{ value: number; date: string } | null> {
  if (!TCMB_KEY) return null;
  const end = new Date();
  const start = new Date(); start.setMonth(start.getMonth() - 6);
  const url = `https://evds2.tcmb.gov.tr/service/evds/series=${code}&startDate=${fmtDate(start)}&endDate=${fmtDate(end)}&type=json&key=${TCMB_KEY}`;
  try {
    const r = await fetch(url);
    if (!r.ok) { console.error(`EVDS ${code} HTTP ${r.status}`); return null; }
    const j = await r.json();
    const items = j?.items as Array<Record<string, unknown>> | undefined;
    if (!items?.length) return null;
    // find latest non-null value
    for (let i = items.length - 1; i >= 0; i--) {
      const row = items[i];
      const raw = row[code.replace(/\./g, "_")] ?? row[code];
      const v = typeof raw === "string" ? parseFloat(raw) : (typeof raw === "number" ? raw : NaN);
      if (!isNaN(v)) return { value: v, date: String(row.Tarih ?? "") };
    }
    return null;
  } catch (e) {
    console.error(`EVDS ${code} fetch failed`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!TCMB_KEY) {
      await sb.from("system_health_log").insert({
        component: "tcmb-evds",
        status: "warn",
        message: "TCMB_EVDS_KEY not configured — skipping EVDS pull",
      });
      return new Response(JSON.stringify({ ok: false, skipped: "no_key" }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const s of SERIES) {
      const got = await fetchSeries(s.code);
      if (got) {
        rows.push({
          series_id: s.id,
          label: s.label,
          value: got.value,
          unit: s.unit,
          observed_at: new Date().toISOString(),
        });
      }
    }

    if (rows.length) {
      const { error } = await sb.from("macro_indicators").insert(rows);
      if (error) throw error;
    }

    await sb.from("system_health_log").insert({
      component: "tcmb-evds",
      status: rows.length ? "ok" : "warn",
      message: `EVDS pull: ${rows.length}/${SERIES.length} series`,
      metadata: { fetched: rows.map((r) => r.series_id) },
    });

    return new Response(JSON.stringify({ ok: true, refreshed: rows.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
