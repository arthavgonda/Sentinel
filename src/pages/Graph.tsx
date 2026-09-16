import * as d3 from "d3";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { objectById, typeColor } from "../data/mock";
import { GRAPH_POLICY } from "../config/application";
import { AddToCasePopover } from "../features/shared";
import { useStore } from "../state/store";
import type { Link, OntologyObject } from "../types";
import { focusGlobalSearch } from "../ui/AppShell";
import { Button, TypeDot } from "../ui/primitives";
import { Outliner, StatusBar, ViewportGizmo } from "../features/graph-ide/IDEChrome";
import "../features/graph-ide/graph-ide.css";

function nodeColor(type: OntologyObject["type"]) {
  return typeColor(type);
}

type SimNode = OntologyObject & d3.SimulationNodeDatum;
type SimLink = Link & d3.SimulationLinkDatum<SimNode>;

function exploreGraph(objects: OntologyObject[], links: Link[], originId: string, hops: number) {
  const discovered = new Set<string>([originId]);
  let frontier = new Set<string>([originId]);
  for (let depth = 0; depth < hops; depth += 1) {
    const next = new Set<string>();
    links.forEach((link) => {
      if (frontier.has(link.from) && !discovered.has(link.to)) next.add(link.to);
      if (frontier.has(link.to) && !discovered.has(link.from)) next.add(link.from);
    });
    next.forEach((item) => discovered.add(item));
    frontier = next;
  }
  return {
    nodes: objects.filter((object) => discovered.has(object.id)),
    edges: links.filter((link) => discovered.has(link.from) && discovered.has(link.to)),
  };
}

function truncateLabel(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function layoutNodes(nodes: OntologyObject[], edges: Link[], originId: string, alternateOrder: boolean) {
  const depth = new Map<string, number>([[originId, 0]]);
  const queue = [originId];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const nextDepth = (depth.get(current) ?? 0) + 1;
    edges.forEach((edge) => {
      const adjacent = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (adjacent && !depth.has(adjacent)) {
        depth.set(adjacent, nextDepth);
        queue.push(adjacent);
      }
    });
  }
  const groups = new Map<number, OntologyObject[]>();
  nodes.forEach((node) => {
    const level = depth.get(node.id) ?? 0;
    groups.set(level, [...(groups.get(level) ?? []), node]);
  });
  const { width, height, columnGap, rowGap, canvasInset } = GRAPH_POLICY.node;
  return nodes.map((node) => {
    const level = depth.get(node.id) ?? 0;
    const peers = alternateOrder ? [...(groups.get(level) ?? [])].reverse() : groups.get(level) ?? [];
    const row = peers.findIndex((peer) => peer.id === node.id);
    const totalHeight = peers.length * height + Math.max(0, peers.length - 1) * rowGap;
    return {
      ...node,
      x: canvasInset + width / 2 + level * (width + columnGap),
      y: Math.max(canvasInset + height / 2, 320 - totalHeight / 2 + row * (height + rowGap)),
    } satisfies SimNode;
  });
}

function nodeBounds(node: SimNode) {
  const { width, height } = GRAPH_POLICY.node;
  return { left: (node.x ?? 0) - width / 2, right: (node.x ?? 0) + width / 2, top: (node.y ?? 0) - height / 2, bottom: (node.y ?? 0) + height / 2 };
}

function EmptyCanvas() {
  return (
    <div className="empty" style={{ paddingTop: 100 }}>
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        style={{ marginBottom: 16, opacity: 0.3 }}
      >
        <circle cx="22" cy="22" r="8" stroke="var(--ink-secondary)" strokeWidth="1.5" />
        <circle cx="48" cy="18" r="6" stroke="var(--ink-secondary)" strokeWidth="1.5" />
        <circle cx="42" cy="46" r="7" stroke="var(--ink-secondary)" strokeWidth="1.5" />
        <circle cx="16" cy="48" r="5" stroke="var(--ink-secondary)" strokeWidth="1.5" />
        <line x1="22" y1="22" x2="48" y2="18" stroke="var(--ink-secondary)" strokeWidth="1" />
        <line x1="22" y1="22" x2="42" y2="46" stroke="var(--ink-secondary)" strokeWidth="1" />
        <line x1="22" y1="22" x2="16" y2="48" stroke="var(--ink-secondary)" strokeWidth="1" />
        <line x1="48" y1="18" x2="42" y2="46" stroke="var(--ink-secondary)" strokeWidth="1" />
      </svg>
      <p className="empty-title">Search for an object to begin exploring</p>
      <p className="muted" style={{ marginBottom: 16 }}>
        To add new objects and define relationships, use the Case Editor.
      </p>
      <Button onClick={() => focusGlobalSearch()}>Focus search</Button>
    </div>
  );
}

function EdgeTooltip({
  link,
  x,
  y,
  nodes,
}: {
  link: Link;
  x: number;
  y: number;
  nodes: SimNode[];
}) {
  const from = nodes.find((n) => n.id === link.from);
  const to = nodes.find((n) => n.id === link.to);
  return (
    <div
      style={{
        position: "fixed",
        left: x + 12,
        top: y - 8,
        zIndex: 50,
        background: "var(--panel-bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        padding: "8px 12px",
        fontSize: 12,
        maxWidth: 260,
        pointerEvents: "none",
      }}
    >
      <p style={{ fontWeight: 500, marginBottom: 4, fontSize: 13 }}>
        {link.type.replace(/_/g, " ")}
      </p>
      <p className="muted" style={{ marginBottom: 2 }}>
        {from?.display ?? link.from} → {to?.display ?? link.to}
      </p>
      <p className="muted" style={{ marginBottom: 2 }}>
        Source: {link.sourceLabel}
      </p>
      <p className="muted" style={{ marginBottom: 4 }}>
        Observed {link.observed}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            flex: 1,
            height: 5,
            background: "var(--border)",
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${link.confidence}%`,
              background:
                link.confidence >= 80
                  ? "var(--signal-high)"
                  : link.confidence >= 50
                    ? "var(--signal-medium)"
                    : "var(--signal-low)",
              borderRadius: 99,
            }}
          />
        </div>
        <span style={{ fontSize: 11, fontWeight: 500 }}>{link.confidence}%</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
        {link.matchedAttributes.map((a) => (
          <span
            key={a}
            style={{
              background: "var(--paper)",
              border: "1px solid var(--border)",
              borderRadius: 9999,
              padding: "1px 7px",
              fontSize: 10,
              color: "var(--ink-secondary)",
            }}
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

function SlidePanel({
  obj,
  edges,
  allNodes,
  onClose,
  onSelectNode,
  onAddToCase,
  addCaseOpen,
  onCloseAddToCase,
}: {
  obj: OntologyObject;
  edges: SimLink[];
  allNodes: SimNode[];
  onClose: () => void;
  onSelectNode: (id: string) => void;
  onAddToCase: () => void;
  addCaseOpen: boolean;
  onCloseAddToCase: () => void;
}) {
  const nav = useNavigate();
  const { objects } = useStore();

  const related = useMemo(() => {
    return edges
      .filter((e) => {
        const fromId = typeof e.source === "object" ? (e.source as SimNode).id : e.source;
        const toId = typeof e.target === "object" ? (e.target as SimNode).id : e.target;
        return fromId === obj.id || toId === obj.id;
      })
      .map((e) => {
        const fromId = typeof e.source === "object" ? (e.source as SimNode).id : e.source;
        const toId = typeof e.target === "object" ? (e.target as SimNode).id : e.target;
        const otherId = fromId === obj.id ? toId : fromId;
        const other =
          allNodes.find((n) => n.id === otherId) ?? objects.find((o) => o.id === otherId);
        return other ? { obj: other, link: e as Link } : null;
      })
      .filter(Boolean) as { obj: OntologyObject; link: Link }[];
  }, [edges, obj.id, allNodes, objects]);

  const propEntries = Object.entries(obj.properties).slice(0, 4);
  const imageUrl = obj.imageUrl ?? obj.properties["Image URL"];

  return (
    <div className="graph-slide-panel">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TypeDot color={nodeColor(obj.type)} size={10} />
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--ink-secondary)",
            }}
          >
            {obj.type}
          </span>
        </div>
        <button
          className="btn btn-icon"
          aria-label="Close panel"
          onClick={onClose}
          style={{ marginTop: -4, marginRight: -4 }}
        >
          ×
        </button>
      </div>

      <h2
        className="serif"
        style={{ fontSize: 18, marginBottom: 4, lineHeight: 1.3, wordBreak: "break-word" }}
      >
        {obj.display}
      </h2>
      <p className="muted" style={{ fontSize: 11, marginBottom: 14 }}>
        ID: {obj.id}
      </p>

      <div className="graph-media-preview">
        {imageUrl ? <img src={imageUrl} alt={`Reference image for ${obj.display}`} /> : <span className="muted">No reference image available</span>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button
          style={{ flex: 1, height: 32, fontSize: 12 }}
          onClick={() => nav(`/objects/${obj.id}`)}
        >
          Open Full Detail
        </Button>
        <div className="graph-add-case-control">
          <Button variant="secondary" style={{ width: "100%", height: 32, fontSize: 12 }} onClick={onAddToCase}>
            Add to Case
          </Button>
          {addCaseOpen ? <AddToCasePopover objectId={obj.id} onClose={onCloseAddToCase} /> : null}
        </div>
      </div>

      {propEntries.length > 0 && (
        <>
          <div
            style={{
              height: 1,
              background: "var(--border)",
              marginBottom: 12,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {propEntries.map(([k, v]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.4px",
                    paddingTop: 1,
                  }}
                >
                  {k}
                </span>
                <span style={{ fontSize: 12, wordBreak: "break-word" }}>{v}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {related.length > 0 && (
        <>
          <div style={{ height: 1, background: "var(--border)", marginBottom: 12 }} />
          <p
            className="eyebrow"
            style={{ marginBottom: 8 }}
          >
            Related Objects
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {related.map(({ obj: rel, link }) => (
              <button
                key={rel.id}
                onClick={() => onSelectNode(rel.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 6px",
                  borderRadius: "var(--radius)",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "background 100ms ease",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "var(--paper)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "none")
                }
              >
                <TypeDot color={nodeColor(rel.type)} size={8} />
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {rel.display}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-secondary)",
                    whiteSpace: "nowrap",
                    marginLeft: 4,
                  }}
                >
                  {link.type.replace(/_/g, " ")}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-secondary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {link.confidence}%
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RelationshipPanel({ link, nodes, onClose, onSelectNode }: { link: Link; nodes: SimNode[]; onClose: () => void; onSelectNode: (id: string) => void }) {
  const from = nodes.find((node) => node.id === link.from);
  const to = nodes.find((node) => node.id === link.to);
  const tone = link.confidence >= 80 ? "high" : link.confidence >= 50 ? "medium" : "low";
  return (
    <div className="graph-slide-panel">
      <div className="graph-inspector-heading">
        <div>
          <p className="eyebrow">Relationship evidence</p>
          <h2 className="serif" style={{ fontSize: 16 }}>{link.type.replace(/_/g, " ")}</h2>
        </div>
        <Button variant="icon" aria-label="Close relationship inspector" onClick={onClose}>×</Button>
      </div>
      <button className="graph-related-card" onClick={() => from && onSelectNode(from.id)}>
        <TypeDot color={from ? nodeColor(from.type) : "var(--ink-secondary)"} size={10} />
        <span>{from?.display ?? link.from}</span>
      </button>
      <div className="graph-relationship-arrow">↓ {link.type.replace(/_/g, " ")} ↓</div>
      <button className="graph-related-card" onClick={() => to && onSelectNode(to.id)}>
        <TypeDot color={to ? nodeColor(to.type) : "var(--ink-secondary)"} size={10} />
        <span>{to?.display ?? link.to}</span>
      </button>
      <div className="graph-inspector-section">
        <p className="eyebrow">Why these are related</p>
        <p className={`conf-${tone}`} style={{ fontSize: 15, fontWeight: 600 }}>{link.confidence}% confidence</p>
        <p className="muted">{link.method === "deterministic" ? "Deterministic match from a verified identifier." : "Probabilistic match based on corroborating attributes."}</p>
      </div>
      <div className="graph-inspector-section">
        <p className="eyebrow">Supporting evidence</p>
        {link.matchedAttributes.map((attribute) => <div className="graph-evidence-row" key={attribute}>{attribute}</div>)}
      </div>
      <div className="graph-inspector-section">
        <p className="eyebrow">Provenance</p>
        <p><span className="muted">Source</span><br />{link.sourceLabel}</p>
        <p><span className="muted">Observed</span><br />{link.observed}</p>
      </div>
    </div>
  );
}

export function GraphPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { objects, links, graphExplorer, setGraphExplorer } = useStore();
  const hops = Math.min(
    GRAPH_POLICY.maximumHops,
    Math.max(GRAPH_POLICY.minimumHops, Number(params.get("hops") || graphExplorer.hops)),
  );
  const nav = useNavigate();

  const originId = id ?? graphExplorer.originId;
  const [selectedId, setSelectedId] = useState<string | null>(graphExplorer.selectedId);
  const [edgePopover, setEdgePopover] = useState<{
    linkId: string;
    x: number;
    y: number;
  } | null>(null);

  const [edgeHover, setEdgeHover] = useState<{
    linkId: string;
    x: number;
    y: number;
  } | null>(null);

  const [addCaseOpen, setAddCaseOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(graphExplorer.layoutVersion);
  const [showLabels, setShowLabels] = useState(graphExplorer.showLabels);
  const [detailMode, setDetailMode] = useState<"all" | "focused">(graphExplorer.detailMode);
  const [nodeMenu, setNodeMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [outlinerVisible, setOutlinerVisible] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodesRef = useRef<SimNode[]>([]);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);
  const [transform, setTransform] = useState<d3.ZoomTransform>(() => d3.zoomIdentity.translate(graphExplorer.transform.x, graphExplorer.transform.y).scale(graphExplorer.transform.k));
  const restoreTransformRef = useRef(graphExplorer.originId === originId);

  useEffect(() => {
    if (!id || id === graphExplorer.originId) return;
    setSelectedId(null);
    setEdgePopover(null);
    setAddCaseOpen(false);
  }, [id, graphExplorer.originId]);

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => (originId ? exploreGraph(objects, links, originId, hops) : { nodes: [], edges: [] }),
    [objects, links, originId, hops],
  );

  useEffect(() => {
    setGraphExplorer({ originId, hops, selectedId, showLabels, detailMode, layoutVersion, transform: { x: transform.x, y: transform.y, k: transform.k } });
  }, [originId, hops, selectedId, showLabels, detailMode, layoutVersion, transform, setGraphExplorer]);

  useEffect(() => {
    if (!originId || rawNodes.length === 0) {
      setSimNodes([]);
      setSimLinks([]);
      nodesRef.current = [];
      return;
    }

    setLoading(true);
    const nodes = layoutNodes(rawNodes, rawEdges, originId, layoutVersion % 2 === 1);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const links = rawEdges.map((edge) => ({ ...edge, source: byId.get(edge.from)!, target: byId.get(edge.to)! }));
    nodesRef.current = nodes;
    setSimNodes(nodes);
    setSimLinks(links);
    const frame = window.requestAnimationFrame(() => {
      setLoading(false);
      const svgEl = svgRef.current;
      const zoom = zoomBehaviorRef.current;
      if (restoreTransformRef.current && svgEl && zoom) {
        const saved = graphExplorer.transform;
        d3.select(svgEl).call(zoom.transform, d3.zoomIdentity.translate(saved.x, saved.y).scale(saved.k));
        restoreTransformRef.current = false;
      } else {
        autoFit();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [originId, hops, rawNodes, rawEdges, layoutVersion]);

  const autoFit = useCallback(() => {
    const svgEl = svgRef.current;
    const zb = zoomBehaviorRef.current;
    if (!svgEl || !zb) return;

    const ns = nodesRef.current;
    if (ns.length === 0) return;

    const W = svgEl.clientWidth;
    const H = svgEl.clientHeight;

    const x0 = Math.min(...ns.map((node) => nodeBounds(node).left)) - 24;
    const y0 = Math.min(...ns.map((node) => nodeBounds(node).top)) - 24;
    const x1 = Math.max(...ns.map((node) => nodeBounds(node).right)) + 24;
    const y1 = Math.max(...ns.map((node) => nodeBounds(node).bottom)) + 24;

    const scale = Math.min(0.95, Math.min(W / (x1 - x0), H / (y1 - y0)));
    const tx = W / 2 - (scale * (x0 + x1)) / 2;
    const ty = H / 2 - (scale * (y0 + y1)) / 2;

    d3.select(svgEl)
      .transition()
      .duration(400)
      .call(zb.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const zb = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([GRAPH_POLICY.zoom.minimum, GRAPH_POLICY.zoom.maximum])
      .filter((event) => event.type === "wheel" || event.button === 0 || event.button === 2)
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        transformRef.current = event.transform;
        setTransform(event.transform);
      });

    zoomBehaviorRef.current = zb;
    d3.select(svgEl).call(zb);

    return () => {
      d3.select(svgEl).on(".zoom", null);
    };
  }, []);

  function handleNodeClick(e: React.MouseEvent, nid: string) {
    e.stopPropagation();
    setEdgePopover(null);
    setSelectedId(nid);
  }

  function handleNodeDoubleClick(e: React.MouseEvent, nid: string) {
    e.stopPropagation();
    nav(`/graph/${nid}?hops=${hops}`);
  }

  function handleCanvasClick() {
    setSelectedId(null);
    setEdgePopover(null);
    setNodeMenu(null);
    setAddCaseOpen(false);
  }

  function handleNodeContextMenu(e: React.MouseEvent, nodeId: string) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(nodeId);
    setEdgePopover(null);
    setNodeMenu({ id: nodeId, x: e.clientX, y: e.clientY });
  }

  function restartLayout() {
    setLayoutVersion((version) => version + 1);
  }

  function handleEdgeClick(e: React.MouseEvent, linkId: string) {
    e.stopPropagation();
    setEdgePopover({ linkId, x: e.clientX, y: e.clientY });
    setSelectedId(null);
  }

  const selectedObj = selectedId
    ? (simNodes.find((n) => n.id === selectedId) ?? objectById(selectedId))
    : null;

  const activeEdge = edgePopover
    ? rawEdges.find((e) => e.id === edgePopover.linkId)
    : null;

  const hoverEdge = edgeHover
    ? rawEdges.find((e) => e.id === edgeHover.linkId)
    : null;

  const visibleNodes = useMemo(() => {
    const focusId = selectedId ?? originId;
    if (detailMode === "all" || !focusId) return simNodes.slice(0, GRAPH_POLICY.rendering.progressiveNodeLimit);
    const connected = new Set([focusId]);
    simLinks.forEach((edge) => {
      const source = edge.source as SimNode;
      const target = edge.target as SimNode;
      if (source.id === focusId) connected.add(target.id);
      if (target.id === focusId) connected.add(source.id);
    });
    return simNodes.filter((node) => connected.has(node.id));
  }, [detailMode, selectedId, originId, simNodes, simLinks]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const renderLabels = showLabels && transform.k >= GRAPH_POLICY.rendering.labelVisibilityScale;
  const originDisplay = originId ? (objects.find((o) => o.id === originId)?.display ?? originId) : "No object selected";

  return (
    <div className="ide-shell">
      <div className="ide-menubar">
        <strong>Sentinel Graph Explorer</strong>
        <span style={{ color: "color-mix(in srgb, var(--paper) 60%, transparent)", fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{originDisplay}</span>
        <span />
        <button type="button" onClick={() => setOutlinerVisible((value) => !value)}>{outlinerVisible ? "Hide outliner" : "Show outliner"}</button>
        <button type="button" onClick={() => nav("/graph/editor")}>Case editor</button>
      </div>

      <div className={`ide-workspace ${outlinerVisible ? "" : "navigator-hidden"}`}>
        {outlinerVisible ? (
          <aside className="ide-files">
            <Outliner
              title="Visible objects"
              objects={rawNodes}
              selectedId={selectedId}
              originId={originId}
              onSelect={(nid) => {
                setSelectedId(nid);
                setEdgePopover(null);
              }}
              emptyLabel="No object selected — search or add one to begin."
            />
          </aside>
        ) : null}

        <main className="ide-main">
          <div className="ide-viewport">
            <div className="ide-viewport-toolbar">
              {originId ? (
                <>
                  <span className="muted" style={{ fontSize: 12 }}>Hops</span>
                  {([1, 2, 3] as const).map((h) => (
                    <Button
                      key={h}
                      variant={hops === h ? "primary" : "secondary"}
                      style={{ width: 30, height: 30, padding: 0, fontSize: 13 }}
                      onClick={() => setParams({ hops: String(h) })}
                      aria-pressed={hops === h}
                    >
                      {h}
                    </Button>
                  ))}

                  <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

                  <Button
                    variant="icon"
                    aria-label="Zoom out"
                    title="Zoom out"
                    style={{ fontSize: 18, fontWeight: 700 }}
                    onClick={() => {
                      const svgEl = svgRef.current;
                      const zb = zoomBehaviorRef.current;
                      if (svgEl && zb) d3.select(svgEl).transition().duration(200).call(zb.scaleBy, GRAPH_POLICY.zoom.outFactor);
                    }}
                  >
                    −
                  </Button>
                  <span className="muted" style={{ minWidth: 38, textAlign: "center", fontSize: 12 }}>
                    {Math.round(transform.k * 100)}%
                  </span>
                  <Button
                    variant="icon"
                    aria-label="Zoom in"
                    title="Zoom in"
                    style={{ fontSize: 16, fontWeight: 700 }}
                    onClick={() => {
                      const svgEl = svgRef.current;
                      const zb = zoomBehaviorRef.current;
                      if (svgEl && zb) d3.select(svgEl).transition().duration(200).call(zb.scaleBy, GRAPH_POLICY.zoom.inFactor);
                    }}
                  >
                    +
                  </Button>
                  <Button variant="secondary" style={{ height: 30, fontSize: 12 }} onClick={autoFit}>
                    Fit to Screen
                  </Button>
                  <Button variant="secondary" style={{ height: 30, fontSize: 12 }} onClick={restartLayout}>
                    Re-layout
                  </Button>
                  <Button variant="secondary" style={{ height: 30, fontSize: 12 }} aria-pressed={showLabels} onClick={() => setShowLabels((visible) => !visible)}>
                    Labels
                  </Button>
                  <Button variant="secondary" style={{ height: 30, fontSize: 12 }} aria-pressed={detailMode === "focused"} onClick={() => setDetailMode((mode) => mode === "all" ? "focused" : "all")}>
                    Focus mode
                  </Button>
                  <Button variant="secondary" style={{ height: 30, fontSize: 12 }} onClick={() => containerRef.current?.requestFullscreen()}>
                    Full screen
                  </Button>
                </>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>
                  Search or pick an object from the outliner to begin exploring. To add or relate objects, use the Case Editor.
                </span>
              )}
            </div>

            <div ref={containerRef} className="ide-viewport-canvas">
              {loading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(255,255,255,0.6)",
                    zIndex: 5,
                    borderRadius: "var(--radius)",
                    pointerEvents: "none",
                  }}
                >
                  <div className="spinner" style={{ width: 24, height: 24 }} />
                </div>
              )}

              {!originId ? (
                <EmptyCanvas />
              ) : (
                <>
                  <svg
                    ref={svgRef}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      background: "var(--panel-bg)",
                      cursor: "default",
                    }}
                    role="application"
                    aria-label="Graph canvas. Scroll to zoom. Drag with the right mouse button to pan. Right-click a node for actions."
                    onClick={handleCanvasClick}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
                      {simLinks.map((e) => {
                        const src = e.source as SimNode;
                        const tgt = e.target as SimNode;
                        if (src.x == null || tgt.x == null) return null;
                        if (!visibleNodeIds.has(src.id) || !visibleNodeIds.has(tgt.id)) return null;
                        const linkId =
                          typeof e.id === "string" ? e.id : `${e.from}-${e.to}`;
                        const isHovered = edgeHover?.linkId === linkId;
                        const isSelected =
                          selectedId &&
                          (src.id === selectedId || tgt.id === selectedId);
                        const source = nodeBounds(src);
                        const target = nodeBounds(tgt);
                        const leftToRight = (src.x ?? 0) <= (tgt.x ?? 0);
                        const x1 = leftToRight ? source.right : source.left;
                        const x2 = leftToRight ? target.left : target.right;
                        const y1 = src.y ?? 0;
                        const y2 = tgt.y ?? 0;
                        const bend = (x2 - x1) / 2;
                        return (
                          <path
                            key={linkId}
                            d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                            fill="none"
                            stroke={isHovered ? GRAPH_POLICY.colors.edgeActive : isSelected ? GRAPH_POLICY.colors.edgeSelected : GRAPH_POLICY.colors.edge}
                            strokeWidth={isHovered ? 2.5 : 1.5}
                            vectorEffect="non-scaling-stroke"
                            style={{ cursor: "pointer", transition: "stroke 80ms ease" }}
                            onClick={(ev) => handleEdgeClick(ev, linkId)}
                            onMouseEnter={(ev) =>
                              setEdgeHover({ linkId, x: ev.clientX, y: ev.clientY })
                            }
                            onMouseMove={(ev) =>
                              setEdgeHover((prev) =>
                                prev?.linkId === linkId
                                  ? { linkId, x: ev.clientX, y: ev.clientY }
                                  : prev,
                              )
                            }
                            onMouseLeave={() => setEdgeHover(null)}
                          />
                        );
                      })}

                      {visibleNodes.map((n) => {
                        if (n.x == null || n.y == null) return null;
                        const isOrigin = n.id === originId;
                        const isSel = n.id === selectedId;
                        const fill = nodeColor(n.type);
                        const labelText = truncateLabel(n.display, 25);
                        const { width, height } = GRAPH_POLICY.node;

                        return (
                          <g
                            key={n.id}
                            className="graph-node-card"
                            transform={`translate(${n.x},${n.y})`}
                            style={{ cursor: "pointer" }}
                            onClick={(ev) => handleNodeClick(ev, n.id)}
                            onDoubleClick={(ev) => handleNodeDoubleClick(ev, n.id)}
                            onContextMenu={(ev) => handleNodeContextMenu(ev, n.id)}
                          >
                            <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={4} fill="var(--panel-bg)" stroke={isOrigin ? GRAPH_POLICY.colors.origin : isSel ? GRAPH_POLICY.colors.selection : "var(--border)"} strokeWidth={isOrigin || isSel ? 2 : 1} />
                            <rect x={-width / 2} y={-height / 2} width={6} height={height} rx={2} fill={fill} />
                            <title>{`${n.type}: ${n.display}. ${n.linkedCount} linked objects.`}</title>
                            <text x={-width / 2 + 16} y={-8} fontSize={10} fill="var(--ink-secondary)" fontFamily="var(--font-sans)" style={{ pointerEvents: "none", userSelect: "none" }}>{n.type.toUpperCase()}</text>
                            <text x={-width / 2 + 16} y={14} fontSize={13} fill="var(--ink)" fontFamily="var(--font-sans)" fontWeight={500} style={{ pointerEvents: "none", userSelect: "none" }}>{renderLabels ? labelText : n.type}</text>
                            <text x={width / 2 - 12} y={-8} textAnchor="end" fontSize={10} fill="var(--ink-secondary)" fontFamily="var(--font-sans)" style={{ pointerEvents: "none", userSelect: "none" }}>{n.linkedCount} links</text>
                          </g>
                        );
                      })}
                    </g>
                  </svg>

                  <ViewportGizmo hops={hops} zoom={transform.k} />
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      <StatusBar
        left={<>
          <span>{originDisplay}</span>
          {originId ? <span className="ide-statusbar-dot" /> : null}
          {originId ? <span>{rawNodes.length} entities · {rawEdges.length} relationships</span> : null}
        </>}
        right={<>
          {originId ? <span>{hops} hop{hops > 1 ? "s" : ""} · {Math.round(transform.k * 100)}% zoom</span> : null}
          <span className="wordmark">SENTINEL Graph IDE</span>
        </>}
      />

      {hoverEdge && edgeHover && !edgePopover && (
        <EdgeTooltip
          link={hoverEdge}
          x={edgeHover.x}
          y={edgeHover.y}
          nodes={simNodes}
        />
      )}

      {nodeMenu ? (
        <div className="graph-context-menu" style={{ left: Math.min(nodeMenu.x, window.innerWidth - 196), top: Math.min(nodeMenu.y, window.innerHeight - 150) }} role="menu">
          <Button variant="link" onClick={() => { nav(`/objects/${nodeMenu.id}`); setNodeMenu(null); }}>Open detail</Button>
          <Button variant="link" onClick={() => { nav(`/graph/${nodeMenu.id}?hops=${hops}`); setNodeMenu(null); }}>Focus graph here</Button>
          <Button variant="link" onClick={() => { setSelectedId(nodeMenu.id); setAddCaseOpen(true); setNodeMenu(null); }}>Add to case</Button>
        </div>
      ) : null}

      {(activeEdge || selectedObj) && (
        <div
          className="graph-slide-panel-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {activeEdge ? <RelationshipPanel link={activeEdge} nodes={simNodes} onClose={() => setEdgePopover(null)} onSelectNode={(nid) => { setEdgePopover(null); nav(`/graph/${nid}?hops=${hops}`); }} /> : selectedObj ? <SlidePanel obj={selectedObj} edges={simLinks} allNodes={simNodes} onClose={() => { setSelectedId(null); setAddCaseOpen(false); }} onSelectNode={(nid) => { setSelectedId(nid); setAddCaseOpen(false); nav(`/graph/${nid}?hops=${hops}`); }} onAddToCase={() => setAddCaseOpen(true)} addCaseOpen={addCaseOpen} onCloseAddToCase={() => setAddCaseOpen(false)} /> : null}
        </div>
      )}
    </div>
  );
}