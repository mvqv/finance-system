export const AGENT_LABELS: Record<string, string> = {
  cio: "CIO Orchestrator",
  macro: "Macro Strategist",
  fundamental: "Fundamental Analyst",
  news: "News & NLP",
  options: "Options / Volatility",
  flow: "Flow & Liquidity",
  quant: "Quant Research",
  bear: "Bear Case",
  risk: "Risk Manager",
  portfolio: "Portfolio Manager",
  execution: "Execution",
  operations: "Operations",
  memory: "Memory & Journal",
};

export const AGENT_COLOR_VAR: Record<string, string> = {
  cio: "var(--agent-cio)",
  macro: "var(--agent-macro)",
  fundamental: "var(--agent-fundamental)",
  news: "var(--agent-news)",
  options: "var(--agent-options)",
  flow: "var(--agent-flow)",
  quant: "var(--agent-quant)",
  bear: "var(--agent-bear)",
  risk: "var(--agent-risk)",
  portfolio: "var(--agent-portfolio)",
};

export const REGIME_LABEL: Record<string, string> = {
  risk_on: "Risk-On",
  risk_off: "Risk-Off",
  neutral: "Neutral",
  inflation_shock: "Inflation Shock",
  liquidity_squeeze: "Liquidity Squeeze",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  researching: "Researching",
  debating: "Debating",
  risk_review: "Risk Review",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  rejected: "Rejected",
  executed: "Executed",
  closed: "Closed",
  invalidated: "Invalidated",
};

export function formatCurrency(n: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(n);
}

export function formatPct(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function edgeTier(score: number | null | undefined): "strong" | "mid" | "weak" {
  if (!score) return "weak";
  if (score >= 75) return "strong";
  if (score >= 55) return "mid";
  return "weak";
}
