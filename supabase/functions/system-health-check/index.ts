// Atlantix Lab — System health check (writes one row per component)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callGemini, CORS } from "../_shared/gemini.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type HealthStatus = "green"|"yellow"|"red"|"black";
type HealthRow = { component: string; status: HealthStatus; message?: string; metadata?: Record<string, unknown> };

async function probe(
  component: string,
  fn: () => Promise<{ status: HealthStatus; message?: string }>,
  out: HealthRow[],
) {
  const t = Date.now();
  try {
    const r = await fn();
    out.push({ component, status: r.status, message: r.message, metadata: { ms: Date.now() - t } });
  } catch (e) {
    out.push({ component, status: "red", message: e instanceof Error ? e.message : String(e), metadata: { ms: Date.now() - t } });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: HealthRow[] = [];

  // DB
  const t0 = Date.now();
  try {
    const { error } = await supa.from("assets").select("id").limit(1);
    results.push({ component: "database", status: error ? "red" : "green", message: error?.message, metadata: { ms: Date.now() - t0 } });
  } catch (e) { results.push({ component: "database", status: "red", message: String(e) }); }

  // Gemini
  const t1 = Date.now();
  try {
    await callGemini("OK", { maxOutputTokens: 4, temperature: 0 });
    results.push({ component: "gemini", status: "green", metadata: { ms: Date.now() - t1 } });
  } catch (e) {
    results.push({ component: "gemini", status: "red", message: e instanceof Error ? e.message : String(e) });
  }

  // Kill switch
  try {
    const { data } = await supa.from("kill_switch_state").select("*").limit(1).maybeSingle();
    results.push({ component: "kill_switch", status: data?.engaged ? "black" : "green", message: data?.engaged ? "ENGAGED" : "inactive" });
  } catch { results.push({ component: "kill_switch", status: "yellow", message: "no state" }); }

  // FRED
  await probe("fred", async () => {
    const k = Deno.env.get("FRED_API_KEY");
    if (!k) return { status: "yellow", message: "no key" };
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=${k}&file_type=json&limit=1`);
    return { status: r.ok ? "green" : "red", message: r.ok ? undefined : `HTTP ${r.status}` };
  }, results);

  // NewsAPI
  await probe("newsapi", async () => {
    const k = Deno.env.get("NEWSAPI_KEY");
    if (!k) return { status: "yellow", message: "no key" };
    const r = await fetch(`https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${k}`);
    return { status: r.ok ? "green" : "red", message: r.ok ? undefined : `HTTP ${r.status}` };
  }, results);

  // Finnhub
  await probe("finnhub", async () => {
    const k = Deno.env.get("FINNHUB_API_KEY");
    if (!k) return { status: "yellow", message: "no key" };
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${k}`);
    return { status: r.ok ? "green" : "red", message: r.ok ? undefined : `HTTP ${r.status}` };
  }, results);

  // Alpaca
  await probe("alpaca", async () => {
    const id = Deno.env.get("ALPACA_KEY_ID");
    const sec = Deno.env.get("ALPACA_SECRET_KEY");
    if (!id || !sec) return { status: "yellow", message: "no keys" };
    const r = await fetch("https://paper-api.alpaca.markets/v2/account", {
      headers: { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": sec },
    });
    return { status: r.ok ? "green" : "red", message: r.ok ? undefined : `HTTP ${r.status}` };
  }, results);

  await supa.from("system_health_log").insert(results);

  const worstRank = { green: 0, yellow: 1, red: 2, black: 3 } as const;
  const worst = results.reduce((acc, r) => worstRank[r.status] > worstRank[acc] ? r.status : acc, "green" as keyof typeof worstRank);

  return new Response(JSON.stringify({ overall: worst, results }),
    { headers: { ...CORS, "Content-Type": "application/json" } });
});
