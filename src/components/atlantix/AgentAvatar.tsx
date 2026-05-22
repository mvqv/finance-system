import {
  Crosshair,
  Globe2,
  BarChart3,
  Skull,
  ShieldCheck,
  Sigma,
  Newspaper,
  Zap,
  Droplets,
  Layers,
  Cog,
  Scale,
  BrainCircuit,
  type LucideIcon,
} from "lucide-react";
import { AGENT_COLOR_VAR } from "@/lib/atlantix";

const AGENT_ICON: Record<string, LucideIcon> = {
  cio: Crosshair,
  macro: Globe2,
  fundamental: BarChart3,
  bear: Skull,
  risk: ShieldCheck,
  quant: Sigma,
  news: Newspaper,
  options: Zap,
  flow: Droplets,
  portfolio: Layers,
  execution: Cog,
  operations: Scale,
  memory: BrainCircuit,
};

const SIZE: Record<string, { box: string; icon: number; ring: string }> = {
  xs: { box: "h-7 w-7 rounded-lg",   icon: 14, ring: "ring-1" },
  sm: { box: "h-9 w-9 rounded-xl",   icon: 18, ring: "ring-1" },
  md: { box: "h-11 w-11 rounded-xl", icon: 22, ring: "ring-2" },
  lg: { box: "h-16 w-16 rounded-2xl", icon: 30, ring: "ring-2" },
  xl: { box: "h-20 w-20 rounded-3xl", icon: 40, ring: "ring-2" },
};

export function AgentAvatar({
  agentId,
  size = "md",
  active = false,
  className = "",
}: {
  agentId: string;
  size?: keyof typeof SIZE;
  active?: boolean;
  className?: string;
}) {
  const Icon = AGENT_ICON[agentId] ?? BrainCircuit;
  const color = AGENT_COLOR_VAR[agentId] ?? "var(--muted-foreground)";
  const s = SIZE[size];

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${s.box} ${s.ring} ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle at 30% 25%, color-mix(in oklab, ${color} 85%, white 15%) 0%, color-mix(in oklab, ${color} 70%, black 30%) 60%, color-mix(in oklab, ${color} 55%, black 45%) 100%)`,
        boxShadow: active
          ? `0 0 0 1px ${color}, 0 8px 24px -8px color-mix(in oklab, ${color} 55%, transparent)`
          : `0 4px 14px -6px color-mix(in oklab, ${color} 45%, transparent)`,
        // @ts-expect-error css var
        "--tw-ring-color": `color-mix(in oklab, ${color} 35%, transparent)`,
      }}
    >
      {/* gloss */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.18) 100%)",
        }}
      />
      {/* subtle grain dot */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1 -top-1 h-3 w-3 rounded-full"
        style={{ background: "rgba(255,255,255,0.18)", filter: "blur(2px)" }}
      />
      <Icon
        size={s.icon}
        strokeWidth={2.25}
        className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
        style={{ color: "hsl(var(--background))" }}
      />
    </span>
  );
}
