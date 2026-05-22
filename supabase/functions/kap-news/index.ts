// Atlantix Lab — KAP (Kamuyu Aydınlatma Platformu) news ingestion.
// Pulls latest özel durum açıklamaları from KAP public API and stores them
// as events. Optionally enriches with TR-aware sentiment via Lovable AI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS } from "../_shared/gemini.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

interface KapDisclosure {
  disclosureIndex?: number;
  publishDate?: string;
  kapTitle?: string;
  subject?: string;
  stockCodes?: string;
  summary?: string;
  companyName?: string;
}

async function fetchKap(): Promise<KapDisclosure[]> {
  // KAP public disclosure search endpoint (POST). Returns recent items.
  const body = {
    fromDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10),
    toDate:   new Date().toISOString().slice(0, 10),
    year: "",
    prd: "",
    term: "",
    ruleType: "",
    bdkReview: "",
    disclosureClass: "",
    index: "",
    market: "",
    isLate: "",
    subjectList: [],
    mkkMemberOidList: [],
    inactiveMkkMemberOidList: [],
    bdkMemberOidList: [],
    mainSector: "",
    sector: "",
    subSector: "",
    memberType: "IGS",
    fromSrc: "N",
    srcCategory: "",
    discIndex: [],
  };
  try {
    const r = await fetch("https://www.kap.org.tr/tr/api/disclosures/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.error("KAP HTTP", r.status);
      return [];
    }
    const j = await r.json();
    const list = Array.isArray(j) ? j : (j?.disclosures ?? []);
    return list.slice(0, 30) as KapDisclosure[];
  } catch (e) {
    console.error("KAP fetch failed", e);
    return [];
  }
}

async function tagSentiment(headline: string, summary: string): Promise<{ sentiment: number; importance: number }> {
  if (!GEMINI_API_KEY) return { sentiment: 0, importance: 50 };
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: "You are a TR-finance NLP tagger. Reply ONLY JSON {\"sentiment\":-1..1,\"importance\":0..100}. Bias importance higher for guidance, M&A, capital raises, dividend, regulatory, going-concern." }] },
        contents: [{ role: "user", parts: [{ text: `KAP açıklaması:\nBaşlık: ${headline}\nÖzet: ${summary}` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    });
    const j = await r.json();
    const txt = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "{}";
    const p = JSON.parse(txt);
    return {
      sentiment: Math.max(-1, Math.min(1, Number(p.sentiment ?? 0))),
      importance: Math.max(0, Math.min(100, Math.round(Number(p.importance ?? 50)))),
    };
  } catch { return { sentiment: 0, importance: 50 }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const items = await fetchKap();

    // Build ticker → asset_id map for BIST stocks
    const { data: assets } = await sb
      .from("assets")
      .select("id, ticker")
      .eq("country", "TR");
    const tickerMap = new Map((assets ?? []).map((a) => [a.ticker, a.id]));

    let inserted = 0;
    for (const d of items) {
      const headline = d.kapTitle || d.subject || d.companyName || "KAP disclosure";
      const summary  = d.summary || d.subject || "";
      const ticker   = (d.stockCodes || "").split(",")[0]?.trim()?.toUpperCase() || null;
      const assetId  = ticker ? tickerMap.get(ticker) ?? null : null;

      const { sentiment, importance } = await tagSentiment(headline, summary);

      const { error } = await sb.from("events").insert({
        event_type: "kap_disclosure",
        headline,
        summary,
        source: "KAP",
        url: d.disclosureIndex
          ? `https://www.kap.org.tr/tr/Bildirim/${d.disclosureIndex}`
          : "https://www.kap.org.tr",
        sentiment,
        importance,
        asset_id: assetId,
        occurred_at: d.publishDate ? new Date(d.publishDate).toISOString() : new Date().toISOString(),
        metadata: { kap_index: d.disclosureIndex, ticker, company: d.companyName },
      });
      if (!error) inserted++;
    }

    await sb.from("system_health_log").insert({
      component: "kap-news",
      status: "ok",
      message: `Ingested ${inserted}/${items.length} KAP disclosures`,
      metadata: { fetched: items.length, inserted },
    });

    return new Response(JSON.stringify({ ok: true, fetched: items.length, inserted }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
