import { useMemo, useState } from "react";
import { EVIDENCE_ASSETS, confidenceTone, typeColor } from "../data/mock";
import { useStore } from "../state/store";
import { Button, EmptyState, Modal, TypeDot } from "../ui/primitives";
import type { EvidenceAsset, OntologyObject } from "../types";
import { UI_TIMING } from "../config/application";

export function ErReviewPage() {
  const { erMatches, resolveMatch } = useStore();
  const [leaving, setLeaving] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [evidenceFor, setEvidenceFor] = useState<OntologyObject | null>(null);

  function resolve(id: string, merge: boolean) {
    if (!reviewed[id] || resolveMatch(id, merge) === "gone") return;
    setLeaving(id);
    window.setTimeout(() => setLeaving(null), UI_TIMING.resolutionExitMs);
  }

  return <div>
    <div className="page-head"><div><h1 className="serif page-title">Entity Resolution Review</h1><p className="muted">Review the evidence package for both records before choosing an outcome.</p></div></div>
    <p className="muted" style={{ marginBottom: 16 }}>{erMatches.length} match{erMatches.length === 1 ? "" : "es"} awaiting review.</p>
    {erMatches.length === 0 ? <EmptyState title="No matches awaiting review" /> : erMatches.map((match) => {
      const exiting = leaving === match.id;
      const complete = Boolean(reviewed[match.id]);
      return <article key={match.id} className="er-card" style={{ maxHeight: exiting ? 0 : 740, opacity: exiting ? 0 : 1 }}>
        <div className="er-record-grid"><RecordCard label="Candidate record" obj={match.left} onReview={() => setEvidenceFor(match.left)} /><RecordCard label="Reference record" obj={match.right} onReview={() => setEvidenceFor(match.right)} /></div>
        <div className="er-decision-row">
          <div className="er-match-summary">
            <span className={`conf-${confidenceTone(match.confidence)}`}>{match.confidence}% match confidence</span>
            <span className="muted" style={{ fontSize: 11 }}>
              {match.modelVersion
                ? match.modelVersion.includes("baseline")
                  ? "rule-based score"
                  : `logistic model ${match.modelVersion}`
                : "rule-based score"}
            </span>
            <span className="muted">{match.reasons.length} corroborating signals</span>
          </div>
          <label className="er-review-check"><input type="checkbox" checked={complete} onChange={(event) => setReviewed((value) => ({ ...value, [match.id]: event.target.checked }))} /> I reviewed both evidence packages</label>
          <div className="er-actions"><Button disabled={!complete} title={!complete ? "Review both evidence packages before deciding." : undefined} onClick={() => resolve(match.id, true)}>Confirm merge</Button><Button variant="secondary" disabled={!complete} title={!complete ? "Review both evidence packages before deciding." : undefined} onClick={() => resolve(match.id, false)}>Keep separate</Button></div>
        </div>
        <div className="er-signals">{match.reasons.map((reason) => <span key={reason}>✓ {reason}</span>)}</div>
      </article>;

    })}
    {evidenceFor ? <EvidencePackage obj={evidenceFor} onClose={() => setEvidenceFor(null)} /> : null}
  </div>;
}

function RecordCard({ label, obj, onReview }: { label: string; obj: OntologyObject; onReview: () => void }) {
  const count = EVIDENCE_ASSETS.filter((asset) => asset.objectId === obj.id).length;
  return <section className="er-record-card"><p className="eyebrow">{label}</p><div className="er-record-title"><TypeDot color={typeColor(obj.type)} /><strong>{obj.display}</strong></div><dl>{Object.entries(obj.properties).slice(0, 3).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><Button variant="secondary" style={{ fontSize: 12, height: 32 }} onClick={onReview}>Review evidence · {count}</Button></section>;
}

function EvidencePackage({ obj, onClose }: { obj: OntologyObject; onClose: () => void }) {
  const assets = useMemo(() => EVIDENCE_ASSETS.filter((asset) => asset.objectId === obj.id), [obj.id]);
  const [selected, setSelected] = useState<EvidenceAsset | null>(assets[0] ?? null);
  return <Modal title={`Evidence package — ${obj.display}`} onClose={onClose} width={820} footer={<Button variant="secondary" onClick={onClose}>Back to review</Button>}><div className="evidence-package"><aside>{assets.length ? assets.map((asset) => <button key={asset.id} className={`evidence-asset ${selected?.id === asset.id ? "active" : ""}`} onClick={() => setSelected(asset)}><span>{asset.kind}</span><strong>{asset.title}</strong><small>{asset.source}</small></button>) : <p className="muted">No source assets are available for this record.</p>}</aside><section className="evidence-preview">{selected ? <AssetPreview asset={selected} /> : null}</section></div></Modal>;
}

function AssetPreview({ asset }: { asset: EvidenceAsset }) {
  const media = asset.url && asset.kind === "Image" ? <img src={asset.url} alt={asset.title} /> : asset.url && asset.kind === "Video" ? <video controls src={asset.url} /> : asset.url && asset.kind === "Audio" ? <audio controls src={asset.url} /> : <p>{asset.summary}</p>;
  return <><div className={`asset-canvas asset-${asset.kind.toLowerCase()}`}><span>{asset.kind}</span><strong>{asset.title}</strong>{media}{asset.url && asset.kind === "Document" ? <a href={asset.url} target="_blank" rel="noreferrer">Open source document</a> : null}</div><p className="eyebrow">Source context</p><p>{asset.source} · observed {asset.observed}</p><p className="muted" style={{ marginTop: 8 }}>{asset.summary}</p></>;
}
