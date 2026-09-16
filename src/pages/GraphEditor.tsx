import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";
import { ClipboardPaste, Copy, Scissors, Wand2 } from "lucide-react";
import type { Link, ObjectType, OntologyObject } from "../types";
import { typeColor } from "../data/mock";
import { useStore } from "../state/store";
import { Button, Modal, Select, TypeDot } from "../ui/primitives";
import { AddObjectMenu, createObjectStub } from "../features/graph-ide/AddObjectMenu";
import { CommandPalette, Minimap, StatusBar, ZoomControls, useTheme } from "../features/graph-ide/IDEChrome";
import { SHORTCUTS, useShortcut } from "../features/graph-ide/shortcuts";
import "../features/graph-ide/graph-ide.css";

const NODE_W = 216;
const NODE_H = 80;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;
const VIEWPORT_BUFFER = 120;

type Position = { x: number; y: number };
type Transform = { x: number; y: number; zoom: number };
type EditorTab = { caseId: string; dirty: boolean };
type Snapshot = { objectIds: string[]; layout: Record<string, Position>; relationships: Link[] };
type PendingAction = { kind: "tab"; caseId: string } | { kind: "exit" };
type AddMenuState = { clientX: number; clientY: number; canvasX: number; canvasY: number };
type Marquee = { start: Position; current: Position };
type UndoEntry =
  | { kind: "layout"; layout: Record<string, Position> }
  | { kind: "addNode"; objectId: string; position: Position }
  | { kind: "removeNode"; objectId: string }
  | { kind: "addLink"; linkId: string }
  | { kind: "removeLink"; link: Omit<Link, "id"> };

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function rectExitPoint(center: Position, w: number, h: number, towards: Position): Position {
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const sx = dx !== 0 ? (w / 2) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (h / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: center.x + dx * s, y: center.y + dy * s };
}

function curvedPath(start: Position, end: Position, sign: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / dist;
  const ny = dx / dist;
  const curve = Math.min(50, dist * 0.18) * sign;
  const cp = { x: (start.x + end.x) / 2 + nx * curve, y: (start.y + end.y) / 2 + ny * curve };
  const mid = { x: 0.25 * start.x + 0.5 * cp.x + 0.25 * end.x, y: 0.25 * start.y + 0.5 * cp.y + 0.25 * end.y };
  return { path: `M ${start.x} ${start.y} Q ${cp.x} ${cp.y} ${end.x} ${end.y}`, mid };
}

function edgeGeometry(fromPos: Position, toPos: Position) {
  const a = { x: fromPos.x + NODE_W / 2, y: fromPos.y + NODE_H / 2 };
  const b = { x: toPos.x + NODE_W / 2, y: toPos.y + NODE_H / 2 };
  return curvedPath(rectExitPoint(a, NODE_W, NODE_H, b), rectExitPoint(b, NODE_W, NODE_H, a), 1);
}

function previewPath(fromPos: Position, cursor: Position) {
  const a = { x: fromPos.x + NODE_W / 2, y: fromPos.y + NODE_H / 2 };
  return curvedPath(rectExitPoint(a, NODE_W, NODE_H, cursor), cursor, 1).path;
}

function computeAutoLayout(members: OntologyObject[], relations: Link[]): Map<string, Position> {
  type LNode = { id: string } & d3.SimulationNodeDatum;
  const nodes: LNode[] = members.map((m) => ({ id: m.id }));
  const links = relations
    .filter((r) => members.some((m) => m.id === r.from) && members.some((m) => m.id === r.to))
    .map((r) => ({ source: r.from, target: r.to }));
  const cx = 800;
  const cy = 500;
  const sim = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((n) => (n as LNode).id).distance(280).strength(0.5))
    .force("charge", d3.forceManyBody().strength(-1600))
    .force("center", d3.forceCenter(cx, cy))
    .force("collide", d3.forceCollide(Math.max(NODE_W, NODE_H) * 0.75))
    .force("x", d3.forceX(cx).strength(0.02))
    .force("y", d3.forceY(cy).strength(0.02))
    .stop();
  for (let i = 0; i < 400; i++) sim.tick();
  const out = new Map<string, Position>();
  nodes.forEach((n) => {
    out.set(n.id, { x: Math.max(20, (n.x ?? cx) - NODE_W / 2), y: Math.max(20, (n.y ?? cy) - NODE_H / 2) });
  });
  return out;
}

export function GraphEditorPage() {
  const {
    cases, objects, links, user,
    addObjectToCase, removeObjectFromCase, createCase, mergeCases,
    deleteLink, addLink, addObject, updateObject,
    setCaseGraphLayout, restoreCaseGraph, setGraphEditorDirty,
  } = useStore();
  const nav = useNavigate();
  const { isDark, toggle: toggleTheme } = useTheme();

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState<"file" | "edit" | "view" | "help" | null>(null);
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [newName, setNewName] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const active = cases.find((c) => c.id === activeId);
  const comparison = cases.find((c) => c.id === compareId);
  const hasUnsaved = tabs.some((t) => t.dirty);
  const activeRelCount = active
    ? links.filter((l) => active.objectIds.includes(l.from) && active.objectIds.includes(l.to)).length
    : 0;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (hasUnsaved) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  useEffect(() => {
    setGraphEditorDirty(hasUnsaved);
    return () => setGraphEditorDirty(false);
  }, [hasUnsaved, setGraphEditorDirty]);

  useEffect(() => {
    const discard = () => tabs.filter((t) => t.dirty).forEach((t) => discardCase(t.caseId));
    window.addEventListener("sentinel:discard-graph-editor-changes", discard);
    return () => window.removeEventListener("sentinel:discard-graph-editor-changes", discard);
  }, [tabs, snapshots]);

  function openCase(id: string) {
    const rec = cases.find((c) => c.id === id);
    if (!rec) return;
    if (!tabs.some((t) => t.caseId === id)) setTabs((ts) => [...ts, { caseId: id, dirty: false }]);
    if (!snapshots[id]) setSnapshots((s) => ({ ...s, [id]: { objectIds: [...rec.objectIds], layout: { ...(rec.graphLayout ?? {}) }, relationships: links.filter((l) => rec.objectIds.includes(l.from) && rec.objectIds.includes(l.to)) } }));
    setActiveId(id);
  }
  function markDirty(id: string) { setTabs((ts) => ts.map((t) => t.caseId === id ? { ...t, dirty: true } : t)); }
  function markClean(id?: string) { setTabs((ts) => ts.map((t) => !id || t.caseId === id ? { ...t, dirty: false } : t)); }
  function finishClose(id: string) {
    const rest = tabs.filter((t) => t.caseId !== id);
    setTabs(rest);
    if (activeId === id) setActiveId(rest[0]?.caseId ?? null);
    if (compareId === id) setCompareId(null);
    setPendingAction(null);
  }
  function discardCase(id: string) {
    const snap = snapshots[id];
    if (snap) restoreCaseGraph(id, snap.objectIds, snap.layout, snap.relationships);
    markClean(id);
  }
  function requestClose(id: string) {
    if (tabs.find((t) => t.caseId === id)?.dirty) setPendingAction({ kind: "tab", caseId: id });
    else finishClose(id);
  }
  function requestExit() {
    setMenuOpen(null);
    if (hasUnsaved) setPendingAction({ kind: "exit" });
    else nav("/graph");
  }
  function resolvePending(action: "save" | "discard") {
    if (!pendingAction) return;
    if (pendingAction.kind === "tab") {
      if (action === "discard") discardCase(pendingAction.caseId);
      else markClean(pendingAction.caseId);
      finishClose(pendingAction.caseId);
      return;
    }
    if (action === "discard") tabs.filter((t) => t.dirty).forEach((t) => discardCase(t.caseId));
    else markClean();
    setPendingAction(null);
    nav("/graph");
  }
  function saveAsCase() {
    if (!active || !user || !newName.trim()) return;
    const copy = createCase(newName.trim(), user.id);
    active.objectIds.forEach((id) => addObjectToCase(copy.id, id));
    setCaseGraphLayout(copy.id, active.graphLayout ?? {});
    markClean(active.id);
    setSaveAsOpen(false);
    setNewName("");
    openCase(copy.id);
  }
  function toggleMenu(m: "file" | "edit" | "view" | "help") { setMenuOpen((c) => c === m ? null : m); }

  useShortcut(SHORTCUTS.commandPalette.combo, () => setPaletteOpen(true), { allowInEditableFields: true });
  useShortcut(SHORTCUTS.save.combo, () => { if (active) markClean(active.id); }, { allowInEditableFields: true });

  const activeEditorRef = useRef<{ zoomFit: () => void; zoomReset: () => void; autoArrange: () => void; selectNode: (id: string) => void } | null>(null);

  return (
    <div className="ide-shell">
      <div className="ide-titlebar">
        <span className="ide-titlebar-wordmark">SENTINEL</span>
        <Menu label="File" open={menuOpen === "file"} onToggle={() => toggleMenu("file")}>
          <button type="button" disabled={!active} onClick={() => { markClean(active?.id); setMenuOpen(null); }}>Save <span className="ide-menu-shortcut">⌘S</span></button>
          <button type="button" disabled={!active} onClick={() => { if (active) { setNewName(`${active.title} copy`); setSaveAsOpen(true); setMenuOpen(null); } }}>Save as new case…</button>
          <button type="button" disabled={!active} onClick={() => active && requestClose(active.id)}>Close tab</button>
          <hr />
          <button type="button" onClick={requestExit}>Exit Graph Editor</button>
        </Menu>
        <Menu label="Edit" open={menuOpen === "edit"} onToggle={() => toggleMenu("edit")}>
          <button type="button" disabled={!active} onClick={() => { setEditing((v) => !v); setMenuOpen(null); }}>{editing ? "Disable Edit Mode" : "Enable Edit Mode"}</button>
          <button type="button" disabled={!active} onClick={() => { if (active) { discardCase(active.id); setMenuOpen(null); } }}>Revert Changes</button>
        </Menu>
        <Menu label="View" open={menuOpen === "view"} onToggle={() => toggleMenu("view")}>
          <button type="button" onClick={() => { setLeftVisible((v) => !v); setMenuOpen(null); }}>{leftVisible ? "Hide Cases Panel" : "Show Cases Panel"}</button>
          <button type="button" onClick={() => { setRightVisible((v) => !v); setMenuOpen(null); }}>{rightVisible ? "Hide Inspector" : "Show Inspector"}</button>
          <hr />
          <button type="button" onClick={() => { activeEditorRef.current?.zoomFit(); setMenuOpen(null); }}>Zoom to Fit <span className="ide-menu-shortcut">F</span></button>
          <button type="button" onClick={() => { activeEditorRef.current?.zoomReset(); setMenuOpen(null); }}>Reset Zoom <span className="ide-menu-shortcut">0</span></button>
          <button type="button" disabled={!active} onClick={() => { activeEditorRef.current?.autoArrange(); setMenuOpen(null); }}>Auto-Arrange <span className="ide-menu-shortcut">⌘⇧A</span></button>
        </Menu>
        <span className="ide-titlebar-spacer" />
        <div className="ide-titlebar-info">
          {active && (
            <span className={`ide-titlebar-badge ${hasUnsaved ? "dirty" : ""}`}>
              {hasUnsaved ? "● Unsaved" : "Saved"}
            </span>
          )}
          <span style={{ fontSize: 11 }}>{editing ? "Edit mode" : "Read-only"}</span>
        </div>
      </div>

      <div className={`ide-workspace ${leftVisible ? "" : "left-hidden"} ${rightVisible ? "" : "right-hidden"}`}>
        {leftVisible && (
          <div className="ide-panel">
            <div className="ide-panel-header">
              <span className="ide-panel-title">Cases</span>
            </div>
            <div className="ide-panel-body">
              <div className="ide-cases-panel">
                <select
                  className="ide-cases-select"
                  value=""
                  onChange={(e) => e.target.value && openCase(e.target.value)}
                >
                  <option value="">Open saved case…</option>
                  {cases.map((c) => <option key={c.id} value={c.id}>#{c.number} · {c.title}</option>)}
                </select>
                <div className="ide-case-list">
                  {cases.map((c) => (
                    <button
                      key={c.id}
                      className={`ide-case-row ${activeId === c.id ? "active" : ""}`}
                      onClick={() => openCase(c.id)}
                    >
                      <span className="ide-case-row-name">{c.title}</span>
                      <span className="ide-case-row-meta">#{c.number} · {c.objectIds.length} entities</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="ide-main">
          <div className="ide-tabs-bar">
            {tabs.map((tab) => {
              const rec = cases.find((c) => c.id === tab.caseId);
              if (!rec) return null;
              return (
                <div
                  key={tab.caseId}
                  role="tab"
                  aria-selected={activeId === tab.caseId}
                  className={`ide-tab ${activeId === tab.caseId ? "active" : ""}`}
                  onClick={() => setActiveId(tab.caseId)}
                >
                  <span className="ide-tab-label">{rec.title}</span>
                  {tab.dirty && <span className="ide-tab-dirty">●</span>}
                  <button
                    className="ide-tab-close"
                    onClick={(e) => { e.stopPropagation(); requestClose(tab.caseId); }}
                    aria-label={`Close ${rec.title}`}
                  >×</button>
                </div>
              );
            })}
          </div>

          {active ? (
            <CaseEditor
              key={active.id}
              caseId={active.id}
              title={active.title}
              editable={editing}
              layout={active.graphLayout}
              leftPanelVisible={leftVisible}
              rightPanelVisible={rightVisible}
              compareCase={comparison}
              onDirty={() => markDirty(active.id)}
              onLayoutChange={(layout) => setCaseGraphLayout(active.id, layout)}
              onRemove={removeObjectFromCase}
              onDeleteLink={deleteLink}
              onAddLink={addLink}
              onAddToCase={addObjectToCase}
              onCreateObject={addObject}
              onUpdateObject={updateObject}
              onMerge={comparison ? () => { mergeCases(comparison.id, active.id); markDirty(active.id); } : undefined}
              compareLabel={comparison?.title}
              objects={objects}
              links={links}
              editorRef={activeEditorRef}
              onPaletteOpen={() => setPaletteOpen(true)}
            />
          ) : (
            <div className="ide-empty" style={{ flex: 1 }}>
              <div className="ide-empty-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="8" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                  <circle cx="24" cy="24" r="5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <p className="ide-empty-title">No case open</p>
              <p className="ide-empty-sub">Open a saved case from the Cases panel, or create a new one to start building a graph.</p>
            </div>
          )}
        </div>

        {rightVisible && active && (
          <div className="ide-panel right">
            <div className="ide-panel-header">
              <span className="ide-panel-title">Entities · {active.objectIds.length}</span>
            </div>
            <div className="ide-panel-body">
              {comparison && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: "var(--ink-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
                    Compare with
                    <Select
                      value={compareId ?? ""}
                      onChange={(e) => setCompareId(e.target.value || null)}
                    >
                      <option value="">None</option>
                      {tabs.filter((t) => t.caseId !== activeId).map((t) => {
                        const rec = cases.find((c) => c.id === t.caseId);
                        return rec ? <option key={rec.id} value={rec.id}>{rec.title}</option> : null;
                      })}
                    </Select>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <StatusBar
        left={
          <>
            {active ? (
              <>
                <span>{active.title} · #{active.number}</span>
                <span className="ide-statusbar-dot" />
                <span>{active.objectIds.length} entities · {activeRelCount} links</span>
              </>
            ) : (
              <span>No case open</span>
            )}
          </>
        }
        right={
          <>
            {hasUnsaved && <span className="ide-statusbar-warn">Unsaved changes</span>}
            <span>{editing ? "Edit" : "Read-only"}</span>
          </>
        }
        onThemeToggle={toggleTheme}
        isDark={isDark}
      />

      {paletteOpen && (
        <CommandPalette
          objects={objects}
          onClose={() => setPaletteOpen(false)}
          onSelectObject={(id) => { activeEditorRef.current?.selectNode(id); }}
          onZoomFit={() => activeEditorRef.current?.zoomFit()}
          onZoomReset={() => activeEditorRef.current?.zoomReset()}
          onAutoArrange={() => activeEditorRef.current?.autoArrange()}
        />
      )}

      {saveAsOpen && (
        <Modal
          title="Save graph as new case"
          onClose={() => setSaveAsOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setSaveAsOpen(false)}>Cancel</Button><Button disabled={!newName.trim()} onClick={saveAsCase}>Save case</Button></>}
        >
          <label className="form-label">Case name</label>
          <input className="field" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
        </Modal>
      )}
      {pendingAction && (
        <Modal
          title={pendingAction.kind === "exit" ? "Save changes before leaving?" : "Save changes before closing?"}
          onClose={() => setPendingAction(null)}
          footer={<><Button variant="secondary" onClick={() => setPendingAction(null)}>Cancel</Button><Button variant="secondary" onClick={() => resolvePending("discard")}>Discard</Button><Button onClick={() => resolvePending("save")}>Save</Button></>}
        >
          <p className="muted">Your graph changes have not been saved. Save keeps them; Discard restores the original.</p>
        </Modal>
      )}
    </div>
  );
}

function Menu({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="ide-menu">
      <button type="button" aria-expanded={open} onClick={onToggle}>{label}</button>
      {open && <div className="ide-menu-popover">{children}</div>}
    </div>
  );
}

function NodeInspector({
  object, editable, onRename, onRemove, onClose, onFocusExplorer,
}: {
  object: OntologyObject; editable: boolean;
  onRename: (v: string) => void; onRemove: () => void;
  onClose: () => void; onFocusExplorer: () => void;
}) {
  const [value, setValue] = useState(object.display);
  useEffect(() => setValue(object.display), [object.id, object.display]);
  const props = Object.entries(object.properties);

  return (
    <div className="ide-inspector">
      <div className="ide-inspector-heading">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <TypeDot color={typeColor(object.type)} size={7} />
            {object.type}
          </p>
          {editable ? (
            <input
              className="field"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => {
                if (value.trim() && value.trim() !== object.display) onRename(value.trim());
                else setValue(object.display);
              }}
              style={{ fontSize: 13, fontWeight: 500, height: 32 }}
            />
          ) : (
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{object.display}</h2>
          )}
        </div>
        <button className="ide-panel-icon-btn" aria-label="Close inspector" onClick={onClose} style={{ fontSize: 14 }}>×</button>
      </div>
      {props.length > 0 ? (
        <div className="ide-inspector-section">
          <p className="eyebrow">Properties</p>
          <div className="ide-inspector-dl">
            {props.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>No properties recorded yet.</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexDirection: "column" }}>
        <Button variant="secondary" style={{ width: "100%" }} onClick={onFocusExplorer}>Open in Explorer</Button>
        {editable && <Button variant="secondary" style={{ width: "100%" }} onClick={onRemove}>Remove from case</Button>}
      </div>
    </div>
  );
}

function MultiSelectionPanel({ count, names, editable, onCopy, onCut, onRemove, onClose }: {
  count: number; names: string[]; editable: boolean;
  onCopy: () => void; onCut: () => void; onRemove: () => void; onClose: () => void;
}) {
  return (
    <div className="ide-inspector">
      <div className="ide-inspector-heading">
        <p className="eyebrow" style={{ margin: 0 }}>{count} selected</p>
        <button className="ide-panel-icon-btn" aria-label="Clear selection" onClick={onClose}>×</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        <Button variant="secondary" style={{ width: "100%", justifyContent: "flex-start" }} onClick={onCopy}>
          <Copy size={13} strokeWidth={1.75} />Copy
        </Button>
        {editable && (
          <Button variant="secondary" style={{ width: "100%", justifyContent: "flex-start" }} onClick={onCut}>
            <Scissors size={13} strokeWidth={1.75} />Cut
          </Button>
        )}
        {editable && (
          <Button variant="secondary" style={{ width: "100%", justifyContent: "flex-start" }} onClick={onRemove}>
            Remove from case
          </Button>
        )}
      </div>
      <div className="ide-inspector-section">
        <p className="eyebrow">Selected entities</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {names.slice(0, 20).map((n, i) => (
            <p key={`${n}-${i}`} className="truncate" style={{ fontSize: 12, color: "var(--ink-secondary)" }}>{n}</p>
          ))}
          {names.length > 20 && <p className="muted" style={{ fontSize: 11 }}>+{names.length - 20} more</p>}
        </div>
      </div>
    </div>
  );
}

function RelationshipInspector({ link, editable, onDelete }: { link: Link; editable: boolean; onDelete: () => void }) {
  return (
    <div className="ide-inspector">
      <p className="eyebrow">Relationship</p>
      <strong style={{ fontSize: 13, display: "block", marginBottom: 12 }}>{link.type.replace(/_/g, " ")}</strong>
      <div className="ide-inspector-dl">
        <div><dt>Confidence</dt><dd>{link.confidence}%</dd></div>
        <div><dt>Method</dt><dd>{link.method}</dd></div>
        <div><dt>Source</dt><dd>{link.sourceLabel}</dd></div>
        <div><dt>Observed</dt><dd>{link.observed}</dd></div>
        {link.matchedAttributes.length > 0 && (
          <div><dt>Rationale</dt><dd>{link.matchedAttributes.join("; ")}</dd></div>
        )}
      </div>
      {editable && (
        <Button variant="secondary" style={{ width: "100%", marginTop: 12 }} onClick={onDelete}>
          Delete relationship
        </Button>
      )}
    </div>
  );
}

type CaseEditorHandle = {
  zoomFit: () => void;
  zoomReset: () => void;
  autoArrange: () => void;
  selectNode: (id: string) => void;
};

function CaseEditor({
  caseId, title: _title, editable, layout, leftPanelVisible: _leftPanelVisible, rightPanelVisible: _rightPanelVisible,
  compareCase: _compareCase, compareLabel,
  onDirty, onLayoutChange, onRemove, onDeleteLink, onAddLink, onAddToCase,
  onCreateObject, onUpdateObject, onMerge, objects, links, editorRef, onPaletteOpen,
}: {
  caseId: string; title: string; editable: boolean;
  layout?: Record<string, Position>;
  leftPanelVisible: boolean; rightPanelVisible: boolean;
  compareCase?: ReturnType<typeof useStore>["cases"][0];
  compareLabel?: string;
  onDirty: () => void;
  onLayoutChange: (layout: Record<string, Position>) => void;
  onRemove: (caseId: string, objectId: string) => void;
  onDeleteLink: (id: string) => void;
  onAddLink: (link: Omit<Link, "id">) => void;
  onAddToCase: (caseId: string, objectId: string) => void;
  onCreateObject: (o: OntologyObject) => void;
  onUpdateObject: (id: string, patch: Partial<Pick<OntologyObject, "display" | "properties">>) => void;
  onMerge?: () => void;
  objects: ReturnType<typeof useStore>["objects"];
  links: ReturnType<typeof useStore>["links"];
  editorRef: React.MutableRefObject<CaseEditorHandle | null>;
  onPaletteOpen: () => void;
}) {
  const { cases, graphClipboard, setGraphClipboard } = useStore();
  const nav = useNavigate();
  const current = cases.find((c) => c.id === caseId)!;

  const canvasRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const marqueeJustFinished = useRef(false);
  const lastCanvasPoint = useRef<Position>({ x: 400, y: 300 });
  const lastClientPoint = useRef<Position>({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const isSpaceHeld = useRef(false);
  const panStart = useRef<{ client: Position; transform: Transform } | null>(null);
  const rafRef = useRef<number>(0);

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, zoom: 1 });
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [connection, setConnection] = useState<{ fromId: string; point: Position } | null>(null);
  const [draftRelation, setDraftRelation] = useState<{ from: string; to: string } | null>(null);
  const [relType, setRelType] = useState("related_to");
  const [relConf, setRelConf] = useState("100");
  const [relRationale, setRelRationale] = useState("");
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  const members = useMemo(
    () => objects.filter((o) => current.objectIds.includes(o.id)),
    [objects, current.objectIds],
  );
  const relations = useMemo(
    () => links.filter((l) => current.objectIds.includes(l.from) && current.objectIds.includes(l.to)),
    [links, current.objectIds],
  );
  const autoPositions = useMemo(() => computeAutoLayout(members, relations), [members.length]);

  const positioned = useMemo(
    () => members.map((o, i) => ({
      object: o,
      position: layout?.[o.id] ?? autoPositions.get(o.id) ?? { x: 40 + (i % 5) * (NODE_W + 24), y: 40 + Math.floor(i / 5) * (NODE_H + 48) },
    })),
    [members, layout, autoPositions],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      setCanvasSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleCanvasWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleCanvasWheel);
  });

  const visibleNodes = useMemo(() => {
    if (canvasSize.w === 0) return positioned;
    const vx0 = -transform.x / transform.zoom - VIEWPORT_BUFFER / transform.zoom;
    const vy0 = -transform.y / transform.zoom - VIEWPORT_BUFFER / transform.zoom;
    const vx1 = vx0 + canvasSize.w / transform.zoom + (VIEWPORT_BUFFER * 2) / transform.zoom;
    const vy1 = vy0 + canvasSize.h / transform.zoom + (VIEWPORT_BUFFER * 2) / transform.zoom;
    return positioned.filter(({ position }) =>
      position.x < vx1 && position.x + NODE_W > vx0 &&
      position.y < vy1 && position.y + NODE_H > vy0,
    );
  }, [positioned, transform, canvasSize]);

  const selectedLink = relations.find((l) => l.id === selectedLinkId);
  const selectedNodeId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const selectedNode = selectedNodeId ? members.find((m) => m.id === selectedNodeId) : undefined;

  function clientToCanvas(clientX: number, clientY: number): Position {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return lastCanvasPoint.current;
    return {
      x: (clientX - rect.left - transform.x) / transform.zoom,
      y: (clientY - rect.top - transform.y) / transform.zoom,
    };
  }

  function applyTransform(t: Transform) {
    setTransform(t);
    if (transformRef.current) {
      transformRef.current.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.zoom})`;
    }
  }

  function zoomAt(delta: number, clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newZoom = clampZoom(transform.zoom + delta);
    const ox = clientX - rect.left;
    const oy = clientY - rect.top;
    const nx = ox - (ox - transform.x) * (newZoom / transform.zoom);
    const ny = oy - (oy - transform.y) * (newZoom / transform.zoom);
    applyTransform({ x: nx, y: ny, zoom: newZoom });
  }

  function zoomFit() {
    if (positioned.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xs = positioned.map((p) => p.position.x);
    const ys = positioned.map((p) => p.position.y);
    const minX = Math.min(...xs) - 40;
    const minY = Math.min(...ys) - 40;
    const maxX = Math.max(...xs) + NODE_W + 40;
    const maxY = Math.max(...ys) + NODE_H + 40;
    const sceneW = maxX - minX;
    const sceneH = maxY - minY;
    const newZoom = clampZoom(Math.min(rect.width / sceneW, rect.height / sceneH, 1.5));
    const nx = (rect.width - sceneW * newZoom) / 2 - minX * newZoom;
    const ny = (rect.height - sceneH * newZoom) / 2 - minY * newZoom;
    applyTransform({ x: nx, y: ny, zoom: newZoom });
  }

  function zoomReset() {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    applyTransform({ x: rect.width / 2 - 400, y: rect.height / 2 - 300, zoom: 1 });
  }

  function autoArrange() {
    const positions = computeAutoLayout(members, relations);
    const next: Record<string, Position> = { ...(layout ?? {}) };
    members.forEach((m) => { const p = positions.get(m.id); if (p) next[m.id] = p; });
    pushUndo({ kind: "layout", layout: { ...(layout ?? {}) } });
    onLayoutChange(next);
    onDirty();
  }

  function pushUndo(entry: UndoEntry) {
    setUndoStack((s) => [...s.slice(-49), entry]);
    setRedoStack([]);
  }

  function undo() {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      const rest = stack.slice(0, -1);
      if (entry.kind === "layout") onLayoutChange(entry.layout);
      setRedoStack((rs) => [...rs, entry]);
      return rest;
    });
  }

  function redo() {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      const rest = stack.slice(0, -1);
      if (entry.kind === "layout") onLayoutChange(entry.layout);
      setUndoStack((us) => [...us, entry]);
      return rest;
    });
  }

  useShortcut(SHORTCUTS.undo.combo, undo);
  useShortcut(SHORTCUTS.redo.combo, redo);
  useShortcut(SHORTCUTS.zoomFit.combo, zoomFit);
  useShortcut(SHORTCUTS.zoomReset.combo, zoomReset);
  useShortcut(SHORTCUTS.autoArrange.combo, autoArrange, { enabled: editable });
  useShortcut(SHORTCUTS.addObject.combo, () => {
    setAddMenu({ clientX: lastClientPoint.current.x || window.innerWidth / 2 - 120, clientY: lastClientPoint.current.y || window.innerHeight / 2 - 160, canvasX: lastCanvasPoint.current.x, canvasY: lastCanvasPoint.current.y });
  }, { enabled: editable });

  useEffect(() => {
    editorRef.current = { zoomFit, zoomReset, autoArrange, selectNode: (id) => { setSelectedIds(new Set([id])); setSelectedLinkId(null); } };
  });

  useEffect(() => {
    const onSpace = (e: KeyboardEvent) => {
      if (e.code === "Space" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        isSpaceHeld.current = true;
        if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      }
    };
    const offSpace = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceHeld.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", onSpace);
    window.addEventListener("keyup", offSpace);
    return () => { window.removeEventListener("keydown", onSpace); window.removeEventListener("keyup", offSpace); };
  }, []);

  function moveNode(objectId: string, position: Position) {
    onLayoutChange({ ...(layout ?? {}), [objectId]: position });
  }

  function handleCanvasWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) {
      applyTransform({ x: transform.x - e.deltaX, y: transform.y - e.deltaY, zoom: transform.zoom });
      return;
    }
    e.preventDefault();
    const delta = -e.deltaY * 0.001 * 2.5;
    zoomAt(delta * transform.zoom, e.clientX, e.clientY);
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button === 1 || (e.button === 0 && isSpaceHeld.current)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { client: { x: e.clientX, y: e.clientY }, transform: { ...transform } };
      if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
      document.body.classList.add("dragging");
      const onMove = (me: MouseEvent) => {
        if (!panStart.current) return;
        const dx = me.clientX - panStart.current.client.x;
        const dy = me.clientY - panStart.current.client.y;
        const t = { ...panStart.current.transform, x: panStart.current.transform.x + dx, y: panStart.current.transform.y + dy };
        applyTransform(t);
      };
      const onUp = () => {
        isPanning.current = false;
        panStart.current = null;
        document.body.classList.remove("dragging");
        if (canvasRef.current) canvasRef.current.style.cursor = isSpaceHeld.current ? "grab" : "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return;
    }
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    const startCanvas = clientToCanvas(e.clientX, e.clientY);
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const base = additive ? new Set(selectedIds) : new Set<string>();
    let moved = false;
    setMarquee({ start: startCanvas, current: startCanvas });
    document.body.classList.add("dragging");
    const onMove = (me: MouseEvent) => {
      const pt = clientToCanvas(me.clientX, me.clientY);
      if (Math.abs(pt.x - startCanvas.x) + Math.abs(pt.y - startCanvas.y) > 4) moved = true;
      setMarquee({ start: startCanvas, current: pt });
      if (!moved) return;
      const minX = Math.min(startCanvas.x, pt.x);
      const maxX = Math.max(startCanvas.x, pt.x);
      const minY = Math.min(startCanvas.y, pt.y);
      const maxY = Math.max(startCanvas.y, pt.y);
      const hit = new Set(base);
      positioned.forEach(({ object, position }) => {
        if (position.x < maxX && position.x + NODE_W > minX && position.y < maxY && position.y + NODE_H > minY) {
          hit.add(object.id);
        }
      });
      setSelectedIds(hit);
      setSelectedLinkId(null);
    };
    const onUp = () => {
      document.body.classList.remove("dragging");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setMarquee(null);
      marqueeJustFinished.current = moved;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (marqueeJustFinished.current) { marqueeJustFinished.current = false; return; }
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setSelectedLinkId(null);
    setSelectedIds(new Set());
    setDraftRelation(null);
  }

  function handleCanvasContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (!editable) return;
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setSelectedLinkId(null);
    setSelectedIds(new Set());
    setDraftRelation(null);
    const cp = clientToCanvas(e.clientX, e.clientY);
    setAddMenu({ clientX: e.clientX, clientY: e.clientY, canvasX: cp.x, canvasY: cp.y });
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    lastClientPoint.current = { x: e.clientX, y: e.clientY };
    lastCanvasPoint.current = clientToCanvas(e.clientX, e.clientY);
  }

  function beginConnection(objectId: string, e: React.MouseEvent) {
    if (!editable || e.button !== 2) return;
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const update = (me: MouseEvent) => {
      const cp = clientToCanvas(me.clientX, me.clientY);
      setConnection({ fromId: objectId, point: cp });
    };
    const end = (me: MouseEvent) => {
      const target = document.elementFromPoint(me.clientX, me.clientY)?.closest<HTMLElement>("[data-node]");
      const targetId = target?.dataset.node;
      if (targetId && targetId !== objectId) {
        setDraftRelation({ from: objectId, to: targetId });
        setSelectedLinkId(null);
        setSelectedIds(new Set());
      }
      setConnection(null);
      window.removeEventListener("mousemove", update);
      window.removeEventListener("mouseup", end);
    };
    update(e.nativeEvent);
    window.addEventListener("mousemove", update);
    window.addEventListener("mouseup", end);
  }

  function saveRelationship() {
    if (!draftRelation) return;
    const score = Number(relConf);
    onAddLink({ from: draftRelation.from, to: draftRelation.to, type: relType, confidence: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 100, method: "deterministic", sourceId: "manual-editor", sourceLabel: "Manual graph editor", observed: new Date().toISOString().slice(0, 10), matchedAttributes: [relRationale.trim() || "Manually documented relationship"] });
    onDirty();
    setDraftRelation(null);
    setRelRationale("");
    setRelConf("100");
  }

  function handleCopy() {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const snap: Record<string, Position> = {};
    ids.forEach((id) => { const p = positioned.find((pp) => pp.object.id === id)?.position; if (p) snap[id] = p; });
    setGraphClipboard({ objectIds: ids, layout: snap });
  }

  function handleCut() {
    if (!editable || selectedIds.size === 0) return;
    handleCopy();
    selectedIds.forEach((id) => onRemove(caseId, id));
    setSelectedIds(new Set());
    onDirty();
  }

  function handlePaste(pastePoint?: Position) {
    if (!editable || !graphClipboard || graphClipboard.objectIds.length === 0) return;
    const anchor = pastePoint ?? lastCanvasPoint.current;
    const positions = graphClipboard.objectIds.map((id) => graphClipboard.layout[id]).filter(Boolean) as Position[];
    const cx = positions.length ? (Math.min(...positions.map((p) => p.x)) + Math.max(...positions.map((p) => p.x + NODE_W))) / 2 : anchor.x;
    const cy = positions.length ? (Math.min(...positions.map((p) => p.y)) + Math.max(...positions.map((p) => p.y + NODE_H))) / 2 : anchor.y;
    const next: Record<string, Position> = { ...(layout ?? {}) };
    const pasted = new Set<string>();
    graphClipboard.objectIds.forEach((id) => {
      onAddToCase(caseId, id);
      const src = graphClipboard.layout[id];
      const relX = src ? src.x - cx : 0;
      const relY = src ? src.y - cy : 0;
      next[id] = { x: Math.max(0, anchor.x + relX), y: Math.max(0, anchor.y + relY) };
      pasted.add(id);
    });
    onLayoutChange(next);
    setSelectedIds(pasted);
    setSelectedLinkId(null);
    onDirty();
  }

  function handleCreateNew(type: ObjectType) {
    if (!addMenu) return;
    const stub = createObjectStub(type);
    onCreateObject(stub);
    onAddToCase(caseId, stub.id);
    moveNode(stub.id, { x: addMenu.canvasX, y: addMenu.canvasY });
    pushUndo({ kind: "addNode", objectId: stub.id, position: { x: addMenu.canvasX, y: addMenu.canvasY } });
    setSelectedIds(new Set([stub.id]));
    setSelectedLinkId(null);
    onDirty();
  }

  function handlePickExisting(object: OntologyObject) {
    if (!addMenu || current.objectIds.includes(object.id)) return;
    onAddToCase(caseId, object.id);
    moveNode(object.id, { x: addMenu.canvasX, y: addMenu.canvasY });
    setSelectedIds(new Set([object.id]));
    setSelectedLinkId(null);
    onDirty();
  }

  useShortcut(SHORTCUTS.copySelection.combo, handleCopy, { enabled: selectedIds.size > 0 });
  useShortcut(SHORTCUTS.cutSelection.combo, handleCut, { enabled: editable && selectedIds.size > 0 });
  useShortcut(SHORTCUTS.pasteSelection.combo, () => handlePaste(), { enabled: editable && !!graphClipboard && graphClipboard.objectIds.length > 0 });


  const edgesInView = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map((v) => v.object.id));
    return relations.filter((r) => visibleIds.has(r.from) || visibleIds.has(r.to));
  }, [relations, visibleNodes]);

  const minimapNodes = useMemo(() =>
    positioned.map((p) => ({ id: p.object.id, x: p.position.x, y: p.position.y, color: typeColor(p.object.type) })),
    [positioned],
  );

  return (
    <>
      <div className="ide-commandbar">
        <span className="ide-commandbar-stat">
          {members.length} entities · {relations.length} links
        </span>
        <div className="ide-commandbar-divider" />
        {editable && (
          <>
            <button
              className="ide-cmd-btn"
              onClick={() => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const cp = clientToCanvas(cx, cy);
                setAddMenu({ clientX: cx, clientY: cy, canvasX: cp.x, canvasY: cp.y });
              }}
            >
              + Add node
            </button>
            <button className="ide-cmd-btn" onClick={autoArrange}>
              <Wand2 size={11} strokeWidth={1.75} /> Auto-arrange
            </button>
            {graphClipboard && graphClipboard.objectIds.length > 0 && (
              <button className="ide-cmd-btn" onClick={() => handlePaste()}>
                <ClipboardPaste size={11} strokeWidth={1.75} /> Paste ({graphClipboard.objectIds.length})
              </button>
            )}
            <div className="ide-commandbar-divider" />
          </>
        )}
        <button className="ide-cmd-btn" onClick={onPaletteOpen}>
          ⌘K Search
        </button>
        {onMerge && compareLabel && (
          <>
            <div className="ide-commandbar-divider" />
            <button className="ide-cmd-btn" onClick={onMerge}>
              Merge "{compareLabel}" →
            </button>
          </>
        )}
        <div className="ide-commandbar-spacer" />
        {undoStack.length > 0 && (
          <button className="ide-cmd-btn" onClick={undo} title="Undo ⌘Z">⌘Z Undo</button>
        )}
        {redoStack.length > 0 && (
          <button className="ide-cmd-btn" onClick={redo} title="Redo ⌘⇧Z">⌘⇧Z Redo</button>
        )}
      </div>

      <div
        ref={canvasRef}
        className="ide-canvas-wrap"
        onMouseDown={handleCanvasMouseDown}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
        onMouseMove={handleCanvasMouseMove}
      >
        <div
          ref={transformRef}
          className="ide-canvas-transform"
          style={{ transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.zoom})`, transformOrigin: "0 0" }}
        >
          <svg
            className="ide-edge-layer"
            style={{ width: 1, height: 1, overflow: "visible" }}
            aria-label="Graph relationships"
          >
            {edgesInView.map((rel) => {
              const from = positioned.find((p) => p.object.id === rel.from)?.position;
              const to = positioned.find((p) => p.object.id === rel.to)?.position;
              if (!from || !to) return null;
              const { path, mid } = edgeGeometry(from, to);
              const label = rel.type.replace(/_/g, " ");
              const labelW = Math.max(44, label.length * 6 + 16);
              const isSelected = selectedLinkId === rel.id;
              return (
                <g
                  key={rel.id}
                  className={`ide-edge-g ${isSelected ? "selected" : ""}`}
                  onClick={() => { setSelectedLinkId(rel.id); setSelectedIds(new Set()); }}
                >
                  <path className="ide-edge-hit" d={path} />
                  <path
                    className="ide-edge-line"
                    d={path}
                  />
                  <g transform={`translate(${mid.x},${mid.y})`} className="ide-edge-label">
                    <rect x={-labelW / 2} y={-9} width={labelW} height={18} rx={9} />
                    <text x={0} y={1} textAnchor="middle" dominantBaseline="middle">{label}</text>
                  </g>
                </g>
              );
            })}
            {connection && (() => {
              const from = positioned.find((p) => p.object.id === connection.fromId)?.position;
              if (!from) return null;
              return <path className="ide-edge-preview" d={previewPath(from, connection.point)} />;
            })()}
          </svg>

          {visibleNodes.map(({ object, position }) => (
            <NodeCard
              key={object.id}
              object={object}
              position={position}
              isSelected={selectedIds.has(object.id)}
              editable={editable}
              zoom={transform.zoom}
              layout={layout}
              dragged={dragged}
              rafRef={rafRef}
              onBeginConnection={beginConnection}
              onMoveNode={moveNode}
              onSelect={(additive) => {
                setSelectedIds((prev) => {
                  if (additive) {
                    const next = new Set(prev);
                    if (next.has(object.id)) next.delete(object.id);
                    else next.add(object.id);
                    return next;
                  }
                  return new Set([object.id]);
                });
                setSelectedLinkId(null);
                setDraftRelation(null);
              }}
              onRemove={() => {
                onRemove(caseId, object.id);
                setSelectedIds((prev) => { const next = new Set(prev); next.delete(object.id); return next; });
                onDirty();
              }}
              onDirty={onDirty}
              onPushUndo={pushUndo}
            />
          ))}

          {marquee && (() => {
            const x = Math.min(marquee.start.x, marquee.current.x);
            const y = Math.min(marquee.start.y, marquee.current.y);
            const w = Math.abs(marquee.current.x - marquee.start.x);
            const h = Math.abs(marquee.current.y - marquee.start.y);
            return <div className="ide-marquee" style={{ left: x, top: y, width: w, height: h }} />;
          })()}
        </div>

        <ZoomControls
          zoom={transform.zoom}
          onZoomIn={() => zoomAt(ZOOM_STEP * transform.zoom, canvasSize.w / 2, canvasSize.h / 2)}
          onZoomOut={() => zoomAt(-ZOOM_STEP * transform.zoom, canvasSize.w / 2, canvasSize.h / 2)}
          onFit={zoomFit}
          onReset={zoomReset}
        />

        {minimapNodes.length > 0 && (
          <Minimap
            nodes={minimapNodes}
            viewport={{ x: transform.x, y: transform.y, w: canvasSize.w, h: canvasSize.h, canvasW: canvasSize.w / transform.zoom, canvasH: canvasSize.h / transform.zoom }}
            onViewportClick={(cx, cy) => {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect) return;
              applyTransform({ x: rect.width / 2 - cx * transform.zoom, y: rect.height / 2 - cy * transform.zoom, zoom: transform.zoom });
            }}
          />
        )}
      </div>

      {(draftRelation || selectedLink || selectedNode || selectedIds.size > 1) && (
        <div style={{ position: "absolute", right: 0, top: 36 + 38, bottom: 0, width: 260, zIndex: 20, background: "var(--ide-panel)", borderLeft: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="ide-panel-header">
            <span className="ide-panel-title">
              {draftRelation ? "New Relationship" : selectedLink ? "Relationship" : selectedNode ? "Entity" : `${selectedIds.size} Selected`}
            </span>
          </div>
          <div className="ide-panel-body" style={{ overflowY: "auto" }}>
            {draftRelation ? (
              <div className="ide-relationship-form">
                <strong style={{ fontSize: 12.5 }}>New relationship</strong>
                <p style={{ fontSize: 11.5, color: "var(--ink-secondary)", lineHeight: 1.5, overflowWrap: "anywhere" }}>
                  <b>{members.find((m) => m.id === draftRelation.from)?.display ?? draftRelation.from}</b>
                  <span style={{ color: "var(--ink-tertiary)" }}> → </span>
                  <b>{members.find((m) => m.id === draftRelation.to)?.display ?? draftRelation.to}</b>
                </p>
                <label>
                  Type
                  <select className="field ide-relationship-form-select" value={relType} onChange={(e) => setRelType(e.target.value)} style={{ height: 30, fontSize: 12 }}>
                    <option value="related_to">Related to</option>
                    <option value="associated_with">Associated with</option>
                    <option value="uses">Uses</option>
                    <option value="located_at">Located at</option>
                    <option value="owns">Owns</option>
                  </select>
                </label>
                <label>
                  Confidence (%)
                  <input className="field" type="number" min="0" max="100" value={relConf} onChange={(e) => setRelConf(e.target.value)} style={{ height: 30, fontSize: 12 }} />
                </label>
                <label>
                  Rationale
                  <textarea className="field" rows={3} value={relRationale} onChange={(e) => setRelRationale(e.target.value)} placeholder="Evidence or rationale…" style={{ fontSize: 12 }} />
                </label>
                <div className="ide-relationship-form-actions">
                  <Button variant="secondary" style={{ flex: 1 }} onClick={() => setDraftRelation(null)}>Cancel</Button>
                  <Button style={{ flex: 1 }} onClick={saveRelationship}>Save</Button>
                </div>
              </div>
            ) : selectedLink ? (
              <RelationshipInspector
                link={selectedLink}
                editable={editable}
                onDelete={() => { onDeleteLink(selectedLink.id); setSelectedLinkId(null); onDirty(); }}
              />
            ) : selectedNode ? (
              <NodeInspector
                object={selectedNode}
                editable={editable}
                onRename={(v) => onUpdateObject(selectedNode.id, { display: v })}
                onRemove={() => { onRemove(caseId, selectedNode.id); setSelectedIds(new Set()); onDirty(); }}
                onClose={() => setSelectedIds(new Set())}
                onFocusExplorer={() => nav(`/graph/${selectedNode.id}`)}
              />
            ) : selectedIds.size > 1 ? (
              <MultiSelectionPanel
                count={selectedIds.size}
                names={[...selectedIds].map((id) => members.find((m) => m.id === id)?.display ?? id)}
                editable={editable}
                onCopy={handleCopy}
                onCut={handleCut}
                onRemove={() => { selectedIds.forEach((id) => onRemove(caseId, id)); setSelectedIds(new Set()); onDirty(); }}
                onClose={() => setSelectedIds(new Set())}
              />
            ) : null}
          </div>
        </div>
      )}

      {addMenu && (
        <AddObjectMenu
          x={addMenu.clientX}
          y={addMenu.clientY}
          onClose={() => setAddMenu(null)}
          onCreateNew={handleCreateNew}
          onPickExisting={handlePickExisting}
          objects={objects}
          excludeIds={new Set(current.objectIds)}
        />
      )}
    </>
  );
}

function NodeCard({
  object, position, isSelected, editable, zoom, layout, dragged, rafRef,
  onBeginConnection, onMoveNode, onSelect, onRemove, onDirty, onPushUndo,
}: {
  object: OntologyObject;
  position: Position;
  isSelected: boolean;
  editable: boolean;
  zoom: number;
  layout?: Record<string, Position>;
  dragged: React.MutableRefObject<boolean>;
  rafRef: React.MutableRefObject<number>;
  onBeginConnection: (id: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onMoveNode: (id: string, pos: Position) => void;
  onSelect: (additive: boolean) => void;
  onRemove: () => void;
  onDirty: () => void;
  onPushUndo: (entry: UndoEntry) => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const color = typeColor(object.type);

  return (
    <div
      ref={nodeRef}
      data-node={object.id}
      className={`ide-node ${isSelected ? "selected" : ""}`}
      style={{ left: position.x, top: position.y, borderLeftColor: color }}
      onMouseDown={(e) => {
        if (e.button === 2) { onBeginConnection(object.id, e); return; }
        if (!editable || e.button !== 0) return;
        e.stopPropagation();
        dragged.current = false;
        const startX = e.clientX;
        const startY = e.clientY;
        const origin = position;
        const prevLayout = { ...(layout ?? {}) };
        let moved = false;
        document.body.classList.add("dragging");
        const onMove = (me: MouseEvent) => {
          if (Math.abs(me.clientX - startX) + Math.abs(me.clientY - startY) > 3) moved = true;
          const nx = origin.x + (me.clientX - startX) / zoom;
          const ny = origin.y + (me.clientY - startY) / zoom;
          if (nodeRef.current) {
            nodeRef.current.style.left = `${nx}px`;
            nodeRef.current.style.top = `${ny}px`;
          }
          cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
            onMoveNode(object.id, { x: nx, y: ny });
          });
        };
        const onUp = () => {
          document.body.classList.remove("dragging");
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (moved) {
            dragged.current = true;
            onPushUndo({ kind: "layout", layout: prevLayout });
            onDirty();
          }
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
      onClick={(e) => {
        if (dragged.current) { dragged.current = false; return; }
        onSelect(e.shiftKey || e.metaKey || e.ctrlKey);
      }}
    >
      <div className="ide-node-top-row">
        <span className="ide-node-type">{object.type.toUpperCase()}</span>
        <span className="ide-node-links">{object.linkedCount} links</span>
      </div>
      <span className="ide-node-label" title={object.display}>{object.display}</span>
      {editable && (
        <button
          className="ide-node-remove"
          title="Remove from case"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}