// Atlantix Lab — auto-postmortem hook
// Called by DB trigger on positions.closed_at via pg_net.
// Body: { idea_id, position_id }

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/postmortem")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { idea_id?: string; position_id?: string } = {};
        try {
          payload = await request.json();
        } catch {
          // ignore
        }
        const idea_id = payload.idea_id;
        if (!idea_id) {
          return new Response(JSON.stringify({ error: "idea_id required" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        // Skip if a postmortem already exists for this idea
        const { data: existing } = await supabaseAdmin
          .from("postmortems")
          .select("id")
          .eq("idea_id", idea_id)
          .maybeSingle();
        if (existing) {
          return new Response(JSON.stringify({ ok: true, skipped: "exists" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabaseAdmin.functions.invoke("generate-postmortem", {
          body: { idea_id },
        });
        await supabaseAdmin.from("system_health_log").insert({
          component: "auto-postmortem",
          status: error ? "red" : "green",
          message: error ? String(error.message ?? error) : `generated for ${idea_id}`,
          metadata: { idea_id, position_id: payload.position_id ?? null },
        });
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: String(error.message ?? error) }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
