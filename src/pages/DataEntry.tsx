import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Link2, UploadCloud, FolderPlus, Database, GitMerge, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { objectsApi } from "../api/objects";
import { linksApi } from "../api/links";
import { casesApi } from "../api/cases";
import { sourcesApi } from "../api/sources";
import { erApi } from "../api/er";
import { useStore } from "../state/store";
import { Button } from "../ui/primitives";
import type { ObjectType, Classification } from "../types";

type Tab = "object" | "link" | "case" | "source" | "er";

const OBJECT_TYPES: ObjectType[] = ["Person", "Organization", "Phone", "Location", "JobListing", "Document"];
const CLASSIFICATIONS: Classification[] = ["Public", "Internal", "Restricted", "Highly Restricted"];
const SOURCE_TYPES = ["API Connection", "CSV Upload", "Manual Entry"] as const;
const LINK_TYPES = ["uses", "associated_with", "registered_at", "listed_by", "posted_by", "linked_to"] as const;

interface StatusBanner {
  kind: "success" | "error";
  message: string;
}

export function DataEntryPage() {
  const { canSteward, user } = useStore();
  const [tab, setTab] = useState<Tab>("object");
  const [status, setStatus] = useState<StatusBanner | null>(null);
  const nav = useNavigate();

  function flash(kind: StatusBanner["kind"], message: string) {
    setStatus({ kind, message });
    window.setTimeout(() => setStatus(null), 4000);
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <h1 className="serif page-title">Data Entry</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Add objects, links, cases, and data sources to the intelligence graph</p>
        </div>
      </header>

      {status ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, marginBottom: 20, background: status.kind === "success" ? "color-mix(in srgb, var(--signal-low) 12%, transparent)" : "color-mix(in srgb, var(--signal-high) 12%, transparent)", border: `1px solid ${status.kind === "success" ? "var(--signal-low)" : "var(--signal-high)"}` }}>
          {status.kind === "success" ? <CheckCircle size={15} color="var(--signal-low)" /> : <AlertCircle size={15} color="var(--signal-high)" />}
          <span style={{ fontSize: 13 }}>{status.message}</span>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {([
          { id: "object", label: "Add Object", icon: <Plus size={14} /> },
          { id: "link", label: "Create Link", icon: <Link2 size={14} /> },
          { id: "case", label: "New Case", icon: <FolderPlus size={14} /> },
          ...(canSteward ? [
            { id: "source", label: "Register Source", icon: <Database size={14} /> },
            { id: "er", label: "Run ER", icon: <GitMerge size={14} /> },
          ] : []),
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
              background: "none", borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.id ? "var(--ink)" : "var(--ink-secondary)",
              marginBottom: -1, transition: "color .15s",
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 640 }}>
        {tab === "object" && <AddObjectForm onSuccess={(id) => { flash("success", "Object created"); nav(`/objects/${id}`); }} onError={(e) => flash("error", e)} />}
        {tab === "link" && <AddLinkForm onSuccess={() => flash("success", "Link created")} onError={(e) => flash("error", e)} />}
        {tab === "case" && <AddCaseForm leadId={user?.id ?? ""} onSuccess={(id) => { flash("success", "Case created"); nav(`/cases/${id}`); }} onError={(e) => flash("error", e)} />}
        {tab === "source" && canSteward && <AddSourceForm onSuccess={() => flash("success", "Data source registered")} onError={(e) => flash("error", e)} />}
        {tab === "er" && canSteward && <RunErForm onSuccess={(n) => flash("success", `ER run queued ${n} candidate${n !== 1 ? "s" : ""}`)} onError={(e) => flash("error", e)} />}
      </div>
    </div>
  );
}

function AddObjectForm({ onSuccess, onError }: { onSuccess: (id: string) => void; onError: (e: string) => void }) {
  const [type, setType] = useState<ObjectType>("Person");
  const [display, setDisplay] = useState("");
  const [firstSeen, setFirstSeen] = useState("");
  const [props, setProps] = useState([{ key: "", value: "" }]);
  const [loading, setLoading] = useState(false);

  function addProp() { setProps((p) => [...p, { key: "", value: "" }]); }
  function updateProp(i: number, field: "key" | "value", val: string) {
    setProps((p) => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }
  function removeProp(i: number) { setProps((p) => p.filter((_, idx) => idx !== i)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!display.trim()) { onError("Display name is required"); return; }
    const properties: Record<string, string> = {};
    for (const { key, value } of props) {
      if (key.trim()) properties[key.trim()] = value.trim();
    }
    setLoading(true);
    try {
      const obj = await objectsApi.create({ type, display: display.trim(), properties, firstSeen: firstSeen || undefined });
      onSuccess(obj.id as string);
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field-group">
        <label className="label" htmlFor="de-obj-type">Object type</label>
        <select id="de-obj-type" className="field" value={type} onChange={(e) => setType(e.target.value as ObjectType)}>
          {OBJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="field-group">
        <label className="label" htmlFor="de-obj-display">Display name <span style={{ color: "var(--signal-high)" }}>*</span></label>
        <input id="de-obj-display" className="field" value={display} onChange={(e) => setDisplay(e.target.value)} placeholder={type === "Person" ? "Full name or alias" : type === "Phone" ? "+91 22 4188 2901" : "Display label"} required />
      </div>
      <div className="field-group">
        <label className="label" htmlFor="de-obj-fseen">First seen (optional)</label>
        <input id="de-obj-fseen" className="field" type="date" value={firstSeen} onChange={(e) => setFirstSeen(e.target.value)} />
      </div>
      <div className="field-group">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="label" style={{ margin: 0 }}>Properties</span>
          <Button type="button" variant="secondary" onClick={addProp} style={{ fontSize: 12, padding: "3px 10px" }}>+ Add field</Button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {props.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input className="field" placeholder="Field name" value={row.key} onChange={(e) => updateProp(i, "key", e.target.value)} style={{ flex: "0 0 160px" }} />
              <input className="field" placeholder="Value" value={row.value} onChange={(e) => updateProp(i, "value", e.target.value)} style={{ flex: 1 }} />
              {props.length > 1 ? <button type="button" className="btn btn-icon" onClick={() => removeProp(i)} style={{ color: "var(--ink-secondary)", flexShrink: 0 }}>×</button> : null}
            </div>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={loading} style={{ alignSelf: "flex-start", minWidth: 120 }}>
        {loading ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Creating…</> : "Create Object"}
      </Button>
    </form>
  );
}

function AddLinkForm({ onSuccess, onError }: { onSuccess: () => void; onError: (e: string) => void }) {
  const { objects } = useStore();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [type, setType] = useState<typeof LINK_TYPES[number]>(LINK_TYPES[0]);
  const [confidence, setConfidence] = useState(75);
  const [method, setMethod] = useState<"deterministic" | "probabilistic">("deterministic");
  const [sourceLabel, setSourceLabel] = useState("Manual Entry");
  const [observed, setObserved] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromId || !toId) { onError("Both objects required"); return; }
    if (fromId === toId) { onError("Cannot link an object to itself"); return; }
    setLoading(true);
    try {
      await linksApi.create({ from: fromId, to: toId, type, confidence, method, sourceLabel, observed: observed || new Date().toISOString().slice(0, 10), matchedAttributes: ["Manual entry"] });
      onSuccess();
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const objOptions = objects.map((o) => ({ value: o.id, label: `${o.display} (${o.type})` }));

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field-group">
        <label className="label" htmlFor="de-link-from">From object <span style={{ color: "var(--signal-high)" }}>*</span></label>
        <select id="de-link-from" className="field" value={fromId} onChange={(e) => setFromId(e.target.value)} required>
          <option value="">Select object…</option>
          {objOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="field-group">
        <label className="label" htmlFor="de-link-type">Relationship type</label>
        <select id="de-link-type" className="field" value={type} onChange={(e) => setType(e.target.value as typeof LINK_TYPES[number])}>
          {LINK_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="field-group">
        <label className="label" htmlFor="de-link-to">To object <span style={{ color: "var(--signal-high)" }}>*</span></label>
        <select id="de-link-to" className="field" value={toId} onChange={(e) => setToId(e.target.value)} required>
          <option value="">Select object…</option>
          {objOptions.filter((o) => o.value !== fromId).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field-group">
          <label className="label" htmlFor="de-link-conf">Confidence: {confidence}%</label>
          <input id="de-link-conf" type="range" min={1} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
        <div className="field-group">
          <label className="label" htmlFor="de-link-method">Method</label>
          <select id="de-link-method" className="field" value={method} onChange={(e) => setMethod(e.target.value as "deterministic" | "probabilistic")}>
            <option value="deterministic">Deterministic</option>
            <option value="probabilistic">Probabilistic</option>
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field-group">
          <label className="label" htmlFor="de-link-source">Source label</label>
          <input id="de-link-source" className="field" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
        </div>
        <div className="field-group">
          <label className="label" htmlFor="de-link-obs">Observed date</label>
          <input id="de-link-obs" className="field" type="date" value={observed} onChange={(e) => setObserved(e.target.value)} />
        </div>
      </div>
      <Button type="submit" disabled={loading} style={{ alignSelf: "flex-start", minWidth: 120 }}>
        {loading ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Creating…</> : "Create Link"}
      </Button>
    </form>
  );
}

function AddCaseForm({ leadId, onSuccess, onError }: { leadId: string; onSuccess: (id: string) => void; onError: (e: string) => void }) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { onError("Case title is required"); return; }
    setLoading(true);
    try {
      const c = await casesApi.create({ title: title.trim(), leadId });
      onSuccess(c.id as string);
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field-group">
        <label className="label" htmlFor="de-case-title">Case title <span style={{ color: "var(--signal-high)" }}>*</span></label>
        <input id="de-case-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mumbai recruitment network" required />
        <span className="muted" style={{ fontSize: 12, marginTop: 4 }}>A short, descriptive title. Case number is assigned automatically.</span>
      </div>
      <Button type="submit" disabled={loading} style={{ alignSelf: "flex-start", minWidth: 120 }}>
        {loading ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Creating…</> : "Create Case"}
      </Button>
    </form>
  );
}

function AddSourceForm({ onSuccess, onError }: { onSuccess: () => void; onError: (e: string) => void }) {
  const [name, setName] = useState("");
  const [classification, setClassification] = useState<Classification>("Internal");
  const [legalBasis, setLegalBasis] = useState("");
  const [type, setType] = useState<typeof SOURCE_TYPES[number]>("API Connection");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !legalBasis.trim()) { onError("Name and legal basis are required"); return; }
    setLoading(true);
    try {
      await sourcesApi.create({ name: name.trim(), classification, legalBasis: legalBasis.trim(), type });
      onSuccess();
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field-group">
        <label className="label" htmlFor="de-src-name">Source name <span style={{ color: "var(--signal-high)" }}>*</span></label>
        <input id="de-src-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Partner NGO field notes" required />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field-group">
          <label className="label" htmlFor="de-src-class">Classification</label>
          <select id="de-src-class" className="field" value={classification} onChange={(e) => setClassification(e.target.value as Classification)}>
            {CLASSIFICATIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label className="label" htmlFor="de-src-type">Ingestion type</label>
          <select id="de-src-type" className="field" value={type} onChange={(e) => setType(e.target.value as typeof SOURCE_TYPES[number])}>
            {SOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="field-group">
        <label className="label" htmlFor="de-src-basis">Legal basis <span style={{ color: "var(--signal-high)" }}>*</span></label>
        <input id="de-src-basis" className="field" value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} placeholder="e.g. MOU / DPA, Public record, Documented consent" required />
      </div>
      <Button type="submit" disabled={loading} style={{ alignSelf: "flex-start", minWidth: 160 }}>
        {loading ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Registering…</> : "Register Source"}
      </Button>
    </form>
  );
}

function RunErForm({ onSuccess, onError }: { onSuccess: (n: number) => void; onError: (e: string) => void }) {
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await erApi.runCheck();
      onSuccess((result as unknown as { queued: number }).queued ?? 0);
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }, [onSuccess, onError]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
        <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>Entity Resolution Run</p>
        <p className="muted" style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.6 }}>
          This triggers a full O(n²) comparison across all objects using Jaro-Winkler similarity, Soundex phonetic matching, and phone normalisation via the Go ER service. Candidates above the confidence threshold are written to the ER review queue.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <UploadCloud size={14} color="var(--ink-secondary)" />
          <span style={{ fontSize: 13, color: "var(--ink-secondary)" }}>Runs on the Go service at <code>:3002</code></span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <GitMerge size={14} color="var(--ink-secondary)" />
          <span style={{ fontSize: 13, color: "var(--ink-secondary)" }}>Review results at <a href="/entity-resolution/review" style={{ color: "var(--accent)" }}>Entity Resolution</a></span>
        </div>
      </div>
      <Button onClick={run} disabled={loading} style={{ alignSelf: "flex-start", minWidth: 140 }}>
        {loading ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Running…</> : "Run ER Now"}
      </Button>
    </div>
  );
}
