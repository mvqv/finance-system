import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { TerminalModeIndicator, TerminalModeBar } from "./TerminalMode";
import { useAuth, useUserRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Target, Users, Shield, PieChart, Newspaper, Globe, Eye, Terminal,
  BookOpen, ScrollText, Activity, Settings as SettingsIcon, LogOut, PanelLeftClose, PanelLeft,
  Bell, Server, Network, BarChart3, Menu, MessageSquareText, MoonStar,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const NAV = [
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard, label: "Command Center" },
  { to: "/agent-chat", key: "agentChat", icon: MessageSquareText, label: "Agent Chat" },
  { to: "/opportunities", key: "opportunities", icon: Target, label: "Opportunities" },
  { to: "/debate", key: "debate", icon: Users, label: "Debate Room" },
  { to: "/graph", key: "graph", icon: Network, label: "Knowledge Graph" },
  { to: "/risk", key: "risk", icon: Shield, label: "Risk" },
  { to: "/portfolio", key: "portfolio", icon: PieChart, label: "Portfolio" },
  { to: "/news", key: "news", icon: Newspaper, label: "News Intel" },
  { to: "/macro", key: "macro", icon: Globe, label: "Macro Radar" },
  { to: "/watchlist", key: "watchlist", icon: Eye, label: "Watchlist" },
  { to: "/execution", key: "execution", icon: Terminal, label: "Execution" },
  { to: "/operations", key: "operations", icon: Server, label: "Operations" },
  { to: "/alerts", key: "alerts", icon: Bell, label: "Alerts" },
  { to: "/agents", key: "agents", icon: BarChart3, label: "Agent Scorecards" },
  { to: "/research", key: "research", icon: BookOpen, label: "Research" },
  { to: "/journal", key: "journal", icon: ScrollText, label: "Journal" },
  { to: "/health", key: "health", icon: Activity, label: "System Health" },
  { to: "/shariah-guard", key: "shariahGuard", icon: MoonStar, label: "Shariah Guard" },
  { to: "/settings", key: "settings", icon: SettingsIcon, label: "Settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const role = useUserRole();
  const nav = useNavigate();
  const loc = useLocation();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("atlantix:sidebar-collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("atlantix:sidebar-collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  useEffect(() => {
    if (!loading && !user && loc.pathname !== "/auth") {
      nav({ to: "/auth" });
    }
  }, [loading, user, loc.pathname, nav]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {t("shell.initializing")}
        </div>
      </div>
    );
  }

  if (!user && loc.pathname !== "/auth") {
    return null;
  }

  const sidebarInner = (forceExpanded = false) => {
    const isCollapsed = forceExpanded ? false : collapsed;
    return (
      <>
        <div className="flex items-center justify-between gap-2 border-b px-3 py-4">
          {!isCollapsed ? (
            <div className="min-w-0">
              <Logo />
            </div>
          ) : (
            <Logo size="sm" />
          )}
          {!forceExpanded && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              title={isCollapsed ? t("common.expand") : t("common.collapse")}
              aria-label={isCollapsed ? t("common.expand") : t("common.collapse")}
            >
              {isCollapsed ? (
                <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = loc.pathname === item.to;
            const tk = `sidebar.items.${item.key}`;
            const tl = t(tk);
            const label = tl === tk ? item.label : tl;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={isCollapsed ? label : undefined}
                className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  isCollapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                {!isCollapsed && <span className="truncate">{label}</span>}
                {active && !isCollapsed && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-atlantix" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t px-3 py-3">
          {!isCollapsed && (
            <div className="mb-2 flex justify-end">
              <LanguageSwitcher />
            </div>
          )}
          {isCollapsed && (
            <div className="mb-2 flex justify-center">
              <LanguageSwitcher compact />
            </div>
          )}
          <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} gap-2`}>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="truncate text-xs">{user?.email}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-atlantix">
                  {role ?? "—"}
                </div>
              </div>
            )}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                nav({ to: "/auth" });
              }}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              title={t("common.signOut")}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex min-h-screen">
      {!isMobile && (
        <aside
          className={`sticky top-0 flex h-screen shrink-0 flex-col border-r bg-surface transition-[width] duration-200 ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          {sidebarInner()}
        </aside>
      )}

      {isMobile && (
        <>
          <div className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between border-b bg-background/90 px-3 py-2 backdrop-blur">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="rounded-md p-2 text-foreground hover:bg-surface-2"
                  aria-label={t("shell.openMenu")}
                >
                  <Menu className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-surface p-0 flex flex-col">
                <VisuallyHidden><SheetTitle>{t("shell.navigation")}</SheetTitle></VisuallyHidden>
                {sidebarInner(true)}
              </SheetContent>
            </Sheet>
            <Logo size="sm" />
            <div className="w-9" />
          </div>
        </>
      )}

      <main className={`flex-1 overflow-x-hidden min-w-0 ${isMobile ? "pt-12" : ""}`}>{children}</main>
    </div>
  );
}


export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 px-4 py-3 sm:px-6 sm:py-3">
      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm backdrop-blur-md overflow-visible sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl truncate">{title}</h1>
          {subtitle && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TerminalModeIndicator />
          {actions}
          <LanguageSwitcher />
        </div>
      </div>
      <div className="mt-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-2 backdrop-blur-md">
        <TerminalModeBar />
      </div>
    </div>
  );
}
