import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/atlantix/Logo";
import { LanguageSwitcher } from "@/components/atlantix/LanguageSwitcher";
import { RegimePill } from "@/components/atlantix/RegimePill";
import { ScoreBar } from "@/components/atlantix/ScoreBar";
import {
  ArrowUpRight,
  Activity,
  Shield,
  Users,
  Globe,
  Eye,
  Terminal,
  BookOpen,
  ScrollText,
  Target,
  PieChart,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Minus,
  Check,
  X,
  ArrowUp,
  Github,
  Twitter,
  Linkedin,
  MessageSquareText,
  Brain,
  ShieldCheck,
  Layers,
  UserCheck,
  Zap,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Atlantix Finance — Hedge Fund Terminal" },
      {
        name: "description",
        content:
          "Professional hedge fund terminal for trade pipeline, investment committee, risk desk, portfolio book, execution workflow and audited post-mortems.",
      },
      { property: "og:title", content: "Atlantix Finance — Hedge Fund Terminal" },
      {
        property: "og:description",
        content:
          "Trade ideas move through data, committee debate, risk veto, operator approval, execution and journaled learning.",
      },
    ],
  }),
});

function LandingPage() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <Hero />
      <TrustedStrip />
      <BottlenecksSection />
      <ServicesSection />
      <AgentChatSection />
      <ScenariosSection />
      <CaseStudiesSection />
      <ForWhomSection />
      <ApproachSection />
      <TestimonialsSection />
      <DifferenceSection />
      <TechStackSection />
      <NextStepsSection />
      <FaqSection />
      <CtaFooter />
    </div>
  );
}

/* ---------- shared ---------- */

function Slash() {
  return <span className="font-mono text-atlantix">/</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
      <Slash />
      <span>{children}</span>
    </div>
  );
}

/* ---------- top bar ---------- */

function TopBar() {
  const { t } = useTranslation();
  return (
    <header className="fixed top-0 left-0 right-0 z-20 flex justify-center px-4 py-3 sm:px-6">
      <div className="flex w-full max-w-5xl items-center justify-between gap-3 rounded-full border border-border/60 bg-background/80 px-4 py-2.5 shadow-lg backdrop-blur-md sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground md:flex">
          <a href="#services" className="story-link transition-colors hover:text-foreground">{t("nav.services")}</a>
          <a href="#cases" className="story-link transition-colors hover:text-foreground">{t("nav.cases")}</a>
          <a href="#approach" className="story-link transition-colors hover:text-foreground">{t("nav.approach")}</a>
          <a href="#stack" className="story-link transition-colors hover:text-foreground">{t("nav.tech")}</a>
          <a href="#faq" className="story-link transition-colors hover:text-foreground">{t("nav.faq")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-atlantix/40 hover:bg-surface-2 sm:px-4 sm:text-[11px]"
          >
            <span>{t("nav.enterTerminal")}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-atlantix transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------- hero ---------- */

function useTypewriter(text: string, speed = 55, startDelay = 200) {
  const [out, setOut] = useState("");
  useEffect(() => {
    setOut("");
    let i = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    const startId = setTimeout(function tick() {
      setOut(text.slice(0, i + 1));
      i++;
      if (i < text.length) timeoutId = setTimeout(tick, speed);
    }, startDelay);
    return () => { clearTimeout(startId); clearTimeout(timeoutId); };
  }, [text, speed, startDelay]);
  return out;
}

function DottedBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Dot = { x: number; y: number; base: number };
    let dots: Dot[] = [];

    const buildDots = () => {
      dots = [];
      const spacing = 16; // px between dots in the grid
      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);
      let seed = 1;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * spacing + (r % 2 ? spacing / 2 : 0);
          const y = r * spacing;
          const nx = x / width - 0.5;
          const ny = y / height - 0.5;
          const dist = Math.sqrt(nx * nx + ny * ny) / 0.7071;
          // edges denser, center sparser
          const prob = Math.pow(dist, 1.6) * 0.9 + 0.05;
          if (rnd() < prob) {
            dots.push({ x, y, base: 0.1 + rnd() * 0.35 });
          }
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDots();
    };

    // Get atlantix color from CSS var, with fallback.
    const css = getComputedStyle(document.documentElement);
    const atlantix = css.getPropertyValue("--atlantix").trim() || "oklch(0.78 0.17 145)";

    const start = performance.now();
    const render = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);

      // Two traveling waves crossing diagonally for a richer pattern.
      const speed1 = 90; // px/s
      const speed2 = 60;
      const wavelength1 = 260;
      const wavelength2 = 380;
      const dirX1 = Math.cos(0.6);
      const dirY1 = Math.sin(0.6);
      const dirX2 = Math.cos(-0.4);
      const dirY2 = Math.sin(-0.4);
      const phase1 = t * speed1;
      const phase2 = t * speed2;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const proj1 = d.x * dirX1 + d.y * dirY1 - phase1;
        const proj2 = d.x * dirX2 + d.y * dirY2 - phase2;
        const w =
          0.5 + 0.5 * Math.sin((proj1 / wavelength1) * Math.PI * 2);
        const w2 =
          0.5 + 0.5 * Math.sin((proj2 / wavelength2) * Math.PI * 2);
        const intensity = Math.max(w, w2 * 0.7);
        const alpha = Math.min(1, d.base + intensity * 0.65);
        const radius = 1.1 + intensity * 1.6;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = atlantix;
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(render);
    };

    resize();
    raf = requestAnimationFrame(render);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 60% at 50% 50%, var(--background) 28%, transparent 78%)",
        }}
      />
    </div>
  );
}

function Hero() {
  const { t } = useTranslation();
  const titleA = t("hero.titleA");
  const titleB = t("hero.titleB");
  const full = `${titleA} ${titleB}`;
  const typed = useTypewriter(full, 55, 250);
  const aLen = titleA.length + 1; // include trailing space
  const typedA = typed.slice(0, Math.min(typed.length, aLen));
  const typedB = typed.length > aLen ? typed.slice(aLen) : "";
  const done = typed.length >= full.length;
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-background pt-[72px]">
      <DottedBackdrop />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-14 text-center sm:px-6 sm:py-20 lg:py-28">
        <h1 className="max-w-5xl font-display text-5xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-6xl md:text-7xl lg:text-8xl min-h-[1.05em]">
          <span>{typedA}</span>
          <span className="text-atlantix">{typedB}</span>
          <span
            aria-hidden
            className={`ml-1 inline-block w-[0.08em] -mb-1 align-baseline bg-current ${done ? "animate-pulse" : ""}`}
            style={{ height: "0.9em" }}
          />
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg animate-fade-in">
          {t("hero.subtitle")}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 animate-fade-in">
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:opacity-95"
          >
            {t("hero.ctaPrimary")}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("hero.noCard")}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground animate-fade-in">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-green animate-pulse" /> {t("hero.ownerApproved")}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-green animate-pulse" /> {t("hero.ragMemory")}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-green animate-pulse" /> {t("hero.riskVeto")}
          </span>
        </div>

        <div className="relative mt-16 w-full animate-scale-in">
          <div className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-40 max-w-3xl rounded-full bg-atlantix/20 blur-3xl" />
          <div className="relative mx-auto max-w-4xl">
            <CommandCenterPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function CommandCenterPreview() {
  const { t } = useTranslation();
  const ideas = [
    { t: "XOM", side: "long", edge: 82, risk: 38, cons: 71, status: "Debating" },
    { t: "NVDA", side: "long", edge: 88, risk: 52, cons: 64, status: "Owner Review" },
    { t: "TLT", side: "short", edge: 71, risk: 44, cons: 58, status: "Debating" },
  ];
  const health = [
    { k: "Alpaca", v: "green" },
    { k: "Yahoo", v: "green" },
    { k: "News", v: "yellow" },
    { k: "FRED", v: "green" },
    { k: "Vector DB", v: "green" },
  ];
  return (
    <div className="panel relative w-full overflow-hidden shadow-2xl transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <div className="font-display text-base font-semibold uppercase tracking-wider">
            {t("preview.title")}
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("preview.subtitle")}
          </div>
        </div>
        <RegimePill regime="risk_on" />
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PreviewStat label={t("preview.totalEquity")} value="$1.24M" />
          <PreviewStat label={t("preview.cash")} value="$312K" />
          <PreviewStat label={t("preview.dailyPnl")} value="+$8.4K" tone="bull" />
          <PreviewStat label={t("preview.riskUsed")} value="42%" tone="warn" />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="panel bg-surface-2/40 p-3 sm:col-span-2">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 text-atlantix" />
              {t("preview.topEdge")}
            </div>
            <div className="mt-2 space-y-1.5">
              {ideas.map((i) => (
                <div
                  key={i.t}
                  className="rounded-md border border-border/60 bg-surface px-2.5 py-2 transition-colors hover:bg-surface-3"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="ticker rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">{i.t}</span>
                    <span className={`font-mono text-[9px] uppercase tracking-widest ${i.side === "long" ? "text-bull" : "text-bear"}`}>
                      {i.side}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      · {i.status}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <ScoreBar value={i.edge} label={t("preview.edge")} tone="edge" />
                    <ScoreBar value={i.risk} label={t("preview.risk")} tone="risk" />
                    <ScoreBar value={i.cons} label={t("preview.cons")} tone="atlantix" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel bg-surface-2/40 p-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <Activity className="h-3 w-3 text-atlantix" />
              {t("preview.systemStatus")}
            </div>
            <div className="mt-2 space-y-1.5">
              {health.map((h) => (
                <div
                  key={h.k}
                  className="flex items-center justify-between rounded-md bg-surface px-2.5 py-1.5"
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider">{h.k}</span>
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        h.v === "green"
                          ? "var(--risk-green)"
                          : h.v === "yellow"
                          ? "var(--risk-yellow)"
                          : "var(--risk-red)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bull" | "warn";
}) {
  const c = tone === "bull" ? "text-bull" : tone === "warn" ? "text-risk-yellow" : "text-foreground";
  return (
    <div className="panel bg-surface-2/40 p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-sm font-semibold ${c}`}>{value}</div>
    </div>
  );
}

/* ---------- trusted strip (marquee) ---------- */

function TrustedStrip() {
  const { t } = useTranslation();
  const sources = [
    "Alpaca", "Yahoo Finance", "FRED", "Google Gemini API", "Supabase", "CCXT", "TradingView",
    "Alpaca", "Yahoo Finance", "FRED", "Google Gemini API", "Supabase", "CCXT", "TradingView",
  ];
  return (
    <section className="border-b border-border/60 bg-surface/30 py-8">
      <div className="mx-auto mb-6 max-w-7xl px-6">
        <SectionLabel>{t("trusted.label")}</SectionLabel>
      </div>
      <div className="relative overflow-hidden">
        <div className="flex animate-[marquee_40s_linear_infinite] gap-12 whitespace-nowrap">
          {sources.concat(sources).map((s, i) => (
            <span
              key={i}
              className="font-display text-2xl font-semibold uppercase tracking-tight text-muted-foreground/60"
            >
              {s} <span className="text-atlantix">·</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </section>
  );
}

/* ---------- bottlenecks ---------- */

function BottlenecksSection() {
  const { t } = useTranslation();
  const rows = t("bottlenecks.rows", { returnObjects: true }) as string[];
  return (
    <section className="border-b border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("bottlenecks.label")}</SectionLabel>
        <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
          {t("bottlenecks.title")}
        </h2>
        <div className="mt-12 space-y-3">
          {rows.map((r, i) => (
            <div
              key={i}
              className="group flex items-center justify-between gap-4 border-b border-border/50 py-4 transition-colors hover:bg-surface/40 sm:gap-6 sm:py-5"
            >
              <div className="flex min-w-0 items-center gap-3 sm:gap-6">
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  /0{i + 1}
                </span>
                <span className="font-display text-base text-foreground sm:text-xl md:text-2xl">{r}</span>
              </div>
              <ArrowUpRight className="hidden h-5 w-5 shrink-0 text-atlantix opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- services ---------- */

function ServicesSection() {
  const { t } = useTranslation();
  return (
    <section id="services" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("services.label")}</SectionLabel>
        <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            {t("services.titleA")} <span className="text-atlantix">{t("services.titleB")}</span>
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("services.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <ServiceCard tag="01" icon={Users} title={t("services.items.debate.title")} body={t("services.items.debate.body")} to="/debate"><DebateMock /></ServiceCard>
          <ServiceCard tag="02" icon={Target} title={t("services.items.opportunities.title")} body={t("services.items.opportunities.body")} to="/opportunities"><OpportunitiesMock /></ServiceCard>
          <ServiceCard tag="03" icon={Globe} title={t("services.items.macro.title")} body={t("services.items.macro.body")} to="/macro"><MacroMock /></ServiceCard>
          <ServiceCard tag="04" icon={BookOpen} title={t("services.items.research.title")} body={t("services.items.research.body")} to="/research"><ResearchMock /></ServiceCard>
          <ServiceCard tag="05" icon={ScrollText} title={t("services.items.journal.title")} body={t("services.items.journal.body")} to="/journal"><JournalMock /></ServiceCard>
          <ServiceCard tag="06" icon={Activity} title={t("services.items.health.title")} body={t("services.items.health.body")} to="/health"><HealthMock /></ServiceCard>
          <ServiceCard tag="07" icon={PieChart} title={t("services.items.portfolio.title")} body={t("services.items.portfolio.body")} to="/portfolio"><PortfolioMock /></ServiceCard>
          <ServiceCard tag="08" icon={Shield} title={t("services.items.risk.title")} body={t("services.items.risk.body")} to="/risk"><RiskMock /></ServiceCard>
          <ServiceCard tag="09" icon={Eye} title={t("services.items.watchlist.title")} body={t("services.items.watchlist.body")} to="/watchlist"><WatchlistMock /></ServiceCard>
          <ServiceCard tag="10" icon={MessageSquareText} title={t("services.items.agentChat.title")} body={t("services.items.agentChat.body")} to="/agent-chat"><AgentChatMock /></ServiceCard>
        </div>
      </div>
    </section>
  );
}

function ServiceCard({
  tag,
  icon: Icon,
  title,
  body,
  to,
  children,
}: {
  tag: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  to: "/debate" | "/opportunities" | "/macro" | "/research" | "/journal" | "/health" | "/portfolio" | "/risk" | "/watchlist" | "/agent-chat";
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="panel group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-atlantix/40 hover:shadow-2xl">
      <div className="border-b border-border bg-surface-2/30 p-5 transition-colors group-hover:bg-surface-2/60">{children}</div>
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <span>/{tag}</span>
            <Icon className="h-3.5 w-3.5 text-atlantix transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} />
          </div>
          <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight transition-colors group-hover:text-atlantix">{title}</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
        </div>
        <Link
          to={to}
          className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-2 hover:text-foreground"
        >
          {t("common.open")}
        </Link>
      </div>
    </div>
  );
}

/* --- mini mockups (data-only, no translation needed) --- */

function DebateMock() {
  const rows: { agent: string; stance: "FOR" | "AGAINST" | "CAUTION"; note: string }[] = [
    { agent: "Macro", stance: "FOR", note: "OPEC+ discipline + USD softening" },
    { agent: "Bear", stance: "AGAINST", note: "Already priced; demand fragile" },
    { agent: "Flow", stance: "CAUTION", note: "Low liquidity into close" },
  ];
  const tone = {
    FOR: { c: "text-bull", bg: "bg-bull/10", I: CheckCircle2 },
    AGAINST: { c: "text-bear", bg: "bg-bear/10", I: XCircle },
    CAUTION: { c: "text-risk-yellow", bg: "bg-risk-yellow/10", I: AlertTriangle },
  };
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const tw = tone[r.stance];
        const I = tw.I;
        return (
          <div key={r.agent} className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{r.agent}</span>
              <span className={`inline-flex items-center gap-1 rounded ${tw.bg} px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tw.c}`}>
                <I className="h-3 w-3" /> {r.stance}
              </span>
            </div>
            <span className="truncate text-xs text-muted-foreground">{r.note}</span>
          </div>
        );
      })}
    </div>
  );
}

function OpportunitiesMock() {
  const { t } = useTranslation();
  const rows = [
    { t: "NVDA", side: "long", edge: 88, risk: 52, rr: "3.2R" },
    { t: "TLT", side: "short", edge: 71, risk: 44, rr: "2.4R" },
    { t: "XOM", side: "long", edge: 65, risk: 30, rr: "1.9R" },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.t} className="flex items-center justify-between gap-2 rounded-md bg-surface px-2.5 py-2 sm:gap-3 sm:px-3">
          <div className="flex shrink-0 items-center gap-2">
            <span className="ticker rounded bg-surface-2 px-1.5 py-0.5 text-xs">{r.t}</span>
            <span className={`font-mono text-[10px] uppercase tracking-widest ${r.side === "long" ? "text-bull" : "text-bear"}`}>
              {r.side}
            </span>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:max-w-[12rem] sm:gap-3">
            <ScoreBar value={r.edge} label={t("preview.edge")} tone="edge" />
            <ScoreBar value={r.risk} label={t("preview.risk")} tone="risk" />
          </div>
          <span className="shrink-0 font-mono text-xs text-atlantix">{r.rr}</span>
        </div>
      ))}
    </div>
  );
}

function MacroMock() {
  const rows = [
    { k: "VIX", v: "13.8", d: "-0.7 w" },
    { k: "10Y UST", v: "4.21%", d: "+6bp m" },
    { k: "DXY", v: "102.4", d: "-0.9 w" },
    { k: "Brent", v: "$83.1", d: "+2.1% m" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((r) => (
        <div key={r.k} className="rounded-md bg-surface px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{r.k}</div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="font-mono text-sm font-semibold">{r.v}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{r.d}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResearchMock() {
  return (
    <div className="rounded-md bg-surface p-3 text-sm leading-relaxed">
      <p>
        XOM on the current sweep mirrors{" "}
        <span className="inline-flex items-center rounded bg-atlantix/15 px-1.5 py-0.5 font-mono text-[10px] text-atlantix">
          Memo #1224
        </span>{" "}
        — long energy on OPEC+ supply discipline. Realized +2.1R in 9 sessions, validated by{" "}
        <span className="inline-flex items-center rounded bg-atlantix/15 px-1.5 py-0.5 font-mono text-[10px] text-atlantix">
          Trade #418
        </span>
        .
      </p>
      <div className="mt-3 border-t pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Sources · memo-1224.md · trade-418.json
      </div>
    </div>
  );
}

function JournalMock() {
  const rows = [
    { t: "NVDA", pnl: "+2.1R", agent: "Fundamental", verdict: "Correct" },
    { t: "TLT", pnl: "-0.6R", agent: "Macro", verdict: "Wrong" },
    { t: "XOM", pnl: "+1.4R", agent: "Bear", verdict: "Wrong" },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.t} className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="ticker rounded bg-surface-2 px-1.5 py-0.5 text-xs">{r.t}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{r.agent}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-mono text-xs ${r.verdict === "Correct" ? "text-bull" : "text-bear"}`}>{r.verdict}</span>
            <span className={`font-mono text-sm ${r.pnl.startsWith("+") ? "text-bull" : "text-bear"}`}>{r.pnl}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HealthMock() {
  const rows = [
    { k: "Alpaca", v: "green", d: "12ms" },
    { k: "Yahoo Finance", v: "green", d: "84ms" },
    { k: "News API", v: "yellow", d: "rate-limit" },
    { k: "FRED", v: "green", d: "120ms" },
  ];
  const color = (s: string) =>
    s === "green" ? "var(--risk-green)" : s === "yellow" ? "var(--risk-yellow)" : "var(--risk-red)";
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((r) => (
        <div key={r.k} className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider">{r.k}</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">{r.d}</span>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color(r.v) }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function PortfolioMock() {
  const positions = [
    { ticker: "XOM", side: "long", weight: "8.4%", upnl: "+$2,140" },
    { ticker: "NVDA", side: "long", weight: "12.1%", upnl: "+$5,880" },
    { ticker: "TLT", side: "short", weight: "5.2%", upnl: "-$320" },
  ];
  return (
    <div className="space-y-2">
      {positions.map((p) => (
        <div key={p.ticker} className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="ticker rounded bg-surface-2 px-1.5 py-0.5 text-xs">{p.ticker}</span>
            <span className={`font-mono text-[10px] uppercase tracking-widest ${p.side === "long" ? "text-bull" : "text-bear"}`}>
              {p.side}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{p.weight} NAV</span>
          </div>
          <span className={`font-mono text-xs ${p.upnl.startsWith("+") ? "text-bull" : "text-bear"}`}>{p.upnl}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between rounded-md bg-surface-2 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total Equity</span>
        <span className="font-mono text-sm font-semibold">$1.24M</span>
      </div>
    </div>
  );
}

function RiskMock() {
  const verdicts = [
    { idea: "XOM long", verdict: "approve", maxPos: "8%" },
    { idea: "TLT short", verdict: "reduce_size", maxPos: "4%" },
    { idea: "TSLA long", verdict: "reject", maxPos: "—" },
  ];
  const vColor = (v: string) =>
    v === "approve" ? "text-bull" : v === "reduce_size" ? "text-risk-yellow" : "text-bear";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kill Switch</span>
        <span className="rounded bg-bull/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-bull">DISARMED</span>
      </div>
      {verdicts.map((v) => (
        <div key={v.idea} className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
          <span className="font-mono text-[10px] text-muted-foreground">{v.idea}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">{v.maxPos}</span>
            <span className={`font-mono text-[10px] uppercase tracking-widest ${vColor(v.verdict)}`}>
              {v.verdict.replace("_", " ")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WatchlistMock() {
  const items = [
    { ticker: "AKBNK", name: "Akbank", sector: "Banking", trigger: "Breakout above 52W high" },
    { ticker: "BIMAS", name: "BIM Stores", sector: "Retail", trigger: "CPI beat + margin expansion" },
    { ticker: "THYAO", name: "Turkish Airlines", sector: "Aviation", trigger: "Load factor > 90%" },
  ];
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.ticker} className="rounded-md bg-surface px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="ticker rounded bg-surface-2 px-1.5 py-0.5 text-xs">{i.ticker}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{i.sector}</span>
            </div>
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{i.trigger}</div>
        </div>
      ))}
    </div>
  );
}

function AgentChatMock() {
  const messages = [
    { agent: "CIO", text: "XOM thesis holds — OPEC+ discipline confirmed.", side: "agent" },
    { agent: "You", text: "What's the max size given current drawdown?", side: "user" },
    { agent: "Risk", text: "Cap at 8% NAV. Stop at -1.5R below entry.", side: "agent" },
  ];
  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <div key={i} className={`flex gap-2 ${m.side === "user" ? "flex-row-reverse" : ""}`}>
          <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-atlantix self-start mt-0.5">
            {m.agent}
          </span>
          <div className={`rounded-md px-2.5 py-1.5 text-xs leading-snug ${m.side === "user" ? "bg-atlantix/15 text-foreground" : "bg-surface text-muted-foreground"}`}>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- case studies ---------- */

function CaseStudiesSection() {
  const { t } = useTranslation();
  const cases = (t("cases.items", { returnObjects: true }) as Array<{
    year: string;
    title: string;
    metrics: [string, string][];
  }>).map((c, idx) => ({
    ...c,
    tags: idx === 0 ? ["Macro", "Fundamental", "News"] : ["Risk", "Macro", "Flow"],
  }));
  return (
    <section id="cases" className="border-b border-border/60 bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex items-end justify-between">
          <div>
            <SectionLabel>{t("cases.label")}</SectionLabel>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
              {t("cases.titleA")} <span className="text-atlantix">{t("cases.titleB")}</span>
            </h2>
          </div>
          <Link
            to="/journal"
            className="hidden rounded-full border border-border bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground hover:bg-surface-2 md:inline-flex"
          >
            {t("common.moreCases")}
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {cases.map((c) => (
            <div key={c.title} className="panel overflow-hidden">
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-surface-2 to-background">
                <div className="grid-bg absolute inset-0 opacity-50" />
                <div className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  <Slash /> {c.year}
                </div>
                <div className="absolute right-5 top-5 flex gap-1.5">
                  {c.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border bg-surface/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                  <Activity className="h-12 w-12 text-atlantix/60" strokeWidth={1} />
                  <div className="font-display text-5xl font-semibold tracking-tight text-foreground/80">
                    {c.metrics[0][0]}
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-display text-xl font-semibold leading-snug">{c.title}</h3>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {c.metrics.map(([v, l]) => (
                    <div key={l} className="rounded-md bg-surface-2 px-3 py-2">
                      <div className="font-display text-lg font-semibold text-foreground">{v}</div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- approach ---------- */

function ApproachSection() {
  const { t } = useTranslation();
  const icons = [Eye, Users, Shield, Terminal];
  const steps = (t("approach.steps", { returnObjects: true }) as Array<{ title: string; body: string }>);
  return (
    <section id="approach" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("approach.label")}</SectionLabel>
        <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {t("approach.titleA")} <span className="text-atlantix">{t("approach.titleB")}</span>
        </h2>

        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, idx) => {
            const Icon = icons[idx];
            const n = String(idx + 1).padStart(2, "0");
            return (
              <div key={n} className="bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="font-display text-3xl font-bold tracking-tight text-atlantix">/{n}</span>
                  <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div className="mt-8 font-display text-xl font-semibold">{s.title}</div>
                <p className="mt-3 text-sm text-muted-foreground">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- testimonials ---------- */

function TestimonialsSection() {
  const { t } = useTranslation();
  const items = t("testimonials.items", { returnObjects: true }) as Array<{
    quote: string;
    who: string;
    role: string;
  }>;
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("testimonials.label")}</SectionLabel>
        <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {t("testimonials.title")}
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {items.map((it, i) => (
            <div key={i} className="panel flex flex-col justify-between p-6">
              <p className="text-base leading-relaxed text-foreground">“{it.quote}”</p>
              <div className="mt-8 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 font-display text-sm font-bold text-atlantix">
                  {it.who[0]}
                </div>
                <div>
                  <div className="font-display text-sm font-semibold">{it.who}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{it.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- difference ---------- */

function DifferenceSection() {
  const { t } = useTranslation();
  const atlantix = t("difference.atlantix", { returnObjects: true }) as string[];
  const others = t("difference.others", { returnObjects: true }) as string[];
  return (
    <section className="border-b border-border/60 bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {t("difference.titleA")} <span className="text-atlantix">{t("difference.titleB")}</span>
        </h2>

        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
          <div className="bg-surface p-8">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
            </div>
            <ul className="mt-6 space-y-4">
              {atlantix.map((r) => (
                <li key={r} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-bull" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-background p-8">
            <h3 className="font-display text-lg font-semibold uppercase tracking-wider text-muted-foreground">
              {t("difference.otherTools")}
            </h3>
            <ul className="mt-6 space-y-4">
              {others.map((r) => (
                <li key={r} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-bear" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- tech stack ---------- */

function TechStackSection() {
  const { t } = useTranslation();
  const stack = t("stack.items", { returnObjects: true }) as Array<{ name: string; body: string }>;
  return (
    <section id="stack" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("stack.label")}</SectionLabel>
        <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {t("stack.titleA")} <span className="text-atlantix">{t("stack.titleMid")}</span> {t("stack.titleB")}
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {stack.map((s, idx) => {
            const n = String(idx + 1).padStart(2, "0");
            return (
              <div key={n} className="bg-surface p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-atlantix">/{n}</div>
                <div className="mt-6 font-display text-xl font-semibold">{s.name}</div>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- faq ---------- */

function FaqSection() {
  const { t } = useTranslation();
  const items = t("faq.items", { returnObjects: true }) as Array<{ q: string; a: string }>;
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-b border-border/60 bg-surface/30">
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("faq.label")}</SectionLabel>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {t("faq.title")}
        </h2>
        <div className="mt-10 space-y-2">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <button
                key={i}
                onClick={() => setOpen(isOpen ? null : i)}
                className="panel block w-full p-5 text-left transition-colors hover:bg-surface-2/50"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display text-lg font-semibold">{it.q}</span>
                  {isOpen ? (
                    <Minus className="h-4 w-4 text-atlantix" />
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {isOpen && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.a}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- footer CTA ---------- */

function CtaFooter() {
  const { t } = useTranslation();
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  return (
    <section className="footer-sky relative overflow-hidden">
      {/* back to top */}
      <div className="absolute right-6 top-8 z-10 sm:right-10 sm:top-10">
        <button
          onClick={scrollTop}
          className="group inline-flex items-center gap-3 text-white/90 transition hover:text-white"
        >
          <span className="text-sm">{t("shell.backToTop")}</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/5 backdrop-blur-sm transition group-hover:bg-white/15">
            <ArrowUp className="h-4 w-4" />
          </span>
        </button>
      </div>

      {/* tiny moon */}
      <div className="pointer-events-none absolute right-[22%] top-[34%] h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_24px_6px_rgba(255,255,255,0.6)]" />

      <div className="mx-auto flex min-h-[640px] max-w-6xl flex-col items-center justify-center px-4 pb-32 pt-40 text-center sm:px-6">
        <div className="inline-flex items-center gap-2 text-sm text-white/85">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          {t("cta.label")}
        </div>

        <h2 className="font-pixel mt-8 leading-[1.05] text-white sm:text-6xl md:text-7xl lg:text-[88px] text-5xl font-semibold">
          {t("cta.titleA")} <span>{t("cta.titleMid")}</span>
          <br />
          {t("cta.titleB")}
        </h2>

        <p className="mt-8 max-w-md text-base text-white/80 sm:text-lg">
          {t("cta.sub")}
        </p>

        <div className="mt-10">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-md bg-white px-7 py-3.5 text-base font-medium text-slate-900 shadow-[0_10px_30px_-10px_rgba(255,255,255,0.6)] transition hover:-translate-y-0.5"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)" }}
          >
            {t("cta.createOperator")}
          </Link>
        </div>
      </div>

      {/* bottom bar */}
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-10 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <Logo size="md" />
          <div className="font-mono text-[11px] uppercase tracking-widest text-white/70">
            © {new Date().getFullYear()} Atlantix Finance. {t("cta.footer")}
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <a href="mailto:hello@atlantix.lab" className="text-white/90 hover:text-white">
            hello@atlantix.lab
          </a>
          <div className="flex items-center gap-2">
            {[Github, Twitter, Linkedin].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/30 bg-white/5 text-white/90 backdrop-blur-sm transition hover:bg-white/15"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- agent chat section ---------- */

function AgentChatSection() {
  const { t } = useTranslation();
  const agents = (t("agentChatSection.agents", { returnObjects: true }) as Array<{ name: string; desc: string }>);
  return (
    <section id="agent-chat" className="border-b border-border/60 bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("agentChatSection.label")}</SectionLabel>
        <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            {t("agentChatSection.titleA")} <span className="text-atlantix">{t("agentChatSection.titleB")}</span>
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("agentChatSection.subtitle")}</p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {agents.map((a) => (
            <div key={a.name} className="panel flex flex-col gap-1.5 p-4 transition-all hover:-translate-y-0.5 hover:border-atlantix/40">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-atlantix" />
                <span className="font-display text-sm font-semibold">{a.name}</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            to="/agent-chat"
            className="group inline-flex items-center gap-2 rounded-full border border-atlantix/40 bg-atlantix/10 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-atlantix transition-all hover:-translate-y-0.5 hover:bg-atlantix/20"
          >
            {t("agentChatSection.cta")}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- scenarios section ---------- */

function ScenariosSection() {
  const { t } = useTranslation();
  const items = (t("scenarios.items", { returnObjects: true }) as Array<{ step: string; title: string; body: string }>);
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("scenarios.label")}</SectionLabel>
        <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            {t("scenarios.titleA")} <span className="text-atlantix">{t("scenarios.titleB")}</span>
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("scenarios.subtitle")}</p>
        </div>

        <div className="mt-12 relative">
          {/* vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border/60 sm:left-[23px]" />
          <div className="space-y-0">
            {items.map((item, idx) => (
              <div key={item.step} className="relative flex gap-6 sm:gap-8">
                {/* step dot */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface font-mono text-[10px] font-bold text-atlantix">
                  {item.step}
                </div>
                <div className={`pb-10 pt-1.5 ${idx === items.length - 1 ? "pb-0" : ""}`}>
                  <div className="font-display text-lg font-semibold">{item.title}</div>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- for whom section ---------- */

function ForWhomSection() {
  const { t } = useTranslation();
  const profiles = (t("forWhom.profiles", { returnObjects: true }) as Array<{ title: string; body: string }>);
  const icons = [Target, Shield, Terminal, BookOpen];
  return (
    <section className="border-b border-border/60 bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("forWhom.label")}</SectionLabel>
        <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            {t("forWhom.titleA")} <span className="text-atlantix">{t("forWhom.titleB")}</span>
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("forWhom.subtitle")}</p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {profiles.map((p, idx) => {
            const Icon = icons[idx];
            return (
              <div key={p.title} className="panel flex flex-col gap-4 p-6 transition-all hover:-translate-y-1 hover:border-atlantix/40 hover:shadow-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-atlantix/10">
                  <Icon className="h-5 w-5 text-atlantix" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-display text-lg font-semibold">{p.title}</div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- next steps section ---------- */

function NextStepsSection() {
  const { t } = useTranslation();
  const steps = (t("nextSteps.steps", { returnObjects: true }) as Array<{ n: string; title: string; body: string }>);
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionLabel>{t("nextSteps.label")}</SectionLabel>
        <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            {t("nextSteps.titleA")} <span className="text-atlantix">{t("nextSteps.titleB")}</span>
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("nextSteps.subtitle")}</p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s) => (
            <div key={s.n} className="group bg-surface p-6 transition-colors hover:bg-surface-2">
              <div className="font-display text-3xl font-bold tracking-tight text-atlantix">/{s.n}</div>
              <div className="mt-6 font-display text-base font-semibold leading-snug">{s.title}</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            {t("cta.createOperator")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

void PieChart;
void Brain;
void ShieldCheck;
void Layers;
void UserCheck;
void Zap;
