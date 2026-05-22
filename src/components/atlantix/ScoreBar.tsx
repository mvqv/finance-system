export function ScoreBar({
  value,
  label,
  tone = "atlantix",
}: {
  value: number | null | undefined;
  label: string;
  tone?: "atlantix" | "risk" | "edge" | "bull" | "bear";
}) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const colorMap = {
    atlantix: "var(--atlantix)",
    risk: v < 35 ? "var(--risk-green)" : v < 65 ? "var(--risk-yellow)" : "var(--risk-red)",
    edge: v >= 75 ? "var(--edge-strong)" : v >= 55 ? "var(--edge-mid)" : "var(--edge-weak)",
    bull: "var(--bull)",
    bear: "var(--bear)",
  };
  const color = colorMap[tone];
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {value ?? "—"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
