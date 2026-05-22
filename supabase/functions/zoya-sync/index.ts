// Atlantix Lab — Zoya Sync
// Fetches real Shariah compliance data from Zoya Sandbox/Live API
// and updates the shariah columns in the assets table.
//
// Zoya API docs: https://developer.zoya.finance/docs
// Sandbox endpoint: https://sandbox-api.zoya.finance/graphql
// Live endpoint:    https://api.zoya.finance/graphql
//
// Auth: Authorization header = your API key (no "Bearer" prefix)
// Sandbox key format: sandbox-XXXX
// Live key format:    live-XXXX
//
// Data provided by Zoya — https://zoya.finance/api

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ZOYA_API_KEY should be set in Supabase project secrets.
// Sandbox key: sandbox-01e5ee6d-86f7-4294-a360-27b2365b3145
// Live key:    live-XXXX (requires paid subscription)
const ZOYA_API_KEY = Deno.env.get("ZOYA_API_KEY");

// Auto-detect sandbox vs live from key prefix
function getZoyaEndpoint(key: string): string {
  return key.startsWith("sandbox-")
    ? "https://sandbox-api.zoya.finance/graphql"
    : "https://api.zoya.finance/graphql";
}

// ── Zoya response types ───────────────────────────────────────────────────────
type ZoyaStatus = "COMPLIANT" | "NON_COMPLIANT" | "QUESTIONABLE" | "UNRATED";

interface ZoyaBasicReport {
  symbol: string;
  name: string;
  exchange: string;
  status: ZoyaStatus;
  purificationRatio: number | null;
  reportDate: string | null;
}

interface ZoyaAdvancedReport extends ZoyaBasicReport {
  businessScreen: ZoyaStatus;
  financialScreen: ZoyaStatus;
  compliantRevenue: number | null;
  nonCompliantRevenue: number | null;
  questionableRevenue: number | null;
  // AAOIFIReport fragment fields
  debtToMarketCapRatio: number | null;
  securitiesToMarketCapRatio: number | null;
}

// ── Normalize Zoya status → our DB enum ──────────────────────────────────────
function normalizeStatus(
  s: string | null | undefined,
): "compliant" | "non-compliant" | "questionable" | null {
  switch ((s ?? "").toUpperCase()) {
    case "COMPLIANT":
      return "compliant";
    case "NON_COMPLIANT":
      return "non-compliant";
    case "QUESTIONABLE":
      return "questionable";
    default:
      return null;
  }
}

// ── GraphQL query: basicCompliance.report (one ticker at a time) ──────────────
// The basic package gives us: status + purificationRatio
// We use this for the sandbox (which only has basicCompliance)
const BASIC_REPORT_QUERY = `
  query GetReport($symbol: String!) {
    basicCompliance {
      report(symbol: $symbol) {
        symbol
        name
        exchange
        status
        purificationRatio
        reportDate
      }
    }
  }
`;

// ── GraphQL query: advancedCompliance.report (one ticker, AAOIFI) ─────────────
// Gives us: debtToMarketCapRatio, securitiesToMarketCapRatio, nonCompliantRevenue
// Requires advanced subscription (live key)
const ADVANCED_REPORT_QUERY = `
  query GetAdvancedReport($symbol: String!) {
    advancedCompliance {
      report(input: { symbol: $symbol, methodology: AAOIFI }) {
        symbol
        name
        exchange
        status
        reportDate
        businessScreen
        financialScreen
        compliantRevenue
        nonCompliantRevenue
        questionableRevenue
        purificationRatio
        ... on AAOIFIReport {
          debtToMarketCapRatio
          securitiesToMarketCapRatio
        }
      }
    }
  }
`;

// ── Execute a single GraphQL request against Zoya ────────────────────────────
async function zoyaGraphQL(
  endpoint: string,
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Zoya uses the key directly — no "Bearer" prefix
      "Authorization": apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  // GraphQL always returns 200; errors are in the body
  const json = await res.json() as { data?: unknown; errors?: Array<{ message: string }> };

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Zoya GraphQL error: ${msg}`);
  }

  return json.data;
}

// ── Fetch one ticker via basicCompliance (sandbox-compatible) ─────────────────
async function fetchBasicReport(
  endpoint: string,
  apiKey: string,
  symbol: string,
): Promise<ZoyaBasicReport | null> {
  try {
    const data = await zoyaGraphQL(endpoint, apiKey, BASIC_REPORT_QUERY, { symbol }) as any;
    return data?.basicCompliance?.report ?? null;
  } catch (e) {
    console.error(`basicCompliance.report failed for ${symbol}:`, e);
    return null;
  }
}

// ── Fetch one ticker via advancedCompliance (live key required) ───────────────
async function fetchAdvancedReport(
  endpoint: string,
  apiKey: string,
  symbol: string,
): Promise<ZoyaAdvancedReport | null> {
  try {
    const data = await zoyaGraphQL(endpoint, apiKey, ADVANCED_REPORT_QUERY, { symbol }) as any;
    return data?.advancedCompliance?.report ?? null;
  } catch (e) {
    // Advanced may fail on sandbox — fall back gracefully
    console.warn(`advancedCompliance.report failed for ${symbol} (expected on sandbox):`, e);
    return null;
  }
}

// ── Deterministic mock for when ZOYA_API_KEY is not set at all ────────────────
function mockReport(ticker: string): {
  status: "compliant" | "non-compliant" | "questionable" | null;
  debt_to_market_cap: number | null;
  interest_bearing_cash: number | null;
  haram_revenue_pct: number | null;
  purification_ratio: number | null;
} {
  const t = ticker.toUpperCase();
  const NON_COMPLIANT = ["TLT", "BND", "AGG", "LQD", "HYG", "SCHW", "BAC", "JPM", "GS", "MS"];
  const QUESTIONABLE = ["XOM", "CVX", "SLB", "USO", "BP", "SHEL", "COP", "MPC"];

  if (NON_COMPLIANT.includes(t)) {
    return { status: "non-compliant", debt_to_market_cap: 0.85, interest_bearing_cash: 0.42, haram_revenue_pct: 100, purification_ratio: 1.0 };
  }
  if (QUESTIONABLE.includes(t)) {
    return { status: "questionable", debt_to_market_cap: 0.28, interest_bearing_cash: 0.05, haram_revenue_pct: 8.5, purification_ratio: 0.085 };
  }
  return { status: "compliant", debt_to_market_cap: 0.12, interest_bearing_cash: 0.03, haram_revenue_pct: 0, purification_ratio: 0 };
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const tickers: string[] = (body?.tickers ?? [])
      .map((t: string) => t.trim().toUpperCase())
      .filter(Boolean);

    if (!tickers.length) {
      return new Response(
        JSON.stringify({ error: "tickers array required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const isMock = !ZOYA_API_KEY;
    const isSandbox = ZOYA_API_KEY?.startsWith("sandbox-") ?? false;
    const endpoint = ZOYA_API_KEY ? getZoyaEndpoint(ZOYA_API_KEY) : "";

    const results: Array<{
      ticker: string;
      shariah_status: string | null;
      debt_to_market_cap: number | null;
      interest_bearing_cash: number | null;
      haram_revenue_pct: number | null;
      purification_ratio: number | null;
      source: "live" | "sandbox" | "mock";
    }> = [];

    for (const ticker of tickers) {
      let row: {
        shariah_status: string | null;
        debt_to_market_cap: number | null;
        interest_bearing_cash: number | null;
        haram_revenue_pct: number | null;
        purification_ratio: number | null;
      };
      let source: "live" | "sandbox" | "mock";

      if (isMock) {
        // No API key at all — use deterministic mock
        const m = mockReport(ticker);
        row = m;
        source = "mock";
      } else if (isSandbox) {
        // Sandbox key: use basicCompliance (sandbox supports this)
        // Try advanced too — it may return partial data on sandbox
        const [basic, advanced] = await Promise.all([
          fetchBasicReport(endpoint, ZOYA_API_KEY!, ticker),
          fetchAdvancedReport(endpoint, ZOYA_API_KEY!, ticker),
        ]);

        const report = advanced ?? basic;
        if (!report) {
          // Ticker not found in Zoya — skip update, record as null
          results.push({
            ticker,
            shariah_status: null,
            debt_to_market_cap: null,
            interest_bearing_cash: null,
            haram_revenue_pct: null,
            purification_ratio: null,
            source: "sandbox",
          });
          continue;
        }

        row = {
          shariah_status: normalizeStatus(report.status),
          // Advanced fields (null on sandbox basic-only response)
          debt_to_market_cap: (advanced as ZoyaAdvancedReport | null)?.debtToMarketCapRatio ?? null,
          // securitiesToMarketCapRatio maps to interest_bearing_cash (closest AAOIFI equivalent)
          interest_bearing_cash: (advanced as ZoyaAdvancedReport | null)?.securitiesToMarketCapRatio ?? null,
          haram_revenue_pct: (advanced as ZoyaAdvancedReport | null)?.nonCompliantRevenue ?? null,
          purification_ratio: report.purificationRatio ?? null,
        };
        source = "sandbox";
      } else {
        // Live key: try advanced first, fall back to basic
        const advanced = await fetchAdvancedReport(endpoint, ZOYA_API_KEY!, ticker);
        const basic = advanced ? null : await fetchBasicReport(endpoint, ZOYA_API_KEY!, ticker);
        const report = advanced ?? basic;

        if (!report) {
          results.push({
            ticker,
            shariah_status: null,
            debt_to_market_cap: null,
            interest_bearing_cash: null,
            haram_revenue_pct: null,
            purification_ratio: null,
            source: "live",
          });
          continue;
        }

        row = {
          shariah_status: normalizeStatus(report.status),
          debt_to_market_cap: (advanced as ZoyaAdvancedReport | null)?.debtToMarketCapRatio ?? null,
          interest_bearing_cash: (advanced as ZoyaAdvancedReport | null)?.securitiesToMarketCapRatio ?? null,
          haram_revenue_pct: (advanced as ZoyaAdvancedReport | null)?.nonCompliantRevenue ?? null,
          purification_ratio: report.purificationRatio ?? null,
        };
        source = "live";
      }

      // Write to assets table
      const { error } = await supa
        .from("assets")
        .update({
          shariah_status: row.shariah_status,
          debt_to_market_cap: row.debt_to_market_cap,
          interest_bearing_cash: row.interest_bearing_cash,
          haram_revenue_pct: row.haram_revenue_pct,
        })
        .eq("ticker", ticker);

      if (error) {
        console.error(`DB update failed for ${ticker}:`, error.message);
      }

      results.push({ ticker, ...row, source });
    }

    const synced = results.filter((r) => r.shariah_status !== null).length;

    return new Response(
      JSON.stringify({
        ok: true,
        synced,
        total: tickers.length,
        mode: isMock ? "mock" : isSandbox ? "sandbox" : "live",
        // Attribution required by Zoya API terms
        attribution: "Data provided by Zoya — https://zoya.finance/api",
        results,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("zoya-sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
