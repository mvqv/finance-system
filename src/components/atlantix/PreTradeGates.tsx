import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export type Gate = {
  key: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail?: string;
};

export function PreTradeGates({ gates }: { gates: Gate[] }) {
  const failed = gates.filter((g) => g.status === "fail").length;
  const warned = gates.filter((g) => g.status === "warn").length;
  const allClear = failed === 0 && warned === 0;

  return (
    <div className="rounded-md border bg-surface-2">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-atlantix">Pre-Trade Gates</span>
        <span
          className="rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
          style={{
            backgroundColor: allClear ? "hsl(var(--bull) / 0.12)" : failed ? "hsl(var(--bear) / 0.12)" : "hsl(var(--warning) / 0.12)",
            color: allClear ? "hsl(var(--bull))" : failed ? "hsl(var(--bear))" : "hsl(var(--warning))",
            border: `1px solid ${allClear ? "hsl(var(--bull))" : failed ? "hsl(var(--bear))" : "hsl(var(--warning))"}`,
          }}
        >
          {allClear ? "ALL CLEAR" : failed ? `${failed} BLOCKED` : `${warned} WARNINGS`}
        </span>
      </div>
      <ul className="divide-y">
        {gates.map((g) => (
          <li key={g.key} className="flex items-start gap-2.5 px-4 py-2.5">
            {g.status === "pass" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-bull" strokeWidth={1.6} />}
            {g.status === "fail" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bear" strokeWidth={1.6} />}
            {g.status === "warn" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.6} />}
            <div className="flex-1">
              <div className="text-sm">{g.label}</div>
              {g.detail && <div className="font-mono text-[10px] text-muted-foreground">{g.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
