import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Activity, Eye, FlaskConical, Gavel, PlayCircle, ScrollText, ShieldAlert, Siren } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TerminalModeKey =
  | "research"
  | "watch"
  | "committee"
  | "risk_review"
  | "execution"
  | "live"
  | "post_mortem"
  | "emergency";

// Labels & hints come from i18n at render time; this list holds only the
// static parts (icon, color, key).
export const TERMINAL_MODES: Array<{
  key: TerminalModeKey;
  icon: typeof Activity;
  color: string;
}> = [
  { key: "research",    icon: FlaskConical, color: "var(--atlantix, oklch(0.70 0.15 200))" },
  { key: "watch",       icon: Eye,          color: "var(--agent-flow, oklch(0.70 0.15 190))" },
  { key: "committee",   icon: Gavel,        color: "var(--agent-cio, oklch(0.68 0.18 280))" },
  { key: "risk_review", icon: ShieldAlert,  color: "var(--warning, oklch(0.78 0.15 75))" },
  { key: "execution",   icon: PlayCircle,   color: "var(--bull, oklch(0.70 0.18 145))" },
  { key: "live",        icon: Activity,     color: "var(--agent-portfolio, oklch(0.65 0.18 280))" },
  { key: "post_mortem", icon: ScrollText,   color: "var(--muted-foreground)" },
  { key: "emergency",   icon: Siren,        color: "var(--bear, oklch(0.62 0.20 25))" },
];

function useModeLabel() {
  const { t } = useTranslation();
  return (key: TerminalModeKey) => ({
    label: t(`terminalMode.${key}.label`),
    hint: t(`terminalMode.${key}.hint`),
  });
}

type Ctx = {
  mode: TerminalModeKey;
  setMode: (m: TerminalModeKey, reason?: string) => Promise<void>;
  loading: boolean;
};
const TerminalModeCtx = createContext<Ctx>({ mode: "research", setMode: async () => {}, loading: true });

export function TerminalModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TerminalModeKey>("research");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { if (active) setLoading(false); return; }
      const { data } = await supabase.from("terminal_state").select("current_mode").eq("user_id", uid).maybeSingle();
      if (active && data?.current_mode) setModeState(data.current_mode as TerminalModeKey);
      if (active) setLoading(false);
    })();
    const ch = supabase
      .channel("terminal_state")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "terminal_state" }, (payload) => {
        const next = (payload.new as any)?.current_mode as TerminalModeKey | undefined;
        if (next) setModeState(next);
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  const setMode = async (m: TerminalModeKey, reason?: string) => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const { error } = await supabase.from("terminal_state").upsert({
      user_id: uid,
      current_mode: m,
      reason: reason ?? "manual override",
      source_type: "manual",
      source_id: null,
      changed_by: uid,
      changed_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) {
      toast.error(`Mode change failed: ${error.message}`);
      return;
    }
    setModeState(m);
  };

  return <TerminalModeCtx.Provider value={{ mode, setMode, loading }}>{children}</TerminalModeCtx.Provider>;
}

export function useTerminalMode() {
  return useContext(TerminalModeCtx);
}

/** Returns whether the current terminal mode allows the given action. */
export function useModeGuard(allowed: TerminalModeKey[]) {
  const { mode } = useTerminalMode();
  return { allowed: allowed.includes(mode), currentMode: mode };
}

export function TerminalModeBar() {
  const { mode, setMode } = useTerminalMode();
  const label = useModeLabel();
  const active = TERMINAL_MODES.find((m) => m.key === mode)!;
  const activeLbl = label(active.key);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-surface-2 p-1">
        {TERMINAL_MODES.map((m) => {
          const Icon = m.icon;
          const isActive = m.key === mode;
          const lbl = label(m.key);
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key, "manual override")}
              title={`${lbl.label} — ${lbl.hint}`}
              className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                isActive ? "" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: `color-mix(in oklab, ${m.color} 15%, transparent)`,
                      color: m.color,
                      borderColor: `color-mix(in oklab, ${m.color} 50%, transparent)`,
                    }
                  : undefined
              }
            >
              <Icon className="h-3 w-3" strokeWidth={1.6} style={isActive ? { color: m.color } : undefined} />
              {lbl.label}
            </button>
          );
        })}
      </div>
      <div className="px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{useTranslation().t("terminalMode.activeMode")}: </span>
        <span style={{ color: active.color }}>{activeLbl.label}</span> — {activeLbl.hint}
      </div>
    </div>
  );
}

export function TerminalModeIndicator() {
  const { mode } = useTerminalMode();
  const { t } = useTranslation();
  const label = useModeLabel();
  const m = TERMINAL_MODES.find((x) => x.key === mode)!;
  const Icon = m.icon;
  const lbl = label(m.key);
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5"
      style={{
        borderColor: `color-mix(in oklab, ${m.color} 40%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${m.color} 8%, transparent)`,
      }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.6} style={{ color: m.color }} />
      <div className="leading-tight">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t("terminalMode.mode")}</div>
        <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: m.color }}>
          {lbl.label}
        </div>
      </div>
    </div>
  );
}

