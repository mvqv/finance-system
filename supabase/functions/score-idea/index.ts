// Computes real, transparent scores for an idea (delegates to shared scoring lib).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeScores } from "../_shared/scoring.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let ids: string[] = [];
    if (body.idea_id) ids = [body.idea_id];
    else if (body.all) {
      const { data } = await supa.from("ideas").select("id");
      // deno-lint-ignore no-explicit-any
      ids = (data ?? []).map((x: any) => x.id);
    } else throw new Error("provide idea_id or all=true");

    const results = [];
    for (const id of ids) {
      try { results.push(await computeScores(supa, id)); }
      catch (e) { results.push({ idea_id: id, error: String((e as Error).message) }); }
    }
    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
