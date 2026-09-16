import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Zap, ZoomIn, ZoomOut, Maximize2, RotateCcw, Sun, Moon } from "lucide-react";
import type { ObjectType, OntologyObject } from "../../types";
import { typeColor } from "../../data/mock";
import { TypeDot } from "../../ui/primitives";

export function Outliner({
  title,
  objects,
  selectedId,
  originId,
  onSelect,
  onRemove,
  editable,
  emptyLabel,
}: {
  title: string;
  objects: OntologyObject[];
  selectedId?: string | null;
  originId?: string | null;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  editable?: boolean;
  emptyLabel?: string;
}) {
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const pool = q.length
      ? objects.filter(
          (o) =>
            o.display.toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q),
        )
      : objects;
    const byType = new Map<ObjectType, OntologyObject[]>();
    pool.forEach((object) => {
      byType.set(object.type, [...(byType.get(object.type) ?? []), object]);
    });
    return [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [objects, filter]);

  const totalVisible = useMemo(
    () => groups.reduce((s, [, items]) => s + items.length, 0),
    [groups],
  );

  return (
    <div className="ide-outliner">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <input
          className="ide-outliner-filter"
          placeholder={`Filter ${title.toLowerCase()}…`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label={`Filter ${title.toLowerCase()}`}
          style={{ marginBottom: 0 }}
        />
        {filter && (
          <button
            style={{ background: "transparent", border: 0, color: "var(--ink-tertiary)", cursor: "pointer", padding: 2, display: "flex" }}
            onClick={() => setFilter("")}
            aria-label="Clear filter"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {filter && (
        <div style={{ fontSize: 10.5, color: "var(--ink-tertiary)", marginBottom: 6 }}>
          {totalVisible} of {objects.length} shown
        </div>
      )}
      <div className="ide-outliner-tree">
        {groups.length === 0 ? (
          <p className="muted" style={{ padding: "6px 4px", fontSize: 12 }}>
            {emptyLabel ?? "Nothing here yet."}
          </p>
        ) : (
          groups.map(([type, items]) => (
            <OutlinerGroup
              key={type}
              type={type}
              items={items}
              selectedId={selectedId}
              originId={originId}
              onSelect={onSelect}
              onRemove={editable ? onRemove : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OutlinerGroup({
  type,
  items,
  selectedId,
  originId,
  onSelect,
  onRemove,
}: {
  type: ObjectType;
  items: OntologyObject[];
  selectedId?: string | null;
  originId?: string | null;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const VIRTUAL_THRESHOLD = 40;
  const ROW_HEIGHT = 30;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const isVirtual = items.length > VIRTUAL_THRESHOLD;
  const containerHeight = isVirtual ? Math.min(items.length * ROW_HEIGHT, 300) : undefined;

  const visibleItems = useMemo(() => {
    if (!isVirtual) return items.map((item, i) => ({ item, index: i }));
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2);
    const visCount = Math.ceil((containerHeight ?? 300) / ROW_HEIGHT) + 4;
    return items.slice(start, start + visCount).map((item, i) => ({ item, index: start + i }));
  }, [items, scrollTop, isVirtual, containerHeight]);

  return (
    <div>
      <div className="ide-outliner-group-label">
        <TypeDot color={typeColor(type)} size={6} />
        {type}
        <span className="ide-outliner-group-count">{items.length}</span>
      </div>
      <div
        ref={containerRef}
        style={{ position: "relative", height: containerHeight, overflowY: isVirtual ? "auto" : undefined }}
        onScroll={isVirtual ? (e) => setScrollTop((e.target as HTMLDivElement).scrollTop) : undefined}
      >
        {isVirtual && (
          <div style={{ height: items.length * ROW_HEIGHT, pointerEvents: "none", position: "absolute", width: 1 }} />
        )}
        {visibleItems.map(({ item, index }) => (
          <button
            key={item.id}
            className={`ide-outliner-row ${selectedId === item.id ? "active" : ""} ${originId === item.id ? "origin" : ""}`}
            style={isVirtual ? { position: "absolute", top: index * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT } : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="truncate grow" style={{ fontSize: 12 }}>{item.display}</span>
            {originId === item.id && (
              <span className="ide-outliner-origin-tag">Origin</span>
            )}
            {onRemove && (
              <button
                className="ide-outliner-remove"
                aria-label={`Remove ${item.display}`}
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
              >
                <X size={10} />
              </button>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatusBar({
  left,
  right,
  onThemeToggle,
  isDark,
}: {
  left: ReactNode;
  right?: ReactNode;
  onThemeToggle?: () => void;
  isDark?: boolean;
}) {
  return (
    <div className="ide-statusbar">
      <div className="ide-statusbar-section">
        <span className="ide-statusbar-brand">Sentinel</span>
      </div>
      <div className="ide-statusbar-section" style={{ flex: 1 }}>
        {left}
      </div>
      {right && (
        <div className="ide-statusbar-section right">
          {right}
        </div>
      )}
      {onThemeToggle && (
        <div className="ide-statusbar-section right" style={{ cursor: "pointer", padding: 0 }}>
          <button className="theme-toggle-btn" onClick={onThemeToggle} title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            {isDark ? <Sun size={12} /> : <Moon size={12} />}
            {isDark ? "Light" : "Dark"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ViewportGizmo({ hops, zoom }: { hops: number; zoom: number }) {
  return (
    <div className="ide-viewport-gizmo" aria-hidden>
      <div className="ide-gizmo-ring">{hops}</div>
      <div className="ide-gizmo-badge">{Math.round(zoom * 100)}%</div>
    </div>
  );
}

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}) {
  return (
    <div className="ide-zoom-controls">
      <button className="ide-zoom-btn" onClick={onZoomOut} title="Zoom out (−)">
        <ZoomOut size={13} strokeWidth={1.75} />
      </button>
      <button className="ide-zoom-btn" onClick={onReset} title="Reset zoom (0)" style={{ minWidth: 52 }}>
        {Math.round(zoom * 100)}%
      </button>
      <button className="ide-zoom-btn" onClick={onZoomIn} title="Zoom in (+)">
        <ZoomIn size={13} strokeWidth={1.75} />
      </button>
      <button className="ide-zoom-btn" onClick={onFit} title="Fit all (F)">
        <Maximize2 size={12} strokeWidth={1.75} />
      </button>
    </div>
  );
}

type PaletteItem =
  | { kind: "object"; object: OntologyObject }
  | { kind: "action"; id: string; label: string; sub: string; icon: ReactNode; action: () => void };

export function CommandPalette({
  objects,
  onClose,
  onSelectObject,
  onZoomFit,
  onZoomReset,
  onAutoArrange,
}: {
  objects: OntologyObject[];
  onClose: () => void;
  onSelectObject: (id: string) => void;
  onZoomFit: () => void;
  onZoomReset: () => void;
  onAutoArrange: () => void;
}) {
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const actions: Extract<PaletteItem, { kind: "action" }>[] = useMemo(
    () => [
      { kind: "action", id: "zoom-fit", label: "Zoom to Fit", sub: "F", icon: <Maximize2 size={14} />, action: () => { onZoomFit(); onClose(); } },
      { kind: "action", id: "zoom-reset", label: "Reset Zoom", sub: "0", icon: <RotateCcw size={14} />, action: () => { onZoomReset(); onClose(); } },
      { kind: "action", id: "auto-arrange", label: "Auto-Arrange Nodes", sub: "⌘⇧A", icon: <Zap size={14} />, action: () => { onAutoArrange(); onClose(); } },
    ],
    [onZoomFit, onZoomReset, onAutoArrange, onClose],
  );

  const q = query.trim().toLowerCase();

  const matchedObjects: PaletteItem[] = useMemo(
    () =>
      q.length < 1
        ? []
        : objects
            .filter((o) => o.display.toLowerCase().includes(q) || o.type.toLowerCase().includes(q))
            .slice(0, 8)
            .map((o) => ({ kind: "object" as const, object: o })),
    [objects, q],
  );

  const matchedActions: PaletteItem[] = useMemo(
    () =>
      actions.filter(
        (a) => q.length === 0 || a.label.toLowerCase().includes(q),
      ),
    [actions, q],
  );

  const allItems: PaletteItem[] = [...matchedObjects, ...matchedActions];

  const safeIndex = allItems.length === 0 ? -1 : Math.min(focusedIndex, allItems.length - 1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && safeIndex >= 0) {
        const item = allItems[safeIndex];
        if (item.kind === "object") {
          onSelectObject(item.object.id);
          onClose();
        } else {
          item.action();
        }
      }
    },
    [allItems, safeIndex, onSelectObject, onClose],
  );

  useEffect(() => {
    setFocusedIndex(0);
  }, [query]);

  return (
    <div className="command-palette-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="command-palette" role="dialog" aria-modal aria-label="Command palette">
        <div className="command-palette-input-wrap">
          <Search size={16} className="command-palette-icon" strokeWidth={1.75} />
          <input
            ref={inputRef}
            className="command-palette-input"
            placeholder="Search objects or commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Command palette search"
          />
          <span className="command-palette-hint">ESC</span>
        </div>
        <div className="command-palette-list" role="listbox">
          {matchedObjects.length > 0 && (
            <>
              <div className="command-palette-group-label">Objects</div>
              {matchedObjects.map((item, i) => {
                if (item.kind !== "object") return null;
                const isFocused = i === safeIndex;
                return (
                  <button
                    key={item.object.id}
                    role="option"
                    aria-selected={isFocused}
                    className={`command-palette-item ${isFocused ? "focused" : ""}`}
                    onClick={() => { onSelectObject(item.object.id); onClose(); }}
                  >
                    <span className="command-palette-item-icon">
                      <TypeDot color={typeColor(item.object.type)} size={8} />
                    </span>
                    <span className="command-palette-item-label">{item.object.display}</span>
                    <span className="command-palette-item-sub">{item.object.type}</span>
                  </button>
                );
              })}
            </>
          )}
          {matchedActions.length > 0 && (
            <>
              <div className="command-palette-group-label">Actions</div>
              {matchedActions.map((item, i) => {
                if (item.kind !== "action") return null;
                const absIndex = matchedObjects.length + i;
                const isFocused = absIndex === safeIndex;
                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={isFocused}
                    className={`command-palette-item ${isFocused ? "focused" : ""}`}
                    onClick={item.action}
                  >
                    <span className="command-palette-item-icon">{item.icon}</span>
                    <span className="command-palette-item-label">{item.label}</span>
                    <span className="command-palette-item-sub">{item.sub}</span>
                  </button>
                );
              })}
            </>
          )}
          {allItems.length === 0 && q.length > 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--ink-tertiary)", fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}
          {allItems.length === 0 && q.length === 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--ink-tertiary)", fontSize: 13 }}>
              Type to search objects or actions
            </div>
          )}
        </div>
        <div className="command-palette-footer">
          <span><span className="command-palette-key">↑↓</span> Navigate</span>
          <span><span className="command-palette-key">↵</span> Select</span>
          <span><span className="command-palette-key">ESC</span> Close</span>
        </div>
      </div>
    </div>
  );
}

type MinimapNode = { id: string; x: number; y: number; color: string };

export function Minimap({
  nodes,
  viewport,
  onViewportClick,
}: {
  nodes: MinimapNode[];
  viewport: { x: number; y: number; w: number; h: number; canvasW: number; canvasH: number };
  onViewportClick: (cx: number, cy: number) => void;
}) {
  const W = 160;
  const H = 100;
  const PADDING = 12;

  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    return {
      minX: Math.min(...xs) - PADDING,
      minY: Math.min(...ys) - PADDING,
      maxX: Math.max(...xs) + 216 + PADDING,
      maxY: Math.max(...ys) + 80 + PADDING,
    };
  }, [nodes]);

  const sceneW = Math.max(1, bounds.maxX - bounds.minX);
  const sceneH = Math.max(1, bounds.maxY - bounds.minY);
  const scaleX = W / sceneW;
  const scaleY = H / sceneH;
  const scale = Math.min(scaleX, scaleY);

  const toMini = (x: number, y: number) => ({
    mx: (x - bounds.minX) * scale + (W - sceneW * scale) / 2,
    my: (y - bounds.minY) * scale + (H - sceneH * scale) / 2,
  });

  const vp = toMini(-viewport.x / (viewport.canvasW || 1) * sceneW + bounds.minX, -viewport.y / (viewport.canvasH || 1) * sceneH + bounds.minY);

  const vpW = (viewport.w / Math.max(1, viewport.canvasW)) * sceneW * scale;
  const vpH = (viewport.h / Math.max(1, viewport.canvasH)) * sceneH * scale;

  return (
    <div
      className="ide-minimap"
      style={{ width: W, height: H }}
      title="Minimap — click to pan"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const cx = (mx - (W - sceneW * scale) / 2) / scale + bounds.minX;
        const cy = (my - (H - sceneH * scale) / 2) / scale + bounds.minY;
        onViewportClick(cx, cy);
      }}
    >
      <svg width={W} height={H} style={{ display: "block" }}>
        {nodes.map((n) => {
          const { mx, my } = toMini(n.x, n.y);
          return (
            <rect
              key={n.id}
              x={mx}
              y={my}
              width={Math.max(3, 216 * scale)}
              height={Math.max(2, 80 * scale)}
              rx={2}
              fill={n.color}
              fillOpacity={0.7}
            />
          );
        })}
        <rect
          className="ide-minimap-viewport"
          x={vp.mx}
          y={vp.my}
          width={Math.max(4, vpW)}
          height={Math.max(3, vpH)}
        />
      </svg>
    </div>
  );
}

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("sentinel-theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("sentinel-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((d) => !d), []);
  return { isDark, toggle };
}