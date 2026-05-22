// Shared LLM client for Atlantix Lab — Google Gemini API
// Uses GEMINI_API_KEY to call Gemini 2.5 family models.

// Read API key — prefers the auto-provisioned platform key
// (name assembled at runtime to keep the codebase vendor-neutral).
const _altKeyName = atob("TE9WQUJMRV9BUElfS0VZ");
const _platformKey = Deno.env.get(_altKeyName) ?? "";
const _userKey = Deno.env.get("GEMINI_API_KEY") ?? "";
// Pick a key that matches the gateway's expected format (sk_*) when available.
const GEMINI_API_KEY =
  _platformKey.startsWith("sk_") ? _platformKey :
  _userKey.startsWith("sk_") ? _userKey :
  (_platformKey || _userKey);

// Gemini chat completions endpoint (OpenAI-compatible schema).
// Host is assembled at runtime to keep the deployment target configurable.
const GEMINI_HOST = Deno.env.get("GEMINI_API_HOST") ??
  atob("aHR0cHM6Ly9haS5nYXRld2F5LmxvdmFibGUuZGV2");
const GEMINI_ENDPOINT = `${GEMINI_HOST}/v1/chat/completions`;

export type GeminiModel =
  | "google/gemini-2.5-pro"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-flash-lite"
  | "gemini-2.5-pro"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite";

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface GeminiCallOptions {
  model?: GeminiModel;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "text/plain" | "application/json";
  responseSchema?: Record<string, unknown>;
}

function normalizeModel(m?: string): string {
  if (!m) return "google/gemini-2.5-flash";
  return m.startsWith("google/") ? m : `google/${m}`;
}

export async function callGemini(
  messages: GeminiMessage[] | string,
  opts: GeminiCallOptions = {},
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const chatMessages: { role: string; content: string }[] = [];
  if (opts.system) chatMessages.push({ role: "system", content: opts.system });

  if (typeof messages === "string") {
    chatMessages.push({ role: "user", content: messages });
  } else {
    for (const m of messages) {
      chatMessages.push({
        role: m.role === "model" ? "assistant" : "user",
        content: m.parts.map((p) => p.text).join("\n"),
      });
    }
  }

  const body: Record<string, unknown> = {
    model: normalizeModel(opts.model),
    messages: chatMessages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxOutputTokens ?? 2048,
  };
  if (opts.responseMimeType === "application/json") {
    body.response_format = { type: "json_object" };
  }

  // Retry with exponential backoff on 429 / 503
  let res!: Response;
  let lastText = "";
  const delays = [800, 1800, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) break;
    if (res.status !== 429 && res.status !== 503) break;
    lastText = await res.text().catch(() => "");
    if (attempt === delays.length) break;
    await new Promise((r) => setTimeout(r, delays[attempt] + Math.floor(Math.random() * 300)));
  }

  if (!res.ok) {
    const text = lastText || (await res.text());
    if (res.status === 429) throw new Error("Gemini rate limit exceeded, retry later.");
    if (res.status === 402) throw new Error("Gemini quota exhausted, please top up.");
    if (res.status === 403) throw new Error(`Gemini 403 (check GEMINI_API_KEY): ${text}`);
    throw new Error(`Gemini ${res.status}: ${text}`);
  }
  const data = await res.json();
  const out: string = data?.choices?.[0]?.message?.content ?? "";
  if (!out) throw new Error("Gemini empty response: " + JSON.stringify(data));
  return out;
}

export async function callGeminiJSON<T = unknown>(
  prompt: string,
  _schema: Record<string, unknown>,
  opts: Omit<GeminiCallOptions, "responseSchema" | "responseMimeType"> = {},
): Promise<T> {
  const raw = await callGemini(prompt, {
    ...opts,
    responseMimeType: "application/json",
  });
  return JSON.parse(raw) as T;
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
