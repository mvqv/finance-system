import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { ExternalLink, X, TrendingUp, TrendingDown, Newspaper, Layers, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/atlantix";

export const Route = createFileRoute("/graph")({ component: KnowledgeGraph });

// ── Types ─────────────────────────────────────────────────────────────────────
type NodeKind = "idea" | "position" | "event" | "asset";

interface GNode {
  id: string;
  kind: NodeKind;
  label: string;
  sub: string;
  x: number;
  y: number;
  // raw data for detail panel
  raw: Record<string, unknown>;
}

interface GEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  color: string;
}

// ── Colors ────────────────────────────────────────────────────────────────────
const KIND_STYLE: Record<NodeKind, { fill: string; stroke: string; text: string }> = {
  idea:     { fill: "oklch(0.78 0.15 75 / 0.15)",  stroke: "oklch(0.78 0.15 75)",  text: "oklch(0.78 0.15 75)"  },
  position: { fill: "oklch(0.70 0.18 145 / 0.15)", stroke: "oklch(0.70 0.18 145)", text: "oklch(0.70 0.18 145)" },
  event:    { fill: "oklch(0.62 0.20 25 / 0.15)",  stroke: "oklch(0.62 0.20 25)",  text: "oklch(0.62 0.20 25)"  },
  asset:    { fill: "oklch(0.65 0.18 280 / 0.15)", stroke: "oklch(0.65 0.18 280)", text: "oklch(0.65 0.18 280)"  },
};

const EDGE_COLOR: Record<string, string> = {
  "has position": "oklch(0.70 0.18 145 / 0.7)",
  "idea for":     "oklch(0.78 0.15 75 / 0.7)",
  "news about":   "oklch(0.62 0.20 25 / 0.6)",
  "sector":       "oklch(0.65 0.18 280 / 0.5)",
};

const NODE_W = 160;
const NODE_H = 48;

// ── Data fetching ─────────────────────────────────────────────────────────────
function useGraphData() {
  return useQuery({
    queryKey: ["kg-v2"],
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const [ideasRes, posRes, evRes] = await Promise.all([
        supabase.from("ideas")
          .select("id, title, side, status, asset_id, edge_score, risk_score, thesis")
          .order("created_at", { ascending: false }).limit(12),
        supabase.from("positions")
          .select("id, asset_id, idea_id, side, unrealized_pnl, weight_pct, avg_price, current_price")
          .is("closed_at", null).limit(10),
        supabase.from("events")
          .select("id, headline, asset_id, importance, sentiment, source, url, occurred_at")
          .gte("occurred_at", since)
          .order("importance", { ascending: false }).limit(10),
      ]);

      const assetIds = Array.from(new Set([
        ...(ideasRes.data ?? []).map((i) => i.asset_id),
        ...(posRes.data ?? []).map((p) => p.asset_id),
        ...(evRes.data ?? []).map((e) => e.asset_id),
      ].filter(Boolean))) as string[];

      const assetsRes = assetIds.length
        ? await supabase.from("assets").select("id, ticker, name, sector").in("id", assetIds)
        : { data: [] as any[] };

      return {
        ideas:    ideasRes.data ?? [],
        positions: posRes.data ?? [],
        events:   evRes.data ?? [],
        assets:   assetsRes.data ?? [],
      };
    },
  });
}

// ── Layout ────────────────────────────────────────────────────────────────────
function buildGraph(d: ReturnType<typeof useGraphData>["data"]): { nodes: GNode[]; edges: GEdge[] } {
  if (!d) return { nodes: [], edges: [] };

  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const assetById = new Map(d.assets.map((a) => [a.id, a]));

  const COLS = { asset: 80, event: 320, idea: 600, position: 880 };
  const rowY = (i: number) => 60 + i * 72;

  // Assets — col 0
  const usedAssetIds = Array.from(new Set([
    ...d.ideas.map((i) => i.asset_id),
    ...d.positions.map((p) => p.asset_id),
    ...d.events.map((e) => e.asset_id),
  ].filter(Boolean))) as string[];

  usedAssetIds.forEach((aid, i) => {
    const a = assetById.get(aid);
    if (!a) return;
    nodes.push({
      id: `asset-${aid}`,
      kind: "asset",
      label: a.ticker,
      sub: a.sector ?? a.name?.slice(0, 18) ?? "",
      x: COLS.asset,
      y: rowY(i),
      raw: a,
    });
  });

  // Events — col 1
  d.events.forEach((e, i) => {
    nodes.push({
      id: `evt-${e.id}`,
      kind: "event",
      label: (e.headline as string).slice(0, 22) + "…",
      sub: `imp ${e.importance} · ${e.source ?? ""}`.slice(0, 24),
      x: COLS.event,
      y: rowY(i),
      raw: e,
    });
    if (e.asset_id) {
      edges.push({
        id: `e-evt-${e.id}`,
        from: `evt-${e.id}`,
        to: `asset-${e.asset_id}`,
        label: "news about",
        color: EDGE_COLOR["news about"],
      });
    }
  });

  // Ideas — col 2
  d.ideas.forEach((idea, i) => {
    nodes.push({
      id: `idea-${idea.id}`,
      kind: "idea",
      label: (idea.title as string).slice(0, 22) + ((idea.title as string).length > 22 ? "…" : ""),
      sub: `${idea.side} · ${STATUS_LABEL[idea.status as string] ?? idea.status}`,
      x: COLS.idea,
      y: rowY(i),
      raw: idea,
    });
    if (idea.asset_id) {
      edges.push({
        id: `e-idea-${idea.id}`,
        from: `asset-${idea.asset_id}`,
        to: `idea-${idea.id}`,
        label: "idea for",
        color: EDGE_COLOR["idea for"],
      });
    }
  });

  // Positions — col 3
  d.positions.forEach((pos, i) => {
    const a = assetById.get(pos.asset_id);
    const pnl = pos.unrealized_pnl ?? 0;
    nodes.push({
      id: `pos-${pos.id}`,
      kind: "position",
      label: a ? `${a.ticker} ${pos.side}` : pos.side,
      sub: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(0)} USD`,
      x: COLS.position,
      y: rowY(i),
      raw: { ...pos, ticker: a?.ticker },
    });
    // position → asset
    edges.push({
      id: `e-pos-asset-${pos.id}`,
      from: `pos-${pos.id}`,
      to: `asset-${pos.asset_id}`,
      label: "has position",
      color: EDGE_COLOR["has position"],
    });
    // position → idea (if linked)
    if (pos.idea_id) {
      edges.push({
        id: `e-pos-idea-${pos.id}`,
        from: `pos-${pos.id}`,
        to: `idea-${pos.idea_id}`,
        label: "from idea",
        color: "oklch(0.70 0.18 145 / 0.5)",
      });
    }
  });

  return { nodes, edges };
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ node, onClose }: { node: GNode; onClose: () => void }) {
  const nav = useNavigate();
  const r = node.raw;
  const style = KIND_STYLE[node.kind];

  const actions: { label: string; icon: React.ReactNode; onClick: () => void }[] = [];

  if (node.kind === "idea") {
    actions.push({
      label: "Open Debate Room",
      icon: <ExternalLink className="h-3.5 w-3.5" />,
      onClick: () => nav({ to: "/debate", search: { id: r.id as string } }),
    });
  }
  if (node.kind === "position") {
    actions.push({
      label: "Open Portfolio",
      icon: <ExternalLink className="h-3.5 w-3.5" />,
      onClick: () => nav({ to: "/portfolio" }),
    });
    if (r.idea_id) {
      actions.push({
        label: "View Debate",
        icon: <ExternalLink className="h-3.5 w-3.5" />,
        onClick: () => nav({ to: "/debate", search: { id: r.idea_id as string } }),
      });
    }
  }
  if (node.kind === "event") {
    if (r.url) {
      actions.push({
        label: "Read Article",
        icon: <ExternalLink className="h-3.5 w-3.5" />,
        onClick: () => window.open(r.url as string, "_blank"),
      });
    }
    actions.push({
      label: "Open News Intel",
      icon: <ExternalLink className="h-3.5 w-3.5" />,
      onClick: () => nav({ to: "/news" }),
    });
  }
  if (node.kind === "asset") {
    actions.push({
      label: "Open Research",
      icon: <ExternalLink className="h-3.5 w-3.5" />,
      onClick: () => nav({ to: "/research" }),
    });
  }

  const KindIcon = {
    idea: TrendingUp,
    position: Layers,
    event: Newspaper,
    asset: AlertTriangle,
  }[node.kind];

  return (
    <div
      className="absolute right-4 top-4 z-20 w-72 rounded-xl border bg-background shadow-2xl"
      style={{ borderColor: style.stroke, borderWidth: 1.5 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-xl px-4 py-3" style={{ backgroundColor: style.fill }}>
        <KindIcon className="h-4 w-4 shrink-0" style={{ color: style.stroke }} strokeWidth={1.6} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: style.stroke }}>
            {node.kind}
          </div>
          <div className="truncate font-display text-sm font-semibold text-foreground">{node.label}</div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded p-0.5 hover:bg-surface-3">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-2 p-4 text-xs">
        {node.kind === "idea" && (
          <>
            <Row label="Side" value={<span className={r.side === "long" ? "text-bull font-semibold" : "text-bear font-semibold"}>{String(r.side).toUpperCase()}</span>} />
            <Row label="Status" value={STATUS_LABEL[r.status as string] ?? String(r.status)} />
            {r.edge_score != null && <Row label="Edge Score" value={`${r.edge_score}`} />}
            {r.risk_score != null && <Row label="Risk Score" value={`${r.risk_score}`} />}
            {r.thesis && (
              <div className="mt-2 rounded-md bg-surface-2 p-2 text-muted-foreground leading-relaxed">
                {String(r.thesis).slice(0, 180)}{String(r.thesis).length > 180 ? "…" : ""}
              </div>
            )}
          </>
        )}
        {node.kind === "position" && (
          <>
            <Row label="Side" value={<span className={r.side === "long" ? "text-bull font-semibold" : "text-bear font-semibold"}>{String(r.side).toUpperCase()}</span>} />
            <Row label="Avg Price" value={`$${Number(r.avg_price).toFixed(2)}`} />
            {r.current_price != null && <Row label="Current" value={`$${Number(r.current_price).toFixed(2)}`} />}
            <Row
              label="Unrealized P&L"
              value={
                <span className={Number(r.unrealized_pnl) >= 0 ? "text-bull font-semibold" : "text-bear font-semibold"}>
                  {Number(r.unrealized_pnl) >= 0 ? "+" : ""}{Number(r.unrealized_pnl).toFixed(0)} USD
                </span>
              }
            />
            {r.weight_pct != null && <Row label="Weight" value={`${Number(r.weight_pct).toFixed(1)}% NAV`} />}
          </>
        )}
        {node.kind === "event" && (
          <>
            <Row label="Importance" value={`${r.importance}/100`} />
            {r.sentiment != null && (
              <Row
                label="Sentiment"
                value={
                  <span className={Number(r.sentiment) > 0 ? "text-bull" : Number(r.sentiment) < 0 ? "text-bear" : "text-muted-foreground"}>
                    {Number(r.sentiment) > 0 ? "Positive" : Number(r.sentiment) < 0 ? "Negative" : "Neutral"}
                    {" "}({Number(r.sentiment).toFixed(2)})
                  </span>
                }
              />
            )}
            <Row label="Source" value={String(r.source ?? "—")} />
            <Row label="Date" value={new Date(r.occurred_at as string).toLocaleDateString()} />
            <div className="mt-2 rounded-md bg-surface-2 p-2 text-muted-foreground leading-relaxed">
              {String(r.headline).slice(0, 160)}{String(r.headline).length > 160 ? "…" : ""}
            </div>
          </>
        )}
        {node.kind === "asset" && (
          <>
            <Row label="Ticker" value={String(r.ticker)} />
            <Row label="Name" value={String(r.name ?? "—")} />
            <Row label="Sector" value={String(r.sector ?? "—")} />
          </>
        )}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="border-t px-4 pb-4 pt-3 space-y-2">
          {actions.map((a) => (
            <Button key={a.label} size="sm" variant="outline" className="w-full justify-start gap-2 text-xs" onClick={a.onClick}>
              {a.icon} {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function KnowledgeGraph() {
  const { data, isLoading } = useGraphData();
  const { nodes, edges } = useMemo(() => buildGraph(data), [data]);

  const [selected, setSelected] = useState<GNode | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + NODE_W + 40), 1100);
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + NODE_H + 40), 500);

  // Pan handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest("[data-node]")) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan((p) => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.4, z - e.deltaY * 0.001)));
  }, []);

  // Highlight edges connected to hovered/selected node
  const activeId = hovered ?? selected?.id ?? null;
  const connectedEdges = useMemo(() =>
    activeId ? new Set(edges.filter((e) => e.from === activeId || e.to === activeId).map((e) => e.id)) : new Set<string>(),
    [activeId, edges]
  );
  const connectedNodes = useMemo(() => {
    if (!activeId) return new Set<string>();
    const s = new Set<string>([activeId]);
    edges.forEach((e) => { if (e.from === activeId) s.add(e.to); if (e.to === activeId) s.add(e.from); });
    return s;
  }, [activeId, edges]);

  const hasData = nodes.length > 0;

  return (
    <AppShell>
      <PageHeader
        title="Knowledge Graph"
        subtitle="Your ideas, positions and events — click any node to act"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {isLoading ? "loading…" : `${nodes.length} nodes · ${edges.length} edges`}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setZoom((z) => Math.min(2, z + 0.15))}>+</Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}>−</Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</Button>
            </div>
          </div>
        }
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground border-b">
        {(Object.entries(KIND_STYLE) as [NodeKind, typeof KIND_STYLE[NodeKind]][]).map(([k, s]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border" style={{ backgroundColor: s.fill, borderColor: s.stroke }} />
            {k}
          </span>
        ))}
        <span className="ml-auto text-muted-foreground/60">drag to pan · scroll to zoom · click node to act</span>
      </div>

      <div className="relative flex-1 overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>
        {!hasData && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Layers className="h-10 w-10 opacity-30" strokeWidth={1} />
            <div className="text-sm">No data yet — create an idea or run ingest-news to populate the graph.</div>
          </div>
        )}

        <svg
          ref={svgRef}
          className="h-full w-full cursor-grab active:cursor-grabbing select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.5" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map((edge) => {
              const a = byId.get(edge.from);
              const b = byId.get(edge.to);
              if (!a || !b) return null;
              const x1 = a.x + NODE_W;
              const y1 = a.y + NODE_H / 2;
              const x2 = b.x;
              const y2 = b.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              const isActive = connectedEdges.has(edge.id);
              const dimmed = activeId && !isActive;
              return (
                <g key={edge.id} style={{ opacity: dimmed ? 0.15 : 1, transition: "opacity 0.15s" }}>
                  <path
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={isActive ? 2 : 1}
                    strokeDasharray={isActive ? "none" : "4 3"}
                    markerEnd="url(#arr)"
                  />
                  {isActive && (
                    <text x={mx} y={my - 6} fontSize="9" fill="var(--muted-foreground)" textAnchor="middle" className="font-mono">
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const s = KIND_STYLE[node.kind];
              const isSelected = selected?.id === node.id;
              const isHovered = hovered === node.id;
              const dimmed = activeId && !connectedNodes.has(node.id);
              return (
                <g
                  key={node.id}
                  data-node="1"
                  style={{ cursor: "pointer", opacity: dimmed ? 0.2 : 1, transition: "opacity 0.15s" }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(selected?.id === node.id ? null : node)}
                >
                  <rect
                    x={node.x}
                    y={node.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill={s.fill}
                    stroke={s.stroke}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                    style={{ filter: isSelected || isHovered ? `drop-shadow(0 0 6px ${s.stroke})` : "none" }}
                  />
                  {/* Kind badge */}
                  <text
                    x={node.x + 8}
                    y={node.y + 13}
                    fontSize="8"
                    fill={s.text}
                    className="font-mono uppercase tracking-widest"
                    style={{ fontFamily: "monospace" }}
                  >
                    {node.kind}
                  </text>
                  {/* Label */}
                  <text
                    x={node.x + NODE_W / 2}
                    y={node.y + 28}
                    fontSize="12"
                    fill="var(--foreground)"
                    textAnchor="middle"
                    fontWeight="600"
                    style={{ fontFamily: "var(--font-display, sans-serif)" }}
                  >
                    {node.label}
                  </text>
                  {/* Sub */}
                  <text
                    x={node.x + NODE_W / 2}
                    y={node.y + 41}
                    fontSize="9"
                    fill={s.text}
                    textAnchor="middle"
                    style={{ fontFamily: "monospace" }}
                  >
                    {node.sub}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Detail panel */}
        {selected && (
          <DetailPanel node={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </AppShell>
  );
}
