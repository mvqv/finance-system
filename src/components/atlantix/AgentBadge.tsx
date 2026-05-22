import { AGENT_COLOR_VAR } from "@/lib/atlantix";
import { useTranslation } from "react-i18next";

export function AgentBadge({ agent, size = "md" }: { agent: string; size?: "sm" | "md" }) {
  const { t } = useTranslation();
  const label = t(`agentChat.agents.${agent}.label`, agent);
  const color = AGENT_COLOR_VAR[agent] ?? "var(--muted-foreground)";
  const sz = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-mono uppercase tracking-wider ${sz}`}
      style={{ borderColor: color, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
