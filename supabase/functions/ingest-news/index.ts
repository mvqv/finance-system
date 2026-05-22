// Atlantix Lab — Ingest News
// Fetches headlines from NewsAPI (primary) and Yahoo Finance (fallback / supplement)
// for watchlist + open positions tickers, scores them with Gemini
// (sentiment + importance), upserts into events.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CORS, callGeminiJSON } from "../_shared/gemini.ts";

const NEWSAPI_KEY = Deno.env.get("NEWSAPI_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Article {
  title: string;
  description?: string;
  url: string;
  publishedAt: string;
  source: string;
}

async function fetchNewsAPI(q: string, pageSize = 5): Promise<Article[]> {
  if (!NEWSAPI_KEY) return [];
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${NEWSAPI_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.articles || []).map((a: any) => ({
      title: a.title,
      description: a.description || "",
      url: a.url,
      publishedAt: a.publishedAt,
      source: a.source?.name || "NewsAPI",
    }));
  } catch (e) {
    console.error("NewsAPI failed", q, e);
    return [];
  }
}

async function fetchYahooNews(ticker: string, count = 6): Promise<Article[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=${count}&quotesCount=0`;
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.news || []).map((n: any) => ({
      title: n.title,
      description: n.summary || "",
      url: n.link,
      publishedAt: new Date((n.providerPublishTime || 0) * 1000).toISOString(),
      source: n.publisher || "Yahoo Finance",
    }));
  } catch (e) {
    console.error("Yahoo news failed", ticker, e);
    return [];
  }
}

async function scoreArticle(title: string, desc: string) {
  try {
    const prompt = `Headline: ${title}\nSummary: ${desc}\n\nReturn JSON {"sentiment": number from -1 to 1, "importance": integer 0..100, "summary": one sentence}.`;
    const out = await callGeminiJSON<{ sentiment: number; importance: number; summary: string }>(
      prompt,
      {},
      { model: "google/gemini-2.5-flash-lite", maxOutputTokens: 200 },
    );
    return {
      sentiment: Math.max(-1, Math.min(1, Number(out.sentiment) || 0)),
      importance: Math.max(0, Math.min(100, Math.round(out.importance || 50))),
      summary: out.summary || desc,
    };
  } catch (e) {
    console.error("score failed", e);
    return { sentiment: 0, importance: 50, summary: desc };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    let tickers: string[] = Array.isArray(body.tickers) ? body.tickers : [];

    if (!tickers.length) {
      const { data: wl } = await sb.from("watchlist").select("assets:asset_id(ticker)");
      const { data: pos } = await sb
        .from("positions")
        .select("assets:asset_id(ticker)")
        .is("closed_at", null);
      const set = new Set<string>();
      (wl || []).forEach((r: any) => r.assets?.ticker && set.add(r.assets.ticker));
      (pos || []).forEach((r: any) => r.assets?.ticker && set.add(r.assets.ticker));
      tickers = Array.from(set).slice(0, 10);
    }

    if (!tickers.length) {
      return new Response(JSON.stringify({ ok: true, ingested: 0, note: "no tickers" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let ingested = 0;
    const bySource: Record<string, number> = {};
    const errors: any[] = [];

    for (const ticker of tickers) {
      const { data: asset } = await sb.from("assets").select("id").eq("ticker", ticker).maybeSingle();
      const assetId = asset?.id ?? null;

      // Primary: NewsAPI. Fallback / supplement: Yahoo (free, no key).
      const [newsapi, yahoo] = await Promise.all([
        fetchNewsAPI(ticker, 5),
        fetchYahooNews(ticker, 6),
      ]);

      // Dedupe by URL across providers.
      const seen = new Set<string>();
      const articles: Article[] = [];
      for (const a of [...newsapi, ...yahoo]) {
        if (!a.url || seen.has(a.url)) continue;
        seen.add(a.url);
        articles.push(a);
      }

      if (!articles.length) {
        errors.push({ ticker, error: "no articles from any source" });
        continue;
      }

      for (const a of articles) {
        const scored = await scoreArticle(a.title, a.description || "");
        const { error } = await sb.from("events").upsert(
          {
            asset_id: assetId,
            event_type: "news",
            headline: a.title.slice(0, 500),
            summary: scored.summary,
            source: a.source,
            url: a.url,
            importance: scored.importance,
            sentiment: scored.sentiment,
            occurred_at: a.publishedAt,
            metadata: { ticker, provider: a.source },
          },
          { onConflict: "url" },
        );
        if (!error) {
          ingested++;
          bySource[a.source] = (bySource[a.source] || 0) + 1;
        } else {
          errors.push({ ticker, url: a.url, error: error.message });
        }
      }
    }

    await sb.from("system_health_log").insert({
      component: "ingest-news",
      status: ingested > 0 ? "ok" : "error",
      message: `Ingested ${ingested} articles for ${tickers.length} tickers`,
      metadata: { tickers, ingested, bySource, errors: errors.slice(0, 10) },
    });

    return new Response(JSON.stringify({ ok: true, ingested, tickers, bySource, errors }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
