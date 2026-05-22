// Quote provider cascade: Finnhub -> Yahoo Finance -> null.
// Yahoo is free and keyless via the v8 chart endpoint.

const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");

export interface Quote {
  price: number;
  prevClose?: number;
  volume?: number;
  source: "finnhub" | "yahoo";
}

async function quoteFinnhub(symbol: string): Promise<Quote | null> {
  if (!FINNHUB_API_KEY) return null;
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const c = Number(j.c);
    if (!Number.isFinite(c) || c <= 0) return null;
    return {
      price: c,
      prevClose: Number.isFinite(Number(j.pc)) ? Number(j.pc) : undefined,
      source: "finnhub",
    };
  } catch {
    return null;
  }
}

async function quoteYahoo(symbol: string): Promise<Quote | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "application/json",
        },
      },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const result = j?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta || {};
    const price = Number(meta.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      price,
      prevClose: Number.isFinite(Number(meta.chartPreviousClose))
        ? Number(meta.chartPreviousClose)
        : undefined,
      volume: Number.isFinite(Number(meta.regularMarketVolume))
        ? Number(meta.regularMarketVolume)
        : undefined,
      source: "yahoo",
    };
  } catch {
    return null;
  }
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const q = await quoteFinnhub(symbol);
  if (q) return q;
  // Try Yahoo with the raw symbol first, then with .IS suffix for BIST tickers
  const yahooQ = await quoteYahoo(symbol);
  if (yahooQ) return yahooQ;
  // BIST tickers need .IS suffix on Yahoo Finance (e.g. AKBNK → AKBNK.IS)
  if (!symbol.includes(".")) {
    const withIS = await quoteYahoo(`${symbol}.IS`);
    if (withIS) return withIS;
  }
  return null;
}

// Daily history from Yahoo for feature computation.
export interface Candle {
  t: number; // unix seconds
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export async function yahooHistory(
  symbol: string,
  range = "3mo",
  interval = "1d",
): Promise<Candle[]> {
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    },
  );
  if (!r.ok) return [];
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  if (!result) return [];
  const ts: number[] = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const out: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = Number(q.close?.[i]);
    if (!Number.isFinite(c)) continue;
    out.push({
      t: ts[i],
      o: Number(q.open?.[i] ?? c),
      h: Number(q.high?.[i] ?? c),
      l: Number(q.low?.[i] ?? c),
      c,
      v: Number(q.volume?.[i] ?? 0),
    });
  }
  return out;
}
