// Shared scoring logic — computes real edge/risk/consensus/timing/liquidity scores
// from agent_debates + risk_assessments + asset_features. Imported by both
// score-idea and run-committee so the latter can rescore in-process.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const avg = (arr: number[]) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
const stdev = (arr: number[]) => {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(avg(arr.map((x) => (x - m) ** 2)));
};

const VERDICT_RISK: Record<string, number> = {
  approve: 25, reduce_size: 50, wait: 65, reject: 90, kill_switch: 100,
  pass: 25, reduce: 50, fail: 90,
};

export async function computeScores(supa: SupabaseClient, idea_id: string) {
  const { data: idea, error: iErr } = await supa
    .from("ideas").select("*, assets(id, ticker)").eq("id", idea_id).single();
  if (iErr || !idea) throw new Error(`idea not found: ${iErr?.message}`);

  const [{ data: debates }, { data: risks }, { data: feats }] = await Promise.all([
    supa.from("agent_debates").select("agent, stance, confidence").eq("idea_id", idea_id),
    supa.from("risk_assessments").select("verdict, max_position_pct, created_at")
      .eq("idea_id", idea_id).order("created_at", { ascending: false }).limit(1),
    idea.asset_id
      ? supa.from("asset_features").select("*")
          .eq("asset_id", idea.asset_id).order("as_of", { ascending: false }).limit(1)
      // deno-lint-ignore no-explicit-any
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // deno-lint-ignore no-explicit-any
  const confs = (debates ?? []).map((d: any) => Number(d.confidence ?? 0)).filter((n: number) => n > 0);
  // deno-lint-ignore no-explicit-any
  const forC = (debates ?? []).filter((d: any) => d.stance === "for").map((d: any) => Number(d.confidence ?? 0));
  // deno-lint-ignore no-explicit-any
  const againstC = (debates ?? []).filter((d: any) => d.stance === "against").map((d: any) => Number(d.confidence ?? 0));

  const consensus_score = confs.length ? Math.round(clamp(100 - stdev(confs) * 2.5)) : null;
  const confidence = confs.length ? Math.round(avg(confs)) : null;
  const edgeRaw = (forC.length ? avg(forC) : 50) - (againstC.length ? avg(againstC) : 50);
  const edge_score = confs.length ? Math.round(clamp(50 + edgeRaw * 0.6)) : null;

  const verdict = risks?.[0]?.verdict as string | undefined;
  const baseRisk = verdict ? VERDICT_RISK[verdict] ?? 60 : null;
  // deno-lint-ignore no-explicit-any
  const f = (feats as any[])?.[0];
  const volAdj = f?.vol_20d ? clamp((Number(f.vol_20d) - 15) * 1.2, -15, 25) : 0;
  const risk_score = baseRisk == null ? null : Math.round(clamp(baseRisk + volAdj));

  let timing_score: number | null = null;
  if (f) {
    const mom5 = Number(f.momentum_5d ?? 0);
    const mom20 = Number(f.momentum_20d ?? 0);
    const distHigh = Number(f.dist_52w_high ?? 0);
    const distLow = Number(f.dist_52w_low ?? 0);
    const longBias = mom5 * 2 + mom20 + (distHigh + 10) * 1.5 + Math.min(distLow, 50) * 0.2;
    const score = idea.side === "short" ? -longBias : longBias;
    timing_score = Math.round(clamp(50 + score));
  }

  let liquidity_score: number | null = null;
  if (f && f.latest_close && f.latest_volume) {
    const dollarVol = Number(f.latest_close) * Number(f.latest_volume);
    liquidity_score = Math.round(clamp((Math.log10(Math.max(dollarVol, 1)) - 5) * 25));
  }

  let asymmetry: number | null = null;
  const maxSize = Number(risks?.[0]?.max_position_pct ?? 0);
  if (verdict && verdict !== "reject" && verdict !== "kill_switch" && risk_score) {
    asymmetry = Number(((100 - risk_score) / Math.max(risk_score, 1)).toFixed(2));
  } else if (maxSize > 0 && risk_score) {
    asymmetry = Number(((100 - risk_score) / Math.max(risk_score, 1)).toFixed(2));
  }

  const patch: Record<string, unknown> = {
    edge_score, risk_score, consensus_score, timing_score, liquidity_score,
    confidence_score: confidence, confidence, asymmetry,
  };
  Object.keys(patch).forEach((k) => patch[k] == null && delete patch[k]);

  if (Object.keys(patch).length) {
    const { error } = await supa.from("ideas").update(patch).eq("id", idea_id);
    if (error) throw error;
  }
  return { idea_id, ...patch, debates: debates?.length ?? 0, has_features: !!f, has_risk: !!verdict };
}
