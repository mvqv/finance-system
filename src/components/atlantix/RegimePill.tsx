import { useTranslation } from "react-i18next";

export function RegimePill({ regime }: { regime: string }) {
  const { t } = useTranslation();
  const colorMap: Record<string, string> = {
    risk_on: "var(--regime-risk-on)",
    risk_off: "var(--regime-risk-off)",
    neutral: "var(--regime-neutral)",
    inflation_shock: "var(--regime-inflation)",
    liquidity_squeeze: "var(--regime-risk-off)",
  };
  const color = colorMap[regime] ?? "var(--regime-neutral)";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md border bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-widest"
      style={{ borderColor: color, color }}
    >
      <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: color }} />
      {t(`regime.${regime}`, regime)}
    </span>
  );
}
