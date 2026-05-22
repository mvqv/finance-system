import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS, callGeminiJSON } from "../_shared/gemini.ts";

interface RiskOutput {
  verdict: "approve" | "reject" | "reduce";
  max_position_pct: number;
  rationale: string;
  limits_used: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { idea_id, lang: rawLang } = await req.json();
    if (!idea_id) {
      return new Response(JSON.stringify({ error: "idea_id required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const lang = String(rawLang ?? "tr").toLowerCase().startsWith("tr") ? "tr" : "en";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: idea }, { data: snap }, { data: positions }] = await Promise.all([
      supabase.from("ideas").select("*").eq("id", idea_id).single(),
      supabase.from("portfolio_snapshots").select("*").order("snapshot_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("positions").select("*").is("closed_at", null),
    ]);
    if (!idea) throw new Error("idea not found");

    const t0 = Date.now();
    const langInstruction =
      lang === "tr"
        ? "Write the rationale entirely in Turkish. Do not include English headings/labels. Keep tickers and common finance abbreviations (NAV, FCF, P/E, stop-loss) as-is."
        : "Write the rationale in English.";
    const result = await callGeminiJSON<RiskOutput>(
      `You are the Risk Manager agent. Output strict JSON with keys: verdict (approve|reject|reduce), max_position_pct (0-25), rationale (1-3 sentences), limits_used (object).

Rules:
- Reject if invalidation is missing or asymmetric edge < 1.5.
- Reduce if regime is bear/crisis or daily_risk_used_pct > 60.
- Max single position = 8% normally, 4% in crisis.
- Penalize correlated exposure to existing positions.
${langInstruction}

Idea: ${JSON.stringify(idea)}
Portfolio snapshot: ${JSON.stringify(snap ?? null)}
Open positions: ${JSON.stringify(positions ?? [])}`,
      {},
      { model: "google/gemini-2.5-flash", temperature: 0.2, maxOutputTokens: 600 },
    );
    const latency = Date.now() - t0;

    const { data: ra, error } = await supabase
      .from("risk_assessments")
      .insert({
        idea_id,
        verdict: result.verdict,
        max_position_pct: result.max_position_pct,
        rationale: result.rationale,
        limits_used: { ...result.limits_used, latency_ms: latency },
      })
      .select("*")
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, assessment: ra }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
