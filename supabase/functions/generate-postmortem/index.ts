import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS, callGeminiJSON } from "../_shared/gemini.ts";
import { embedText } from "../_shared/embed.ts";

interface PMOutput {
  summary: string;
  what_worked: string;
  what_failed: string;
  lessons: string;
  score: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { idea_id } = await req.json();
    if (!idea_id) {
      return new Response(JSON.stringify({ error: "idea_id required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [idea, memo, debates, risk, orders, journal, positions] = await Promise.all([
      supabase.from("ideas").select("*").eq("id", idea_id).single(),
      supabase.from("investment_memos").select("*").eq("idea_id", idea_id).maybeSingle(),
      supabase.from("agent_debates").select("*").eq("idea_id", idea_id),
      supabase.from("risk_assessments").select("*").eq("idea_id", idea_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("orders").select("*").eq("idea_id", idea_id),
      supabase.from("trade_journal").select("*").eq("idea_id", idea_id),
      supabase.from("positions").select("*").eq("idea_id", idea_id),
    ]);

    const t0 = Date.now();
    const out = await callGeminiJSON<PMOutput>(
      `Generate a trade post-mortem as strict JSON: { summary, what_worked, what_failed, lessons, score (0-100) }.
Be specific, reference numbers and dates. Score reflects process quality, not outcome.

Idea: ${JSON.stringify(idea.data)}
Memo: ${JSON.stringify(memo.data)}
Debates: ${JSON.stringify(debates.data)}
Risk: ${JSON.stringify(risk.data)}
Orders: ${JSON.stringify(orders.data)}
Positions: ${JSON.stringify(positions.data)}
Journal: ${JSON.stringify(journal.data)}`,
      {},
      { model: "google/gemini-2.5-pro", temperature: 0.4, maxOutputTokens: 1500 },
    );
    const latency = Date.now() - t0;

    const tjId = journal.data?.[0]?.id ?? null;
    const { data: pm, error } = await supabase
      .from("postmortems")
      .upsert(
        {
          idea_id,
          trade_journal_id: tjId,
          summary: out.summary,
          what_worked: out.what_worked,
          what_failed: out.what_failed,
          lessons: out.lessons,
          score: out.score,
          generated_by_model: "google/gemini-2.5-pro",
          latency_ms: latency,
        },
        { onConflict: "idea_id" },
      )
      .select("*")
      .single();
    if (error) throw error;

    // Index post-mortem into RAG memory
    try {
      const text = `Summary: ${out.summary}\n\nWorked: ${out.what_worked}\n\nFailed: ${out.what_failed}\n\nLessons: ${out.lessons}`;
      const embedding = await embedText(text);
      await supabase.from("research_documents").insert({
        kind: "postmortem",
        title: `Post-mortem: ${idea.data?.title ?? idea_id}`,
        content: text,
        asset_id: idea.data?.asset_id ?? null,
        idea_id,
        embedding,
        metadata: { score: out.score },
      });
    } catch (_) {
      // Non-fatal: post-mortem still saved
    }

    return new Response(JSON.stringify({ ok: true, postmortem: pm }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
