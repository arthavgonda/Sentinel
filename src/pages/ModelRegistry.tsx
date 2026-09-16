import { useCallback, useEffect, useState } from "react";
import { RefreshCw, TrendingUp, ChevronDown, ChevronUp, RotateCcw, CheckCircle, XCircle, Loader } from "lucide-react";
import { erApi, type ModelVersion, type RetrainResult } from "../api/er";
import { Button, EmptyState } from "../ui/primitives";
import { useStore } from "../state/store";

const STATUS_COLORS: Record<string, string> = {
  live: "var(--signal-low)",
  candidate: "var(--accent)",
  archived: "var(--ink-tertiary)",
};

const PCT = (n: number | null) => n == null ? "—" : `${(n * 100).toFixed(1)}%`;
const N = (n: number | null) => n == null ? "—" : String(n);

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11,
      fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
      background: STATUS_COLORS[status] ? `color-mix(in srgb, ${STATUS_COLORS[status]} 15%, transparent)` : "var(--surface-2)",
      color: STATUS_COLORS[status] ?? "var(--ink-secondary)",
      border: `1px solid color-mix(in srgb, ${STATUS_COLORS[status] ?? "var(--border)"} 40%, transparent)`,
    }}>
      {status}
    </span>
  );
}

function MetricPill({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      gap: 2, padding: "6px 12px", borderRadius: 6,
      background: warn ? "color-mix(in srgb, var(--signal-high) 10%, transparent)" : "var(--surface-2)",
      border: `1px solid ${warn ? "color-mix(in srgb, var(--signal-high) 35%, transparent)" : "var(--border)"}`,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: warn ? "var(--signal-high)" : "var(--ink)" }}>{value}</span>
      <span style={{ fontSize: 10, color: "var(--ink-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
    </span>
  );
}

function WeightDiff({ candidate, live }: { candidate: ModelVersion; live: ModelVersion | undefined }) {
  const crossMode = live && (candidate.useLogistic !== live.useLogistic);

  if (crossMode) {
    return (
      <div style={{ padding: "10px 14px", borderRadius: 6, background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", fontSize: 12, color: "var(--ink-secondary)" }}>
        First logistic model for {candidate.objectType} — coefficients are in log-odds space and are not directly comparable to the rule-based baseline's point values. Review the precision/recall metrics rather than the weight delta.
      </div>
    );
  }

  if (!live) return null;
  const liveCoefs = live.weights;
  const candCoefs = candidate.weights;
  const allKeys = Array.from(new Set([...Object.keys(liveCoefs), ...Object.keys(candCoefs)]));

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-tertiary)", fontWeight: 500 }}>Feature</th>
          <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--ink-tertiary)", fontWeight: 500 }}>Live</th>
          <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--ink-tertiary)", fontWeight: 500 }}>Candidate</th>
          <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--ink-tertiary)", fontWeight: 500 }}>Δ</th>
        </tr>
      </thead>
      <tbody>
        {allKeys.map(key => {
          const lv = liveCoefs[key] ?? 0;
          const cv = candCoefs[key] ?? 0;
          const pct = lv !== 0 ? Math.abs((cv - lv) / lv) : 0;
          const bigSwing = lv !== 0 && pct > 0.4;
          return (
            <tr key={key} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "5px 8px", color: "var(--ink-secondary)" }}>{key}</td>
              <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>{lv.toFixed(3)}</td>
              <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>{cv.toFixed(3)}</td>
              <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", color: bigSwing ? "var(--signal-high)" : cv > lv ? "var(--signal-low)" : "var(--ink-secondary)", fontWeight: bigSwing ? 700 : 400 }}>
                {cv >= lv ? "+" : ""}{(cv - lv).toFixed(3)}
                {bigSwing ? " ⚠" : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function VersionRow({ v, liveForType, onAction }: { v: ModelVersion; liveForType: ModelVersion | undefined; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [purposeInput, setPurposeInput] = useState("");
  const [loading, setLoading] = useState<"promote" | "reject" | "rollback" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "promote" | "reject" | "rollback") {
    if (!purposeInput.trim()) { setErr("State your purpose before taking this action."); return; }
    setLoading(action);
    setErr(null);
    try {
      if (action === "promote") await erApi.promoteModel(v.id, purposeInput);
      else if (action === "reject") await erApi.rejectModel(v.id, purposeInput);
      else await erApi.rollbackModel(v.id, purposeInput);
      onAction();
    } catch (e) { setErr(String(e)); }
    finally { setLoading(null); }
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface-1)", cursor: "pointer", userSelect: "none" }}
        onClick={() => setExpanded(e => !e)}
      >
        <StatusBadge status={v.status} />
        <span style={{ fontWeight: 600, fontSize: 13, fontFamily: "monospace" }}>{v.version}</span>
        <span style={{ color: "var(--ink-tertiary)", fontSize: 12 }}>{v.useLogistic ? "logistic" : "rule-based"}</span>
        {v.precision != null && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--ink-secondary)" }}>P {PCT(v.precision)} · R {PCT(v.recall)} · F1 {PCT(v.f1)}</span>
            <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>n={N(v.nTrain)}</span>
          </span>
        )}
        {v.approvedBy && <span style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>by {v.approvedBy}</span>}
        <span style={{ marginLeft: v.precision == null ? "auto" : 0 }}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </div>

      {expanded && (
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 14 }}>
          {v.status === "candidate" && (
            <>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Weight comparison vs. live baseline</p>
                <WeightDiff candidate={v} live={liveForType} />
              </div>
              {v.shadowSummary?.n ? (
                <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                  Shadow evaluation: {v.shadowSummary.n} pairs scored. Avg confidence delta vs live:{" "}
                  <strong>{v.shadowSummary.avg_delta != null ? `${v.shadowSummary.avg_delta >= 0 ? "+" : ""}${v.shadowSummary.avg_delta.toFixed(1)}` : "—"}</strong>
                </div>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-secondary)" }}>
                  Stated purpose <span style={{ color: "var(--signal-high)" }}>*</span>
                </label>
                <input
                  className="field"
                  placeholder="e.g. quarterly model review — metrics exceeded baseline"
                  value={purposeInput}
                  onChange={e => setPurposeInput(e.target.value)}
                  style={{ fontSize: 12 }}
                />
                {err && <p style={{ fontSize: 12, color: "var(--signal-high)" }}>{err}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={() => act("promote")} disabled={loading !== null}>
                    {loading === "promote" ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle size={12} />}
                    Promote to live
                  </Button>
                  <Button variant="secondary" onClick={() => act("reject")} disabled={loading !== null}>
                    {loading === "reject" ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <XCircle size={12} />}
                    Reject
                  </Button>
                </div>
              </div>
            </>
          )}
          {v.status === "live" && liveForType && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-secondary)" }}>Rollback — stated purpose <span style={{ color: "var(--signal-high)" }}>*</span></label>
              <input className="field" placeholder="e.g. ER queue disagreement spike post-promotion" value={purposeInput} onChange={e => setPurposeInput(e.target.value)} style={{ fontSize: 12 }} />
              {err && <p style={{ fontSize: 12, color: "var(--signal-high)" }}>{err}</p>}
              <Button variant="secondary" onClick={() => act("rollback")} disabled={loading !== null} style={{ alignSelf: "flex-start" }}>
                {loading === "rollback" ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RotateCcw size={12} />}
                Roll back to previous
              </Button>
            </div>
          )}
          {v.trainingFrom && (
            <p style={{ fontSize: 11, color: "var(--ink-tertiary)" }}>
              Trained on decisions from {v.trainingFrom.slice(0, 10)} to {v.trainingTo?.slice(0, 10)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TypeSection({ type, versions, onAction, onRetrain, retrainLoading }: {
  type: "Person" | "Organization";
  versions: ModelVersion[];
  onAction: () => void;
  onRetrain: (t: "Person" | "Organization") => void;
  retrainLoading: boolean;
}) {
  const live = versions.find(v => v.status === "live");
  const candidate = versions.find(v => v.status === "candidate");

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{type} model</h2>
        {live && <MetricPill label="live P" value={PCT(live.precision)} />}
        {live && <MetricPill label="live R" value={PCT(live.recall)} />}
        {live && <MetricPill label="live F1" value={PCT(live.f1)} />}
        <Button
          variant="secondary"
          onClick={() => onRetrain(type)}
          disabled={retrainLoading}
          style={{ marginLeft: "auto", fontSize: 12, height: 30 }}
        >
          {retrainLoading ? <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={11} />}
          Retrain {type}
        </Button>
      </div>
      {versions.length === 0
        ? <EmptyState title={`No model versions for ${type}`} />
        : versions.map(v => (
          <VersionRow
            key={v.id}
            v={{ ...v, shadowSummary: candidate?.id === v.id ? v.shadowSummary : undefined }}
            liveForType={live}
            onAction={onAction}
          />
        ))
      }
    </section>
  );
}

export function ModelRegistryPage() {
  const { canSteward } = useStore();
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [retrainResults, setRetrainResults] = useState<RetrainResult[] | null>(null);
  const [retrainLoading, setRetrainLoading] = useState<"Person" | "Organization" | "all" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await erApi.listModelRegistry();
      const withShadow = await Promise.all(all.map(async v => {
        if (v.status === "candidate") {
          try { const det = await erApi.getModelVersion(v.id); return det; }
          catch { return v; }
        }
        return v;
      }));
      setVersions(withShadow);
    } catch (e) { setErr(String(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function retrain(t: "Person" | "Organization") {
    setRetrainLoading(t);
    setRetrainResults(null);
    setErr(null);
    try {
      const results = await erApi.retrain(t);
      setRetrainResults(results);
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setRetrainLoading(null); }
  }

  if (!canSteward) {
    return <div style={{ padding: 32 }}><EmptyState title="Model Registry is restricted to Data Stewards and Admins." /></div>;
  }

  const personVersions = versions.filter(v => v.objectType === "Person").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const orgVersions = versions.filter(v => v.objectType === "Organization").sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="serif page-title">Model Registry</h1>
          <p className="muted">Versioned Entity Resolution weight-sets. Promote candidates after review; all actions are logged to the audit trail.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={() => load()} style={{ fontSize: 12 }}>
            <RefreshCw size={12} /> Refresh
          </Button>
          <Button onClick={async () => {
            setRetrainLoading("all");
            setRetrainResults(null);
            setErr(null);
            try { const r = await erApi.retrain(); setRetrainResults(r); await load(); }
            catch (e) { setErr(String(e)); }
            finally { setRetrainLoading(null); }
          }} disabled={retrainLoading !== null} style={{ fontSize: 12 }}>
            {retrainLoading === "all" ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <TrendingUp size={12} />}
            Retrain all types
          </Button>
        </div>
      </div>

      {err && <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 6, background: "color-mix(in srgb, var(--signal-high) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--signal-high) 30%, transparent)", fontSize: 13, color: "var(--signal-high)" }}>{err}</div>}

      {retrainResults && (
        <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-1)" }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Retrain results</p>
          {retrainResults.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: r.status === "ok" ? "var(--signal-low)" : r.status === "error" ? "var(--signal-high)" : "var(--ink-secondary)", marginBottom: 4 }}>
              <strong>{r.object_type}</strong>:{" "}
              {r.status === "ok" && `✓ Candidate ${r.version} created — P ${PCT(r.precision ?? null)} · R ${PCT(r.recall ?? null)} · F1 ${PCT(r.f1 ?? null)} (n=${r.n_train})`}
              {r.status === "skipped" && `⚠ Skipped — ${r.reason ?? `Need ${r.required} decisions; have ${r.n}`}`}
              {r.status === "error" && `✗ Error: ${r.error}`}
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "10px 14px", borderRadius: 6, background: "color-mix(in srgb, var(--accent) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)", fontSize: 12, color: "var(--ink-secondary)", marginBottom: 24 }}>
        <strong>Phone</strong> and <strong>Location</strong> entity types use fixed deterministic rules and are not subject to logistic regression training. They do not appear in this registry.
      </div>

      <TypeSection
        type="Person"
        versions={personVersions}
        onAction={load}
        onRetrain={retrain}
        retrainLoading={retrainLoading === "Person" || retrainLoading === "all"}
      />
      <TypeSection
        type="Organization"
        versions={orgVersions}
        onAction={load}
        onRetrain={retrain}
        retrainLoading={retrainLoading === "Organization" || retrainLoading === "all"}
      />
    </div>
  );
}
