#!/usr/bin/env node
/**
 * Atlantix Lab — Investment Committee CLI
 * Runs the 13-agent debate in your terminal with live streaming output.
 *
 * Usage:
 *   node scripts/committee.mjs --ticker AAPL --side long --thesis "Strong iPhone supercycle"
 *   node scripts/committee.mjs --ticker TSLA --side short --thesis "Margin compression from EV price war"
 *
 * Requires LOVABLE_API_KEY in .env (or set it directly below).
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env ────────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env");
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch { /* .env optional */ }

// ── ANSI colours ─────────────────────────────────────────────────────────────
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  // agent colours
  cio:     "\x1b[38;5;141m",   // purple
  bull:    "\x1b[38;5;82m",    // green
  bear:    "\x1b[38;5;196m",   // red
  macro:   "\x1b[38;5;39m",    // blue
  quant:   "\x1b[38;5;220m",   // yellow
  news:    "\x1b[38;5;208m",   // orange
  options: "\x1b[38;5;51m",    // cyan
  flow:    "\x1b[38;5;183m",   // lavender
  ops:     "\x1b[38;5;245m",   // grey
  risk:    "\x1b[38;5;214m",   // amber
  // stance
  for:     "\x1b[38;5;82m",
  against: "\x1b[38;5;196m",
  neutral: "\x1b[38;5;245m",
  caution: "\x1b[38;5;220m",
};

const AGENT_COLOR = {
  cio: C.cio, fundamental: C.bull, bear: C.bear,
  macro: C.macro, quant: C.quant, news: C.news,
  options: C.options, flow: C.flow, operations: C.ops, risk: C.risk,
};

// ── Agent definitions (mirrors run-committee edge function) ──────────────────
const AGENTS = [
  { kind: "cio",         name: "CIO Opening",                stance: "neutral", model: "flash",
    system: 'You are the CIO opening the investment committee. In 3-4 short sentences, frame the debate: state the idea in plain English, name the single biggest open question, and tell the Bull to go first and the Bear to immediately rebut. Direct, no fluff. Under 90 words.' },
  { kind: "fundamental", name: "Fundamental Bull (Opening)", stance: "for",     model: "flash",
    system: 'You are the Fundamental Bull. Build the strongest thesis using fundamentals, valuation, asymmetry. Be specific with numbers. End with: "Confidence: <0-100>". Under 180 words.' },
  { kind: "bear",        name: "Bear (Attack)",              stance: "against", model: "flash",
    system: 'You are the Bear. Attack the Bull\'s thesis above by NAME. Quote at least one specific number or claim from the Bull and explain why it\'s wrong. Find the killer risk. End with: "Confidence: <0-100>". Under 180 words.' },
  { kind: "fundamental", name: "Fundamental Bull (Rebuttal)",stance: "for",     model: "flash",
    system: 'You are the Fundamental Bull responding to the Bear. Address the Bear\'s two strongest points head-on — concede what\'s true, refute what\'s wrong, and tighten the thesis. Do NOT repeat your opening. End with: "Confidence: <0-100>". Under 150 words.' },
  { kind: "bear",        name: "Bear (Final)",               stance: "against", model: "flash",
    system: 'You are the Bear, final word before the analysts speak. The Bull just rebutted — push back one more time on what they conceded vs what\'s still hand-wavy. End with: "Confidence: <0-100>". Under 120 words.' },
  { kind: "macro",       name: "Macro Strategist",           stance: "neutral", model: "flash",
    system: 'You are Macro. Having read the Bull/Bear exchange, frame the idea in the current regime (rates, inflation, liquidity, USD, commodities). Say which side the regime favors. End with: "Confidence: <0-100>". Under 130 words.' },
  { kind: "quant",       name: "Quant Research",             stance: "neutral", model: "flash",
    system: 'You are Quant. Backtest analogs, factor exposure, vol, correlation, Kelly sizing. Cite the Bear\'s risk argument when relevant. End with: "Confidence: <0-100>". Under 130 words.' },
  { kind: "news",        name: "News & Sentiment",           stance: "neutral", model: "flash",
    system: 'You are News/Sentiment. Crowd positioning, narrative, consensus vs contrarian. End with: "Confidence: <0-100>". Under 110 words.' },
  { kind: "options",     name: "Options Desk",               stance: "neutral", model: "flash",
    system: 'You are Options. IV, skew, term structure, dealer gamma, suggest a cleaner expression if applicable. End with: "Confidence: <0-100>". Under 110 words.' },
  { kind: "flow",        name: "Flow",                       stance: "neutral", model: "flash",
    system: 'You are Flow. Dark pools, block prints, ETF/index flows, insider activity. End with: "Confidence: <0-100>". Under 110 words.' },
  { kind: "operations",  name: "Compliance",                 stance: "neutral", model: "flash",
    system: 'You are Compliance. Restricted lists, sanctions, conflicts. Output PASS or BLOCK with one-line reason. Under 60 words.' },
  { kind: "risk",        name: "Risk Officer",               stance: "neutral", model: "pro",
    system: 'You are the Risk Officer. Final synthesis after reading the full debate. Emit one of: APPROVE, REDUCE_SIZE, WAIT, REJECT, KILL_SWITCH. Specify max position size %, stop-loss, invalidation, and one-line rationale. Under 150 words.' },
  { kind: "cio",         name: "CIO Closing Memo",           stance: "neutral", model: "flash",
    system: 'You are the CIO closing the committee. Summarize: vote count (FOR / AGAINST / NEUTRAL), conviction (LOW/MEDIUM/HIGH), final action with size and stop, and the next review trigger. Under 110 words.' },
];

// ── Gemini call (streaming) ───────────────────────────────────────────────────
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callGeminiStream(prompt, systemPrompt, modelKey) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not set. Add it to .env or export it.");

  const model = modelKey === "pro"
    ? "google/gemini-2.5-pro"
    : "google/gemini-2.5-flash";

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.6,
      max_tokens: 512,
      messages: [
        { role: "system",    content: systemPrompt },
        { role: "user",      content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 402) throw new Error("Lovable AI credits exhausted.");
    if (res.status === 429) throw new Error("Rate limit — wait a moment and retry.");
    throw new Error(`Gateway ${res.status}: ${txt}`);
  }

  // Stream SSE chunks and print each token as it arrives
  let full = "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const chunk = JSON.parse(data);
        const token = chunk.choices?.[0]?.delta?.content ?? "";
        if (token) {
          process.stdout.write(token);
          full += token;
        }
      } catch { /* skip malformed chunk */ }
    }
  }

  return full;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractConfidence(text) {
  const m = text.match(/confidence[:\s]+(\d{1,3})/i);
  return m ? Math.min(100, Math.max(0, parseInt(m[1]))) : 60;
}

function parseVerdict(text) {
  if (/KILL[_ ]SWITCH/i.test(text)) return "KILL_SWITCH";
  if (/\bREJECT\b/i.test(text))     return "REJECT";
  if (/REDUCE[_ ]SIZE/i.test(text)) return "REDUCE_SIZE";
  if (/\bWAIT\b/i.test(text))       return "WAIT";
  return "APPROVE";
}

function stanceColor(stance) {
  if (stance === "for")     return C.for;
  if (stance === "against") return C.against;
  if (stance === "caution") return C.caution;
  return C.neutral;
}

function stanceLabel(stance) {
  if (stance === "for")     return "FOR    ";
  if (stance === "against") return "AGAINST";
  return "NEUTRAL";
}

function hr(char = "─", len = 72) {
  return char.repeat(len);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };
  return {
    ticker:      get("--ticker")      ?? get("-t") ?? "AAPL",
    side:        get("--side")        ?? get("-s") ?? "long",
    thesis:      get("--thesis")      ?? get("-T") ?? "Strong fundamentals and undervalued vs peers",
    trigger:     get("--trigger")     ?? "n/a",
    invalidation:get("--invalidation")?? "n/a",
    name:        get("--name")        ?? get("--ticker") ?? "AAPL",
    sector:      get("--sector")      ?? "Technology",
    lang:        get("--lang")        ?? get("-l") ?? "en",
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const idea = parseArgs();

  // Banner
  console.log(`\n${C.bold}${C.cio}╔${hr("═")}╗`);
  console.log(`║  ATLANTIX LAB — INVESTMENT COMMITTEE${" ".repeat(34)}║`);
  console.log(`╚${hr("═")}╝${C.reset}\n`);

  console.log(`${C.bold}  IDEA   ${C.reset}${idea.side.toUpperCase()} ${idea.ticker} · ${idea.name}`);
  console.log(`${C.bold}  SECTOR ${C.reset}${idea.sector}`);
  console.log(`${C.bold}  THESIS ${C.reset}${idea.thesis}`);
  if (idea.trigger !== "n/a")      console.log(`${C.bold}  TRIGGER${C.reset} ${idea.trigger}`);
  if (idea.invalidation !== "n/a") console.log(`${C.bold}  INVAL  ${C.reset} ${idea.invalidation}`);
  console.log(`\n  ${C.dim}${AGENTS.length} agents · Gemini 2.5 Flash/Pro · streaming${C.reset}\n`);
  console.log(C.dim + hr() + C.reset + "\n");

  const ctx = `IDEA: ${idea.side.toUpperCase()} ${idea.ticker} (${idea.name})
SECTOR: ${idea.sector}
THESIS: ${idea.thesis}
TRIGGER: ${idea.trigger}
INVALIDATION: ${idea.invalidation}`;

  const transcript = [];
  const scores = [];

  for (let i = 0; i < AGENTS.length; i++) {
    const agent = AGENTS[i];
    const color = AGENT_COLOR[agent.kind] ?? C.dim;
    const sc    = stanceColor(agent.stance);

    // Agent header
    const progress = `[${i + 1}/${AGENTS.length}]`;
    console.log(`${color}${C.bold}${hr("─")}${C.reset}`);
    console.log(
      `${color}${C.bold}  ${progress} ${agent.name.padEnd(32)}${C.reset}` +
      `${sc}${stanceLabel(agent.stance)}${C.reset}` +
      `  ${C.dim}${agent.model === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash"}${C.reset}`
    );
    console.log(`${color}${C.bold}${hr("─")}${C.reset}\n`);

    // Build prompt with rolling transcript
    const prior = transcript.length
      ? "\n\nPRIOR COMMITTEE TRANSCRIPT:\n" +
        transcript.map(t => `[${t.name}] ${t.text}`).join("\n\n")
      : "";
    const prompt = `${ctx}${prior}\n\nNow give YOUR analysis as ${agent.name}. End with: "Confidence: <0-100>".`;

    const t0 = Date.now();
    let text = "";

    try {
      // Stream tokens directly to stdout
      process.stdout.write("  ");
      text = await callGeminiStream(prompt, agent.system, agent.model);
      process.stdout.write("\n");
    } catch (err) {
      console.error(`\n${C.bear}  ERROR: ${err.message}${C.reset}`);
      process.exit(1);
    }

    const latency = ((Date.now() - t0) / 1000).toFixed(1);
    const conf    = extractConfidence(text);

    transcript.push({ name: agent.name, text });
    scores.push({ agent: agent.kind, name: agent.name, stance: agent.stance, conf, latency });

    console.log(
      `\n  ${C.dim}⏱  ${latency}s  ·  conf ${conf}${C.reset}\n`
    );
  }

  // ── Final verdict ────────────────────────────────────────────────────────
  const riskText = transcript.find(t => t.name === "Risk Officer")?.text ?? "";
  const verdict  = parseVerdict(riskText);

  const verdictColor =
    verdict === "APPROVE"      ? C.bull :
    verdict === "REDUCE_SIZE"  ? C.quant :
    verdict === "WAIT"         ? C.news :
    verdict === "REJECT"       ? C.bear :
    /* KILL_SWITCH */            C.bear;

  console.log(`\n${verdictColor}${C.bold}${hr("═")}${C.reset}`);
  console.log(`${verdictColor}${C.bold}  COMMITTEE VERDICT: ${verdict}${C.reset}`);
  console.log(`${verdictColor}${C.bold}${hr("═")}${C.reset}\n`);

  // Score table
  console.log(`${C.bold}  AGENT SCORECARD${C.reset}`);
  console.log(`  ${C.dim}${"Agent".padEnd(28)} ${"Stance".padEnd(10)} Conf  Time${C.reset}`);
  console.log(`  ${C.dim}${hr("·", 52)}${C.reset}`);
  for (const s of scores) {
    const color = AGENT_COLOR[s.agent] ?? C.dim;
    const sc    = stanceColor(s.stance);
    console.log(
      `  ${color}${s.name.padEnd(28)}${C.reset}` +
      `${sc}${stanceLabel(s.stance).padEnd(10)}${C.reset}` +
      `${String(s.conf).padStart(3)}   ${s.latency}s`
    );
  }

  console.log(`\n  ${C.dim}Done. ${AGENTS.length} agents · idea: ${idea.side.toUpperCase()} ${idea.ticker}${C.reset}\n`);
}

main().catch(err => {
  console.error(`\n\x1b[31mFatal: ${err.message}\x1b[0m\n`);
  process.exit(1);
});
