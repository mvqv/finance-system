import { ScrollText } from "lucide-react";

export type MemoSections = {
  thesis?: string;
  facts?: string;
  for_arguments?: string;
  against_arguments?: string;
  analogs?: string;
  priced_in?: string;
  market_missed?: string;
  main_risk?: string;
  invalidation?: string;
  verdict?: string;
};

const ORDER: Array<{ key: keyof MemoSections; label: string }> = [
  { key: "thesis", label: "1. Thesis" },
  { key: "facts", label: "2. Facts" },
  { key: "for_arguments", label: "3. Arguments For" },
  { key: "against_arguments", label: "4. Arguments Against" },
  { key: "analogs", label: "5. Historical Analogs" },
  { key: "priced_in", label: "6. What's Priced In" },
  { key: "market_missed", label: "7. What Market May Have Missed" },
  { key: "main_risk", label: "8. Main Risk" },
  { key: "invalidation", label: "9. Invalidation Conditions" },
  { key: "verdict", label: "10. Final Verdict" },
];

export function InvestmentMemo({ content, ticker, side }: { content: Record<string, string> | MemoSections; ticker?: string; side?: string }) {
  const c = content as Record<string, string>;
  return (
    <div className="rounded-md border bg-surface-2">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-atlantix" strokeWidth={1.5} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-atlantix">Investment Memo</span>
        </div>
        {ticker && (
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
            <span className="rounded bg-surface px-1.5 py-0.5">{ticker}</span>
            {side && <span className={side === "long" ? "text-bull" : "text-bear"}>{side}</span>}
          </div>
        )}
      </div>
      <div className="divide-y">
        {ORDER.map(({ key, label }) => {
          const value = c?.[key as string] ?? c?.[label.replace(/^\d+\.\s*/, "").toLowerCase().replace(/\s+/g, "_")];
          return (
            <div key={key} className="px-4 py-3">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
              <div className="mt-1 whitespace-pre-line text-sm text-foreground/90">
                {value || <span className="italic text-muted-foreground">— not provided —</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
