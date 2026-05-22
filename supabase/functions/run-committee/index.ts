// Atlantix Lab — Run Investment Committee
// Orchestrates agents (CIO, Macro, Fundamental, News, Options, Flow, Quant, Bear, Risk)
// debating an idea via Gemini, then writes a risk verdict.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callGemini, CORS } from "../_shared/gemini.ts";
import { computeScores } from "../_shared/scoring.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AgentDef {
  kind: string; // agent_kind enum
  name: string;
  stance: "for" | "against" | "neutral";
  system: string;
}

// Multi-round debate: opening → bull thesis → bear attack → bull rebuttal → bear rebuttal →
// macro/quant/news/options/flow color → compliance → risk verdict → CIO closing memo.
const AGENTS: AgentDef[] = [
  { kind: "cio", name: "CIO Opening", stance: "neutral", system: "You are the CIO opening the investment committee. In 3-4 short sentences, frame the debate: state the idea in plain English, name the single biggest open question, and tell the Bull to go first and the Bear to immediately rebut. Direct, no fluff. Under 90 words." },
  { kind: "fundamental", name: "Fundamental Bull (Opening)", stance: "for", system: "You are the Fundamental Bull. Build the strongest thesis using fundamentals, valuation, asymmetry. Be specific with numbers. End with: \"Confidence: <0-100>\". Under 180 words." },
  { kind: "bear", name: "Bear (Attack)", stance: "against", system: "You are the Bear. Attack the Bull's thesis above by NAME. Quote at least one specific number or claim from the Bull and explain why it's wrong. Find the killer risk. End with: \"Confidence: <0-100>\". Under 180 words." },
  { kind: "fundamental", name: "Fundamental Bull (Rebuttal)", stance: "for", system: "You are the Fundamental Bull responding to the Bear. Address the Bear's two strongest points head-on — concede what's true, refute what's wrong, and tighten the thesis. Do NOT repeat your opening. End with: \"Confidence: <0-100>\". Under 150 words." },
  { kind: "bear", name: "Bear (Final)", stance: "against", system: "You are the Bear, final word before the analysts speak. The Bull just rebutted — push back one more time on what they conceded vs what's still hand-wavy. End with: \"Confidence: <0-100>\". Under 120 words." },
  { kind: "macro", name: "Macro Strategist", stance: "neutral", system: "You are Macro. Having read the Bull/Bear exchange, frame the idea in the current regime (rates, inflation, liquidity, USD, commodities). Say which side the regime favors. End with: \"Confidence: <0-100>\". Under 130 words." },
  { kind: "quant", name: "Quant Research", stance: "neutral", system: "You are Quant. Backtest analogs, factor exposure, vol, correlation, Kelly sizing. Cite the Bear's risk argument when relevant. End with: \"Confidence: <0-100>\". Under 130 words." },
  { kind: "news", name: "News & Sentiment", stance: "neutral", system: "You are News/Sentiment. Crowd positioning, narrative, consensus vs contrarian. End with: \"Confidence: <0-100>\". Under 110 words." },
  { kind: "options", name: "Options Desk", stance: "neutral", system: "You are Options. IV, skew, term structure, dealer gamma, suggest a cleaner expression if applicable. End with: \"Confidence: <0-100>\". Under 110 words." },
  { kind: "flow", name: "Flow", stance: "neutral", system: "You are Flow. Dark pools, block prints, ETF/index flows, insider activity. End with: \"Confidence: <0-100>\". Under 110 words." },
  { kind: "operations", name: "Compliance", stance: "neutral", system: "You are Compliance. Restricted lists, sanctions, conflicts. Output PASS or BLOCK with one-line reason. Under 60 words." },
  { kind: "risk", name: "Risk Officer", stance: "neutral", system: "You are the Risk Officer. Final synthesis after reading the full debate. Emit one of: APPROVE, REDUCE_SIZE, WAIT, REJECT, KILL_SWITCH. Specify max position size %, stop-loss, invalidation, and one-line rationale. Under 150 words." },
  { kind: "cio", name: "CIO Closing Memo", stance: "neutral", system: "You are the CIO closing the committee. Summarize: vote count (FOR / AGAINST / NEUTRAL), conviction (LOW/MEDIUM/HIGH), final action with size and stop, and the next review trigger. Under 110 words." },
];

function parseVerdict(text: string): "approve"|"reduce_size"|"wait"|"reject"|"kill_switch" {
  if (/KILL[_ ]SWITCH/i.test(text)) return "kill_switch";
  if (/FATWA[:\s]+BLOCK/i.test(text)) return "reject"; // Shariah Scholar block
  if (/\bREJECT\b/i.test(text)) return "reject";
  if (/REDUCE[_ ]SIZE/i.test(text)) return "reduce_size";
  if (/\bWAIT\b/i.test(text)) return "wait";
  return "approve";
}

function extractConfidence(text: string): number {
  const m = text.match(/(?:confidence|güven)[:\s]+(\d{1,3})/i);
  if (m) return Math.min(100, Math.max(0, parseInt(m[1])));
  return 60;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { idea_id, lang: rawLang, isShariahModeEnabled, owner_id: rawOwnerId } = await req.json();
    if (!idea_id) throw new Error("idea_id required");
    const lang = String(rawLang ?? "en").toLowerCase().startsWith("tr") ? "tr" : "en";
    const shariahMode = Boolean(isShariahModeEnabled);

    // owner_id: use what the client sends, fall back to the known single-owner UUID.
    // Edge functions run as service_role so auth.uid() = null — we must carry owner_id explicitly.
    const FALLBACK_OWNER = "be7e0b13-f952-4dbf-a2c6-333d56c53ed8";
    const owner_id: string = (typeof rawOwnerId === "string" && rawOwnerId.length > 0)
      ? rawOwnerId
      : FALLBACK_OWNER;

    // Language instruction appended to every agent system prompt so it wins over
    // older English wording such as "plain English" inside the role prompts.
    const langInstruction = lang === "tr"
      ? "\n\nKRİTİK DİL KURALI: Kullanıcı arayüzünde Türkçe seçili. Nihai cevabını SADECE TÜRKÇE yaz. İngilizce rol talimatları, 'plain English', 'End with Confidence' veya İngilizce başlık istekleri geçersizdir. Sadece teknik kısaltmalar ve piyasa terimleri (FCF, NAV, P/E, EBITDA, stop-loss, USD/TRY, AKBNK vb.) İngilizce kalabilir. Güven skorunu mutlaka 'Güven: <0-100>' formatında bitir. Veri eksikse 'EKSİK VERİ:' satırı ile hangi kaynağa ihtiyacın olduğunu yaz (örn: TEFAS NAV geçmişi, KAP bildirimi, TCMB EVDS, BIST hacim, fon faktsheet)."
      : "";

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: idea, error: ideaErr } = await supa
      .from("ideas")
      .select("*, assets(id, ticker, name, sector, asset_class, country, currency, exchange, metadata, shariah_status, debt_to_market_cap, interest_bearing_cash, haram_revenue_pct)")
      .eq("id", idea_id)
      .single();
    if (ideaErr || !idea) throw new Error(`idea not found: ${ideaErr?.message}`);

    await supa.from("ideas").update({ status: "debating" }).eq("id", idea_id);
    await supa.from("agent_debates").delete().eq("idea_id", idea_id);

    const asset = idea.assets as {
      id?: string; ticker?: string; name?: string; sector?: string;
      asset_class?: string; country?: string; currency?: string;
      exchange?: string; metadata?: Record<string, unknown>;
      shariah_status?: string | null;
      debt_to_market_cap?: number | null;
      interest_bearing_cash?: number | null;
      haram_revenue_pct?: number | null;
    };
    const isTR = asset?.country === "TR" || (idea.market ?? "").toUpperCase() === "BIST";
    const isFund = (asset?.asset_class ?? "").toLowerCase().includes("fund")
      || (asset?.asset_class ?? "").toLowerCase() === "etf";

    // ---- Pull market data context so agents don't hallucinate ----
    const [{ data: feats }, { data: trMacro }, { data: usMacro }, { data: assetEvents }] = await Promise.all([
      asset?.id
        ? supa.from("asset_features").select("metadata, latest_close, vol_20d, momentum_5d, momentum_20d, dist_52w_high, dist_52w_low, rvol")
            .eq("asset_id", asset.id).order("as_of", { ascending: false }).limit(1)
        : Promise.resolve({ data: [] as any[] }),
      isTR
        ? supa.from("macro_indicators").select("label, value, unit, observed_at")
            .or("series_id.ilike.tr_%,series_id.ilike.tcmb_%,series_id.ilike.bist_%,label.ilike.%TR%")
            .order("observed_at", { ascending: false }).limit(12)
        : Promise.resolve({ data: [] as any[] }),
      !isTR
        ? supa.from("macro_indicators").select("label, value, unit, observed_at")
            .order("observed_at", { ascending: false }).limit(8)
        : Promise.resolve({ data: [] as any[] }),
      asset?.id
        ? supa.from("events").select("headline, source, occurred_at, importance, sentiment")
            .eq("asset_id", asset.id).order("occurred_at", { ascending: false }).limit(8)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const f = (feats as any[])?.[0];
    const fundamentals = (f?.metadata as any)?.fundamentals
      ?? (asset?.metadata as any)?.fundamentals;
    const haveQuote = Number.isFinite(Number(f?.latest_close));
    const haveFundamentals = !!fundamentals && Object.keys(fundamentals).length > 0;
    const haveMacro = (isTR ? (trMacro?.length ?? 0) : (usMacro?.length ?? 0)) > 0;
    const haveNews = (assetEvents?.length ?? 0) > 0;

    const dataBlock = [
      haveQuote ? `QUOTE: close=${f.latest_close} vol20d=${f.vol_20d ?? "n/a"} mom5=${f.momentum_5d ?? "n/a"} mom20=${f.momentum_20d ?? "n/a"} 52wHi=${f.dist_52w_high ?? "n/a"} 52wLo=${f.dist_52w_low ?? "n/a"} rvol=${f.rvol ?? "n/a"}` : "QUOTE: MISSING",
      haveFundamentals ? `FUNDAMENTALS: ${JSON.stringify(fundamentals)}` : "FUNDAMENTALS: MISSING",
      haveMacro ? `MACRO (${isTR ? "TR" : "US"}): ${(isTR ? trMacro : usMacro)!.map((m: any) => `${m.label}=${m.value}${m.unit ?? ""}`).join(" | ")}` : `MACRO (${isTR ? "TR" : "US"}): MISSING`,
      haveNews ? `RECENT NEWS:\n${assetEvents!.map((e: any) => `- [${e.source ?? "?"}] ${e.headline}`).join("\n")}` : "RECENT NEWS: MISSING",
    ].join("\n");

    // Catalog of data sources agents can cite when something is missing.
    const sourceCatalog = isTR
      ? `DATA SOURCES (cite by name when missing): TEFAS (Türkiye fund NAV & flows), KAP (material disclosures, BIST filings), TCMB EVDS (rates, FX, reserves), BIST (price & volume), Borsa İstanbul fund factsheet, SPK bulletin, TÜİK (CPI/GDP). For mutual/pension funds also: fund manager monthly report, TEFAS holdings, fund prospectus.`
      : `DATA SOURCES (cite by name when missing): Finnhub (quote+fundamentals), Yahoo Finance (history), SEC EDGAR (10-K/10-Q/8-K), FRED (macro), company IR deck, sell-side consensus, options chain (CBOE), 13F filings, ETF holdings.`;

    const fundNote = isFund
      ? `\nNOTE: This is a FUND/ETF, not a single stock. Discuss NAV, holdings concentration, expense ratio, tracking error, fund flows, manager track record — NOT single-name P/E.`
      : "";

    const trNote = isTR
      ? `\nMARKET: Türkiye / BIST. Currency: ${asset?.currency ?? "TRY"}. All price/PnL reasoning must account for TRY inflation, USD/TRY moves, TCMB policy stance, and KAP disclosure timing.`
      : "";

    const ctx = `IDEA: ${String(idea.side).toUpperCase()} ${asset?.ticker} (${asset?.name})
SECTOR: ${asset?.sector} | CLASS: ${asset?.asset_class} | COUNTRY: ${asset?.country ?? "?"} | EXCHANGE: ${asset?.exchange ?? "?"}
THESIS: ${idea.thesis}
TRIGGER: ${idea.trigger ?? "n/a"}
INVALIDATION: ${idea.invalidation ?? "n/a"}${fundNote}${trNote}${
  shariahMode
    ? `\n\nSHARIAH GUARD MODE: ACTIVE
SHARIAH STATUS: ${asset?.shariah_status ?? "unknown"}
DEBT/MARKET-CAP: ${asset?.debt_to_market_cap != null ? (asset.debt_to_market_cap * 100).toFixed(1) + "%" : "n/a"}
INTEREST-BEARING CASH: ${asset?.interest_bearing_cash != null ? (asset.interest_bearing_cash * 100).toFixed(1) + "%" : "n/a"}
HARAM REVENUE: ${asset?.haram_revenue_pct != null ? asset.haram_revenue_pct.toFixed(1) + "%" : "n/a"}
NOTE: Short selling is PROHIBITED in Shariah mode. Options Desk is SKIPPED.`
    : ""
}

MARKET DATA SNAPSHOT:
${dataBlock}

${sourceCatalog}

INSTRUCTION FOR EVERY AGENT: If you do NOT have the data you need to make your call, do NOT invent numbers. Instead, write a line beginning with "MISSING DATA:" and list the specific source/API needed (pick from the catalog above). Then make the best judgement you can with what IS available and lower your confidence accordingly.`;

    const transcript: { name: string; text: string }[] = [];

    for (const agent of AGENTS) {
      // ── SHARIAH GUARD: Options Desk is skipped in Shariah mode ──────────────
      if (shariahMode && agent.kind === "options" && agent.name === "Options Desk") {
        transcript.push({
          name: agent.name,
          text: "[SKIPPED — Options Desk is not active in Strict Shariah Mode. Derivatives and options are not permissible under Islamic finance principles.]",
        });
        await supa.from("agent_debates").insert({
          idea_id,
          agent: agent.kind,
          stance: agent.stance,
          argument: "[SKIPPED — Options Desk is not active in Strict Shariah Mode.]",
          confidence: 0,
          model: "gemini-2.5-flash",
          latency_ms: 0,
          owner_id,
        });
        continue;
      }

      const t0 = Date.now();
      const prior = transcript.length
        ? "\n\nPRIOR COMMITTEE TRANSCRIPT:\n" + transcript.map(t => `[${t.name}] ${t.text}`).join("\n\n")
        : "";
      const langSuffix = lang === "tr"
        ? "\n\nYANIT DİLİ: TÜRKÇE. İngilizce yazma. Tüm analizini Türkçe üret ve güven skorunu şu şekilde bitir: \"Güven: <0-100>\""
        : "\n\nEnd with: \"Confidence: <0-100>\".";

      // ── SHARIAH GUARD: Compliance agent gets Shariah Scholar role ────────────
      let agentSystem = agent.system + langInstruction;
      if (shariahMode && agent.kind === "operations" && agent.name === "Compliance") {
        const shariahStatus = asset?.shariah_status ?? "unknown";
        const isNonCompliant = shariahStatus === "non-compliant";
        agentSystem = `You are a Shariah Scholar and Compliance Officer reviewing this investment idea under Islamic finance principles (AAOIFI standards).

SHARIAH METRICS:
- Shariah Status: ${shariahStatus}
- Debt/Market-Cap: ${asset?.debt_to_market_cap != null ? (asset.debt_to_market_cap * 100).toFixed(1) + "%" : "n/a"} (threshold: <33%)
- Interest-Bearing Cash: ${asset?.interest_bearing_cash != null ? (asset.interest_bearing_cash * 100).toFixed(1) + "%" : "n/a"} (threshold: <33%)
- Haram Revenue: ${asset?.haram_revenue_pct != null ? asset.haram_revenue_pct.toFixed(1) + "%" : "n/a"} (threshold: <5%)

${isNonCompliant
  ? "The asset is classified as NON-COMPLIANT. You MUST output: FATWA: BLOCK — followed by a one-line reason citing the specific metric that fails the screen."
  : "Review the metrics above. If any threshold is breached, output FATWA: BLOCK. If all metrics pass, output PASS with a one-line Shariah compliance note."
}

Also check: no short selling (prohibited), no interest-based instruments, no excessive gharar (uncertainty). Under 80 words.${langInstruction}`;
      }

      const prompt = `${ctx}${prior}\n\nNow give YOUR analysis as ${agent.name}.${langSuffix}`;

      const model = agent.kind === "risk" ? "gemini-2.5-pro" : "gemini-2.5-flash";
      const text = await callGemini(prompt, { system: agentSystem, model, temperature: 0.6, maxOutputTokens: 4096 });
      const latency = Date.now() - t0;

      transcript.push({ name: agent.name, text });

      await supa.from("agent_debates").insert({
        idea_id,
        agent: agent.kind,
        stance: agent.stance,
        argument: text,
        confidence: extractConfidence(text),
        model,
        latency_ms: latency,
        owner_id,
      });
    }

    const riskTurn = transcript.find(t => t.name === "Risk Officer") ?? transcript[transcript.length - 1];
    const verdict  = parseVerdict(riskTurn.text);
    const sizeMatch = riskTurn.text.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
    const maxSize = sizeMatch ? parseFloat(sizeMatch[1]) : 5;

    // Translate rationale to Turkish if requested
    let rationale = riskTurn.text.slice(0, 2000);
    if (lang === "tr") {
      try {
        const translated = await callGemini(
          `Translate the following investment committee risk verdict to Turkish. Keep financial terms (FCF, NAV, P/E, stop-loss, etc.) in English. Only output the translation, nothing else.\n\n${rationale}`,
          { model: "gemini-2.5-flash", temperature: 0.2, maxOutputTokens: 1024 },
        );
        rationale = translated.slice(0, 2000);
      } catch (e) {
        console.error("Translation failed, using English:", e);
      }
    }

    await supa.from("risk_assessments").insert({
      idea_id,
      verdict,
      rationale,
      max_position_pct: maxSize,
      owner_id,
    });

    // Always set to awaiting_approval — human makes the final call
    await supa.from("ideas").update({ status: "awaiting_approval" }).eq("id", idea_id);

    // Compute real scores from debates + risk + features (in-process, no HTTP hop)
    try {
      await computeScores(supa, idea_id);
    } catch (e) {
      console.error("computeScores failed:", e);
    }

    return new Response(
      JSON.stringify({ ok: true, verdict, rounds: transcript.length }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("run-committee error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
