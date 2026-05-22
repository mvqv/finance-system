// Embeddings via Google text-embedding-004 (768 dims).
// Uses GEMINI_API_KEY from project secrets.

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

export async function embedText(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text: text.slice(0, 8000) }] },
      taskType: "RETRIEVAL_DOCUMENT",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embedding ${res.status}: ${t}`);
  }
  const data = await res.json();
  const vec = data?.embedding?.values;
  if (!Array.isArray(vec)) throw new Error("Empty embedding response");
  return vec;
}
