import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";
import { embedText } from "../_shared/embed.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { kind, title, content, asset_id, idea_id, metadata } = await req.json();
    if (!kind || !title || !content) {
      return new Response(JSON.stringify({ error: "kind, title, content required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const embedding = await embedText(`${title}\n\n${content}`);
    const { data, error } = await supabase
      .from("research_documents")
      .insert({
        kind,
        title,
        content,
        asset_id: asset_id ?? null,
        idea_id: idea_id ?? null,
        embedding,
        metadata: metadata ?? {},
      })
      .select("id")
      .single();
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
