import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { Link, ObjectType, OntologyObject } from "../types";
import { typeColor } from "../data/mock";
import { useStore } from "../state/store";
import { Button, Modal, Select, TypeDot } from "../ui/primitives";
import { AddObjectMenu, createObjectStub } from "../features/graph-ide/AddObjectMenu";
import { Outliner, StatusBar } from "../features/graph-ide/IDEChrome";
import { SHORTCUTS, useShortcut } from "../features/graph-ide/shortcuts";
import "../features/graph-ide/graph-ide.css";

type Position = { x: number; y: number };
type EditorTab = { caseId: string; dirty: boolean };
type Snapshot = { objectIds: string[]; graphLayout: Record<string, Position>; relationships: Link[] };
type PendingAction = { kind: "tab"; caseId: string } | { kind: "exit" };
type AddMenuState = { x: number; y: number; point: Position };

export function GraphEditorPage() {
  const { cases, objects, links, user, addObjectToCase, removeObjectFromCase, createCase, mergeCases, deleteLink, addLink, addObject, updateObject, setCaseGraphLayout, restoreCaseGraph, setGraphEditorDirty } = useStore();
  const nav = useNavigate();
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState<"file" | "edit" | "view" | "help" | null>(null);
  const [filesVisible, setFilesVisible] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [newName, setNewName] = useState("");
  const active = cases.find((item) => item.id === activeId);
  const comparison = cases.find((item) => item.id === compareId);
  const hasUnsavedChanges = tabs.some((tab) => tab.dirty);
  const activeRelationCount = active ? links.filter((link) => active.objectIds.includes(link.from) && active.objectIds.includes(link.to)).length : 0;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    setGraphEditorDirty(hasUnsavedChanges);
    return () => setGraphEditorDirty(false);
  }, [hasUnsavedChanges, setGraphEditorDirty]);

  useEffect(() => {
    const discard = () => tabs.filter((tab) => tab.dirty).forEach((tab) => discardCase(tab.caseId));
    window.addEventListener("sentinel:discard-graph-editor-changes", discard);
    return () => window.removeEventListener("sentinel:discard-graph-editor-changes", discard);
  }, [tabs, snapshots]);

  function openCase(caseId: string) {
    const record = cases.find((item) => item.id === caseId);
    if (!record) return;
    if (!tabs.some((tab) => tab.caseId === caseId)) setTabs((items) => [...items, { caseId, dirty: false }]);
    if (!snapshots[caseId]) setSnapshots((items) => ({ ...items, [caseId]: { objectIds: [...record.objectIds], graphLayout: { ...(record.graphLayout ?? {}) }, relationships: links.filter((link) => record.objectIds.includes(link.from) && record.objectIds.includes(link.to)) } }));
    setActiveId(caseId);
  }

  function markDirty(caseId: string) { setTabs((items) => items.map((tab) => tab.caseId === caseId ? { ...tab, dirty: true } : tab)); }
  function markClean(caseId?: string) { setTabs((items) => items.map((tab) => !caseId || tab.caseId === caseId ? { ...tab, dirty: false } : tab)); }
  function finishClose(caseId: string) {
    const remaining = tabs.filter((tab) => tab.caseId !== caseId);
    setTabs(remaining);
    if (activeId === caseId) setActiveId(remaining[0]?.caseId ?? null);
    if (compareId === caseId) setCompareId(null);
    setPendingAction(null);
  }
  function discardCase(caseId: string) {
    const snapshot = snapshots[caseId];
    if (snapshot) restoreCaseGraph(caseId, snapshot.objectIds, snapshot.graphLayout, snapshot.relationships);
    markClean(caseId);
  }
  function requestClose(caseId: string) {
    if (tabs.find((tab) => tab.caseId === caseId)?.dirty) setPendingAction({ kind: "tab", caseId });
    else finishClose(caseId);
  }
  function requestExit() {
    setMenuOpen(null);
    if (hasUnsavedChanges) setPendingAction({ kind: "exit" });
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
    if (action === "discard") tabs.filter((tab) => tab.dirty).forEach((tab) => discardCase(tab.caseId));
    else markClean();
    setPendingAction(null);
    nav("/graph");
  }
  function saveAsCase() {
    if (!active || !user || !newName.trim()) return;
    const copy = createCase(newName.trim(), user.id);
    active.objectIds.forEach((objectId) => addObjectToCase(copy.id, objectId));
    setCaseGraphLayout(copy.id, active.graphLayout ?? {});
    markClean(active.id);
    setSaveAsOpen(false);
    setNewName("");
    openCase(copy.id);
  }
  function openSaveAs() {
    if (!active) return;
    setMenuOpen(null);
    setNewName(`${active.title} copy`);
    setSaveAsOpen(true);
  }
  function toggleMenu(menu: "file" | "edit" | "view" | "help") { setMenuOpen((current) => current === menu ? null : menu); }

  return <div className="ide-shell">
    <div className="ide-menubar">
      <strong>Sentinel Graph Editor</strong>
      <Menu label="File" open={menuOpen === "file"} onToggle={() => toggleMenu("file")}><button type="button" disabled={!active} onClick={() => { markClean(active?.id); setMenuOpen(null); }}>Save</button><button type="button" disabled={!active} onClick={openSaveAs}>Save as new case…</button><button type="button" disabled={!active} onClick={() => active && requestClose(active.id)}>Close graph tab</button><hr /><button type="button" onClick={requestExit}>Exit Graph Explorer</button></Menu>
      <Menu label="Edit" open={menuOpen === "edit"} onToggle={() => toggleMenu("edit")}><button type="button" disabled={!active} onClick={() => { setEditing((value) => !value); setMenuOpen(null); }}>{editing ? "Disable edit mode" : "Enable edit mode"}</button><button type="button" disabled={!active} onClick={() => { if (active) { discardCase(active.id); setMenuOpen(null); } }}>Revert unsaved changes</button></Menu>
      <Menu label="View" open={menuOpen === "view"} onToggle={() => toggleMenu("view")}><button type="button" onClick={() => { setFilesVisible((value) => !value); setMenuOpen(null); }}>{filesVisible ? "Hide case navigator" : "Show case navigator"}</button><button type="button" onClick={() => { window.dispatchEvent(new Event("sentinel:toggle-editor-topbar")); setMenuOpen(null); }}>Toggle global search <span className="ide-menu-shortcut">{SHORTCUTS.toggleGlobalSearch.label}</span></button></Menu>
      <Menu label="Help" open={menuOpen === "help"} onToggle={() => toggleMenu("help")}><button type="button" onClick={() => { setHelpOpen(true); setMenuOpen(null); }}>Graph interaction guide</button></Menu>
      <span />
      <small>{editing ? "Edit mode" : "Read-only mode"}</small>
    </div>
    <div className={`ide-workspace ${filesVisible ? "" : "navigator-hidden"}`}>
      {filesVisible ? <aside className="ide-files"><p className="eyebrow">Cases</p><Select value="" onChange={(event) => event.target.value && openCase(event.target.value)}><option value="">Open saved case…</option>{cases.map((item) => <option key={item.id} value={item.id}>#{item.number} · {item.title}</option>)}</Select><div className="ide-case-list">{cases.map((item) => <button key={item.id} className={activeId === item.id ? "active" : ""} onClick={() => openCase(item.id)}>{item.title}<small>#{item.number} · {item.objectIds.length} entities</small></button>)}</div></aside> : null}
      <main className="ide-main">
        {helpOpen ? <div className="ide-help"><strong>Graph interactions</strong><span>Enter Edit mode. Right-click empty canvas or press Shift+A to add an object. Right-click a card, hold the button, drag to another card, and release to relate them. Drag with the left button to move a card.</span><button type="button" onClick={() => setHelpOpen(false)}>Dismiss</button></div> : null}
        <div className="ide-commandbar"><span>{active ? `${active.objectIds.length} entities · ${activeRelationCount} relationships` : "No case open"}</span><label>Compare <Select value={compareId ?? ""} onChange={(event) => setCompareId(event.target.value || null)}><option value="">None</option>{tabs.filter((tab) => tab.caseId !== activeId).map((tab) => { const item = cases.find((caseItem) => caseItem.id === tab.caseId); return item ? <option key={item.id} value={item.id}>{item.title}</option> : null; })}</Select></label>{comparison && active ? <Button variant="secondary" onClick={() => { mergeCases(comparison.id, active.id); markDirty(active.id); }}>Merge into active</Button> : null}</div>
        {tabs.length ? <div className="editor-tabs">{tabs.map((tab) => { const item = cases.find((caseItem) => caseItem.id === tab.caseId); return item ? <button key={tab.caseId} className={`editor-tab ${activeId === tab.caseId ? "active" : ""}`} onClick={() => setActiveId(tab.caseId)}>{item.title}{tab.dirty ? " •" : ""}<span onClick={(event) => { event.stopPropagation(); requestClose(tab.caseId); }}>×</span></button> : null; })}</div> : null}
        {active ? <div className="editor-canvas-grid"><CaseEditor caseId={active.id} title={active.title} editable={editing} layout={active.graphLayout} onDirty={() => markDirty(active.id)} onLayoutChange={(layout) => setCaseGraphLayout(active.id, layout)} onRemove={removeObjectFromCase} onDeleteLink={deleteLink} onAddLink={addLink} onAddToCase={addObjectToCase} onCreateObject={addObject} onUpdateObject={updateObject} objects={objects} links={links} />{comparison ? <CaseEditor caseId={comparison.id} title={comparison.title} editable={false} layout={comparison.graphLayout} onDirty={() => undefined} onLayoutChange={() => undefined} onRemove={removeObjectFromCase} onDeleteLink={deleteLink} onAddLink={addLink} onAddToCase={addObjectToCase} onCreateObject={addObject} onUpdateObject={updateObject} objects={objects} links={links} /> : null}</div> : <div className="empty"><p className="empty-title">Open a saved case to start editing</p><p className="muted">Use the Cases navigator to load a graph, or open a second case for side-by-side comparison.</p></div>}
      </main>
    </div>
    <StatusBar
      left={<>
        <span>{active ? `${active.title} · #${active.number}` : "No case open"}</span>
        {active ? <span className="ide-statusbar-dot" /> : null}
        {active ? <span>{active.objectIds.length} entities · {activeRelationCount} relationships</span> : null}
      </>}
      right={<>
        <span>{editing ? "Edit mode" : "Read-only"}</span>
        {hasUnsavedChanges ? <span className="ide-statusbar-warn">Unsaved changes</span> : null}
        <span className="wordmark">SENTINEL Graph IDE</span>
      </>}
    />
    {saveAsOpen ? <Modal title="Save graph as a new case" onClose={() => setSaveAsOpen(false)} footer={<><Button variant="secondary" onClick={() => setSaveAsOpen(false)}>Cancel</Button><Button disabled={!newName.trim()} onClick={saveAsCase}>Save case</Button></>}><label className="form-label">Case name</label><input className="field" autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} /></Modal> : null}
    {pendingAction ? <Modal title={pendingAction.kind === "exit" ? "Save changes before leaving?" : "Save changes before closing?"} onClose={() => setPendingAction(null)} footer={<><Button variant="secondary" onClick={() => setPendingAction(null)}>Cancel</Button><Button variant="secondary" onClick={() => resolvePending("discard")}>Discard changes</Button><Button onClick={() => resolvePending("save")}>Save changes</Button></>}><p className="muted">Your manual graph changes have not been saved. Choose whether to save them to this case or discard them and restore the last opened version.</p></Modal> : null}
  </div>;
}

function Menu({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="ide-menu"><button type="button" aria-expanded={open} onClick={onToggle}>{label}</button>{open ? <div className="ide-menu-popover">{children}</div> : null}</div>;
}

function NodeInspector({
  object,
  editable,
  onRename,
  onRemove,
  onClose,
  onFocusExplorer,
}: {
  object: OntologyObject;
  editable: boolean;
  onRename: (value: string) => void;
  onRemove: () => void;
  onClose: () => void;
  onFocusExplorer: () => void;
}) {
  const [value, setValue] = useState(object.display);
  useEffect(() => setValue(object.display), [object.id, object.display]);
  const propEntries = Object.entries(object.properties);

  return (
    <div>
      <div className="graph-inspector-heading">
        <div>
          <p className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TypeDot color={typeColor(object.type)} size={8} />
            {object.type}
          </p>
          {editable ? (
            <input
              className="field"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onBlur={() => {
                if (value.trim() && value.trim() !== object.display) onRename(value.trim());
                else setValue(object.display);
              }}
              style={{ fontSize: 15, fontWeight: 500, padding: "6px 8px" }}
            />
          ) : (
            <h2 className="serif" style={{ fontSize: 16 }}>{object.display}</h2>
          )}
        </div>
        <Button variant="icon" aria-label="Back to case outliner" onClick={onClose}>×</Button>
      </div>
      {propEntries.length ? (
        <div className="graph-inspector-section">
          <p className="eyebrow">Properties</p>
          {propEntries.map(([key, val]) => (
            <p key={key} style={{ marginBottom: 6 }}>
              <span className="muted">{key}</span>
              <br />
              {val}
            </p>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 14 }}>No properties recorded yet.</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button variant="secondary" style={{ flex: 1 }} onClick={onFocusExplorer}>Open in Explorer</Button>
        {editable ? <Button variant="secondary" onClick={onRemove}>Remove</Button> : null}
      </div>
    </div>
  );
}

function CaseEditor({ caseId, title, editable, layout, onDirty, onLayoutChange, onRemove, onDeleteLink, onAddLink, onAddToCase, onCreateObject, onUpdateObject, objects, links }: { caseId: string; title: string; editable: boolean; layout?: Record<string, Position>; onDirty: () => void; onLayoutChange: (layout: Record<string, Position>) => void; onRemove: (caseId: string, objectId: string) => void; onDeleteLink: (id: string) => void; onAddLink: (link: Omit<Link, "id">) => void; onAddToCase: (caseId: string, objectId: string) => void; onCreateObject: (object: OntologyObject) => void; onUpdateObject: (id: string, patch: Partial<Pick<OntologyObject, "display" | "properties">>) => void; objects: ReturnType<typeof useStore>["objects"]; links: ReturnType<typeof useStore>["links"] }) {
  const { cases } = useStore();
  const nav = useNavigate();
  const current = cases.find((item) => item.id === caseId)!;
  const stageRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const lastStagePoint = useRef<Position>({ x: 460, y: 280 });
  const lastClientPoint = useRef<Position>({ x: 0, y: 0 });
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connection, setConnection] = useState<{ fromId: string; point: Position } | null>(null);
  const [draftRelation, setDraftRelation] = useState<{ from: string; to: string } | null>(null);
  const [relationType, setRelationType] = useState("related_to");
  const [confidence, setConfidence] = useState("100");
  const [rationale, setRationale] = useState("");
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const members = useMemo(() => objects.filter((object) => current.objectIds.includes(object.id)), [objects, current.objectIds]);
  const relations = useMemo(() => links.filter((link) => current.objectIds.includes(link.from) && current.objectIds.includes(link.to)), [links, current.objectIds]);
  const positioned = members.map((object, index) => ({ object, position: layout?.[object.id] ?? { x: 48 + (index % 4) * 238, y: 56 + Math.floor(index / 4) * 142 } }));
  const selectedLink = relations.find((link) => link.id === selectedLinkId);
  const selectedNode = selectedNodeId ? members.find((item) => item.id === selectedNodeId) : undefined;
  const getObject = (id: string) => members.find((item) => item.id === id);
  const pointFor = (from: Position, to: Position) => ({ x1: from.x + (to.x >= from.x ? 184 : 0), y1: from.y + 35, x2: to.x + (to.x >= from.x ? 0 : 184), y2: to.y + 35 });
  const smoothPath = (start: Position, end: Position) => {
    const offset = Math.max(52, Math.abs(end.x - start.x) * 0.42) * (end.x >= start.x ? 1 : -1);
    return `M ${start.x} ${start.y} C ${start.x + offset} ${start.y}, ${end.x - offset} ${end.y}, ${end.x} ${end.y}`;
  };
  function moveNode(objectId: string, position: Position) { onLayoutChange({ ...(layout ?? {}), [objectId]: position }); }
  function clientToStage(clientX: number, clientY: number): Position {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return lastStagePoint.current;
    return { x: Math.max(0, Math.min(1120, clientX - rect.left)), y: Math.max(0, Math.min(680, clientY - rect.top)) };
  }
  function beginConnection(objectId: string, event: React.MouseEvent<HTMLDivElement>) {
    if (!editable || event.button !== 2 || !stageRef.current) return;
    event.preventDefault();
    const rect = stageRef.current.getBoundingClientRect();
    const update = (moveEvent: MouseEvent) => setConnection({ fromId: objectId, point: { x: Math.max(0, Math.min(1120, moveEvent.clientX - rect.left)), y: Math.max(0, Math.min(680, moveEvent.clientY - rect.top)) } });
    const end = (upEvent: MouseEvent) => {
      const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest<HTMLElement>("[data-graph-node]");
      const targetId = target?.dataset.graphNode;
      if (targetId && targetId !== objectId) {
        setDraftRelation({ from: objectId, to: targetId });
        setSelectedLinkId(null);
        setSelectedNodeId(null);
      }
      setConnection(null);
      window.removeEventListener("mousemove", update);
      window.removeEventListener("mouseup", end);
    };
    update(event.nativeEvent);
    window.addEventListener("mousemove", update);
    window.addEventListener("mouseup", end);
  }
  function saveRelationship() {
    if (!draftRelation) return;
    const score = Number(confidence);
    onAddLink({ from: draftRelation.from, to: draftRelation.to, type: relationType, confidence: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 100, method: "deterministic", sourceId: "manual-editor", sourceLabel: "Manual graph editor", observed: new Date().toISOString().slice(0, 10), matchedAttributes: [rationale.trim() || "Manually documented relationship"] });
    onDirty();
    setDraftRelation(null);
    setRationale("");
    setConfidence("100");
  }
  function handleStageMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    lastStagePoint.current = clientToStage(event.clientX, event.clientY);
    lastClientPoint.current = { x: event.clientX, y: event.clientY };
  }
  function handleStageContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!editable) return;
    if ((event.target as HTMLElement).closest("[data-graph-node]")) return;
    setSelectedLinkId(null);
    setSelectedNodeId(null);
    setDraftRelation(null);
    setAddMenu({ x: event.clientX, y: event.clientY, point: clientToStage(event.clientX, event.clientY) });
  }
  function handleStageClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-graph-node]")) return;
    setSelectedLinkId(null);
    setSelectedNodeId(null);
    setDraftRelation(null);
  }
  useShortcut(SHORTCUTS.addObject.combo, () => {
    setAddMenu({ x: lastClientPoint.current.x || window.innerWidth / 2 - 120, y: lastClientPoint.current.y || window.innerHeight / 2 - 160, point: lastStagePoint.current });
  }, { enabled: editable });
  function handleCreateNew(type: ObjectType) {
    if (!addMenu) return;
    const stub = createObjectStub(type);
    onCreateObject(stub);
    onAddToCase(caseId, stub.id);
    moveNode(stub.id, addMenu.point);
    setSelectedNodeId(stub.id);
    setSelectedLinkId(null);
    onDirty();
  }
  function handlePickExisting(object: OntologyObject) {
    if (!addMenu || current.objectIds.includes(object.id)) return;
    onAddToCase(caseId, object.id);
    moveNode(object.id, addMenu.point);
    setSelectedNodeId(object.id);
    setSelectedLinkId(null);
    onDirty();
  }

  return <section className="case-editor">
    <header><div><strong>{title}</strong><span>{editable ? "Editing enabled" : "Read-only graph"}</span></div><span>{members.length} entities · {relations.length} relationships</span></header>
    {editable ? <div className="case-editor-tools"><span>Right-click the canvas or press {SHORTCUTS.addObject.label} to add an object. Right-click and drag between cards to relate them.</span><Button variant="secondary" onClick={(event) => { const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(); setAddMenu({ x: rect.left, y: rect.bottom + 6, point: lastStagePoint.current }); }}><Plus size={13} strokeWidth={1.75} style={{ marginRight: 4 }} />Add</Button></div> : null}
    <div className="case-editor-workspace"><div className="case-editor-canvas"><div className="case-editor-stage" ref={stageRef} onContextMenu={handleStageContextMenu} onClick={handleStageClick} onMouseMove={handleStageMouseMove}><svg className="case-editor-edges" aria-label="Graph relationships" viewBox="0 0 1120 680" preserveAspectRatio="none"><defs><marker id={`arrow-${caseId}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker></defs>{relations.map((relation) => { const from = positioned.find((item) => item.object.id === relation.from)?.position; const to = positioned.find((item) => item.object.id === relation.to)?.position; if (!from || !to) return null; const points = pointFor(from, to); const path = smoothPath({ x: points.x1, y: points.y1 }, { x: points.x2, y: points.y2 }); return <g key={relation.id} className={selectedLinkId === relation.id ? "selected" : ""} onClick={() => { setSelectedLinkId(relation.id); setSelectedNodeId(null); }}><path className="case-editor-edge-hit" d={path} /><path className="case-editor-edge-line" d={path} markerEnd={`url(#arrow-${caseId})`} /></g>; })}{connection ? (() => { const from = positioned.find((item) => item.object.id === connection.fromId)?.position; if (!from) return null; const start = { x: from.x + (connection.point.x >= from.x ? 184 : 0), y: from.y + 35 }; return <path className="case-editor-connection-preview" d={smoothPath(start, connection.point)} />; })() : null}</svg>{positioned.map(({ object, position }) => <div key={object.id} data-graph-node={object.id} className={`case-editor-node ${selectedNodeId === object.id ? "selected" : ""}`} style={{ left: position.x, top: position.y }} onMouseDown={(event) => { if (event.button === 2) { beginConnection(object.id, event); return; } if (!editable || event.button !== 0) return; dragged.current = false; const startX = event.clientX; const startY = event.clientY; const origin = position; let moved = false; const move = (moveEvent: MouseEvent) => { if (Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) > 3) moved = true; moveNode(object.id, { x: Math.max(0, origin.x + moveEvent.clientX - startX), y: Math.max(0, origin.y + moveEvent.clientY - startY) }); }; const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); if (moved) { dragged.current = true; onDirty(); } }; window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }} onClick={() => { if (dragged.current) { dragged.current = false; return; } setSelectedNodeId(object.id); setSelectedLinkId(null); setDraftRelation(null); }}><TypeDot color={typeColor(object.type)} /><div><small>{object.type}</small><strong title={object.display}>{object.display}</strong></div>{editable ? <button className="case-editor-node-remove" title="Remove entity from this case" onClick={(event) => { event.stopPropagation(); onRemove(caseId, object.id); if (selectedNodeId === object.id) setSelectedNodeId(null); onDirty(); }}>×</button> : null}</div>)}</div></div>
      <aside className="case-editor-inspector">
        {draftRelation ? (
          <RelationshipDraft from={getObject(draftRelation.from)?.display ?? draftRelation.from} to={getObject(draftRelation.to)?.display ?? draftRelation.to} relationType={relationType} confidence={confidence} rationale={rationale} onTypeChange={setRelationType} onConfidenceChange={setConfidence} onRationaleChange={setRationale} onCancel={() => setDraftRelation(null)} onSave={saveRelationship} />
        ) : selectedLink ? (
          <>
            <p className="eyebrow">Relationship inspector</p>
            <strong>{selectedLink.type.replace(/_/g, " ")}</strong>
            <dl><div><dt>Confidence</dt><dd>{selectedLink.confidence}%</dd></div><div><dt>Method</dt><dd>{selectedLink.method}</dd></div><div><dt>Source</dt><dd>{selectedLink.sourceLabel}</dd></div><div><dt>Observed</dt><dd>{selectedLink.observed}</dd></div></dl>
            {editable ? <Button variant="secondary" onClick={() => { onDeleteLink(selectedLink.id); setSelectedLinkId(null); onDirty(); }}>Delete relationship</Button> : null}
          </>
        ) : selectedNode ? (
          <NodeInspector
            object={selectedNode}
            editable={editable}
            onRename={(value) => onUpdateObject(selectedNode.id, { display: value })}
            onRemove={() => { onRemove(caseId, selectedNode.id); setSelectedNodeId(null); onDirty(); }}
            onClose={() => setSelectedNodeId(null)}
            onFocusExplorer={() => nav(`/graph/${selectedNode.id}`)}
          />
        ) : (
          <Outliner
            title="Entities in this case"
            objects={members}
            onSelect={(id) => { setSelectedNodeId(id); setSelectedLinkId(null); }}
            onRemove={editable ? (id) => { onRemove(caseId, id); onDirty(); } : undefined}
            editable={editable}
            emptyLabel={editable ? "No entities yet — right-click the canvas or press Shift+A to add one." : "No entities in this case."}
          />
        )}
      </aside>
    </div>
    <div className="case-editor-help">{editable ? "A right-drag does not create a relation until you complete and save the inspector form." : "Open this case as the active tab to edit it."}</div>
    {addMenu ? (
      <AddObjectMenu
        x={addMenu.x}
        y={addMenu.y}
        onClose={() => setAddMenu(null)}
        onCreateNew={handleCreateNew}
        onPickExisting={handlePickExisting}
        objects={objects}
        excludeIds={new Set(current.objectIds)}
      />
    ) : null}
  </section>;
}

function RelationshipDraft({ from, to, relationType, confidence, rationale, onTypeChange, onConfidenceChange, onRationaleChange, onCancel, onSave }: { from: string; to: string; relationType: string; confidence: string; rationale: string; onTypeChange: (value: string) => void; onConfidenceChange: (value: string) => void; onRationaleChange: (value: string) => void; onCancel: () => void; onSave: () => void }) {
  return <div className="relationship-draft"><strong>New relationship</strong><p><b>{from}</b><span> → </span><b>{to}</b></p><label>Relationship type<Select value={relationType} onChange={(event) => onTypeChange(event.target.value)}><option value="related_to">Related to</option><option value="associated_with">Associated with</option><option value="uses">Uses</option><option value="located_at">Located at</option><option value="owns">Owns</option></Select></label><label>Confidence (%)<input className="field" type="number" min="0" max="100" value={confidence} onChange={(event) => onConfidenceChange(event.target.value)} /></label><label>Why are they related?<textarea className="field" rows={4} value={rationale} onChange={(event) => onRationaleChange(event.target.value)} placeholder="Describe the evidence or analytical rationale" /></label><div><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={onSave}>Save relationship</Button></div></div>;
}