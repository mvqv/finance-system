import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS, callGemini } from "../_shared/gemini.ts";
import { embedText } from "../_shared/embed.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { query, asset_id, idea_id, k = 5, summarize = true } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const embedding = await embedText(query);
    const { data: matches, error } = await supabase.rpc("match_research_documents", {
      query_embedding: embedding,
      match_count: k,
      filter_asset: asset_id ?? null,
      filter_idea: idea_id ?? null,
    });
    if (error) throw error;

    let answer: string | null = null;
    if (summarize && matches && matches.length > 0) {
      const ctx = matches
        .map(
          (m: { title: string; content: string; kind: string }, i: number) =>
            `[#${i + 1} ${m.kind}] ${m.title}\n${m.content}`,
        )
        .join("\n\n---\n\n");
      answer = await callGemini(
        `User question: ${query}\n\nUse only the context below. Cite sources by [#N]. If insufficient, say so.\n\nContext:\n${ctx}`,
        { model: "google/gemini-2.5-flash", temperature: 0.3, maxOutputTokens: 1024 },
      );
    }

    return new Response(JSON.stringify({ matches: matches ?? [], answer }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
