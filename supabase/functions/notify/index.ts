import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID");
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_TO = Deno.env.get("NOTIFY_EMAIL_TO");

export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!TG_TOKEN || !TG_CHAT) return { ok: false, error: "Telegram not configured" };
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML" }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}

export async function sendEmail(
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_KEY || !NOTIFY_TO) return { ok: false, error: "Resend not configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Atlantix <onboarding@resend.dev>",
      to: [NOTIFY_TO],
      subject,
      html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${
        body.replace(/</g, "&lt;")
      }</pre>`,
    }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { channel = "both", subject, body, level = "info" } = await req.json();
    if (!subject || !body) {
      return new Response(JSON.stringify({ error: "subject and body required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const text = `[${level.toUpperCase()}] ${subject}\n\n${body}`;
    const results: Record<string, unknown> = {};
    if (channel === "telegram" || channel === "both") {
      results.telegram = await sendTelegram(text);
    }
    if (channel === "email" || channel === "both") {
      results.email = await sendEmail(`[${level}] ${subject}`, body);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("audit_log").insert({
      action: "notify",
      target_type: "notification",
      payload: { subject, level, channel, results },
    });
    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
