// Atlantix Lab — generic cron tick endpoint
// Called by pg_cron with body { job: "<name>" }. Bypasses auth via /api/public/*.
// Each job invokes one or more edge functions via the admin client (bypasses verify_jwt).

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type JobName =
  | "stop-loss"
  | "macro-us"
  | "macro-tr"
  | "news"
  | "kap"
  | "try-crisis"
  | "features"
  | "fundamentals"
  | "portfolio-sync"
  | "daily-snapshot";

async function runJob(job: JobName) {
  const inv = (name: string, body: Record<string, unknown> = {}) =>
    supabaseAdmin.functions.invoke(name, { body });

  switch (job) {
    case "stop-loss":
      return await inv("stop-loss-watcher");
    case "macro-us":
      return await inv("macro-snapshot");
    case "macro-tr":
      return await inv("tr-macro-snapshot");
    case "news":
      return await inv("ingest-news");
    case "kap":
      return await inv("kap-news");
    case "try-crisis":
      return await inv("try-crisis-monitor");
    case "features":
      return await inv("feature-snapshot");
    case "fundamentals":
      return await inv("fundamental-snapshot");
    case "portfolio-sync":
      return await inv("broker-sync-portfolio");
    case "daily-snapshot": {
      // chain a few in sequence: portfolio sync → features → fundamentals
      const a = await inv("broker-sync-portfolio");
      const b = await inv("feature-snapshot");
      const c = await inv("fundamental-snapshot");
      return { data: { portfolio: a.data, features: b.data, fundamentals: c.data }, error: null };
    }
    default:
      throw new Error(`unknown job: ${job}`);
  }
}

export const Route = createFileRoute("/api/public/hooks/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let job: JobName | undefined;
        try {
          const body = await request.json() as { job?: JobName };
          job = body.job;
        } catch {
          // ignore
        }
        if (!job) {
          return new Response(JSON.stringify({ error: "missing job" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }
        const started = Date.now();
        try {
          const result = await runJob(job);
          await supabaseAdmin.from("system_health_log").insert({
            component: `cron:${job}`,
            status: result?.error ? "red" : "green",
            message: result?.error ? String(result.error) : "ok",
            metadata: { ms: Date.now() - started },
          });
          return new Response(JSON.stringify({ ok: !result?.error, job, ms: Date.now() - started, result: result?.data ?? null }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await supabaseAdmin.from("system_health_log").insert({
            component: `cron:${job}`,
            status: "red",
            message: msg,
          });
          return new Response(JSON.stringify({ ok: false, job, error: msg }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => new Response(JSON.stringify({ ok: true, hint: "POST { job }" }), {
        headers: { "Content-Type": "application/json" },
      }),
    },
  },
});
