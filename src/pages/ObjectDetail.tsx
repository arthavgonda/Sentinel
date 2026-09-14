import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { PROVENANCE, RAW_RECORDS, confidenceTone, typeColor } from "../data/mock";
import { useStore } from "../state/store";
import { AddToCasePopover, EvidencePopover } from "../features/shared";
import { Button, TypeDot } from "../ui/primitives";
import { ManualEntryModal } from "../features/ManualEntryModal";

type Tab = "provenance" | "cases" | "raw";

export function ObjectDetailPage() {
  const { id = "" } = useParams();
  const { objects, links, cases, canSteward } = useStore();
  const obj = objects.find((o) => o.id === id);
  const nav = useNavigate();
  const loc = useLocation();
  const [tab, setTab] = useState<Tab>("provenance");
  const [addOpen, setAddOpen] = useState(false);
  const [evId, setEvId] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  const related = useMemo(() => {
    if (!obj) return [];
    return links
      .filter((l) => l.from === obj.id || l.to === obj.id)
      .map((l) => {
        const otherId = l.from === obj.id ? l.to : l.from;
        const other = objects.find((o) => o.id === otherId);
        return { link: l, other };
      })
      .filter((r) => r.other);
  }, [obj, links, objects]);

  if (!obj) {
    return (
      <div className="empty">
        <p className="empty-title">Object not found.</p>
        <Button variant="secondary" onClick={() => nav(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  const fromSearch =
    (loc.state as { from?: string } | null)?.from === "search";
  const inCases = cases.filter((c) => c.objectIds.includes(obj.id));
  const evRow = related.find((r) => r.link.id === evId);

  return (
    <div>
      <div className="crumb">
        {fromSearch ? (
          <Link to="/search">Search</Link>
        ) : (
          <Link to="/dashboard">Home</Link>
        )}
        <span>/</span>
        <span>{obj.display}</span>
      </div>

      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>
            {obj.type}
          </p>
          <h1 className="serif page-title">{obj.display}</h1>
          <p className="muted" style={{ marginTop: 2 }}>
            {obj.id}
            {obj.firstSeen ? ` · First seen ${obj.firstSeen}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "relative" }}>
          <Button
            variant="secondary"
            onClick={() => nav(`/graph/${obj.id}?hops=1`)}
          >
            Search Around
          </Button>
          <div style={{ position: "relative" }}>
            <Button onClick={() => setAddOpen((v) => !v)}>Add to Case</Button>
            {addOpen ? (
              <AddToCasePopover
                objectId={obj.id}
                onClose={() => setAddOpen(false)}
              />
            ) : null}
          </div>
          {canSteward ? (
            <Button variant="secondary" onClick={() => setManual(true)}>
              + Add Object Manually
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel" style={{ padding: 16 }}>
          <p className="eyebrow">Properties</p>
          {Object.entries(obj.properties).map(([k, v]) => (
            <div
              key={k}
              className="list-row"
              style={{ paddingLeft: 0, paddingRight: 0 }}
            >
              <span className="muted" style={{ minWidth: 100 }}>
                {k}
              </span>
              <span className="grow" style={{ textAlign: "right" }}>
                {v}
              </span>
            </div>
          ))}
        </div>

        <div className="panel">
          <p className="eyebrow" style={{ padding: "16px 16px 0" }}>
            Related Objects
          </p>
          {related.length === 0 ? (
            <p className="muted" style={{ padding: 16 }}>
              No linked objects.
            </p>
          ) : (
            related.map(({ link, other }) =>
              other ? (
                <div key={link.id} className="list-row">
                  <TypeDot color={typeColor(other.type)} />
                  <div
                    className="grow row-click"
                    style={{ cursor: "pointer" }}
                    onClick={() => nav(`/objects/${other.id}`)}
                  >
                    <div style={{ fontWeight: 500, fontSize: 15 }}>
                      {other.display}
                    </div>
                    <div className="muted">{link.type.replace(/_/g, " ")}</div>
                  </div>
                  <button
                    className={`btn btn-link conf-${confidenceTone(link.confidence)}`}
                    title="Click to see why"
                    aria-label={`Evidence for ${link.confidence}% confidence`}
                    onClick={() => setEvId(link.id)}
                  >
                    {link.confidence}%
                  </button>
                </div>
              ) : null,
            )
          )}
        </div>
      </div>

      {evRow?.other ? (
        <div style={{ position: "relative", marginTop: 12 }}>
          <EvidencePopover
            link={evRow.link}
            from={obj}
            to={evRow.other}
            onClose={() => setEvId(null)}
          />
        </div>
      ) : null}

      <div className="tabs" style={{ marginTop: 24 }}>
        {(["provenance", "cases", "raw"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "provenance"
              ? "Provenance"
              : t === "cases"
                ? "Cases"
                : "Raw Source Records"}
          </button>
        ))}
      </div>

      <div
        className="panel"
        style={{
          padding: 16,
          marginTop: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderTop: "none",
        }}
      >
        {tab === "provenance" ? (
          <table className="table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Source</th>
                <th>Observed</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {(
                PROVENANCE[obj.id] ?? [
                  {
                    field: obj.type,
                    source: "Manual / ingest",
                    observed: obj.firstSeen ?? "—",
                    method: "Recorded",
                  },
                ]
              ).map((r) => (
                <tr key={r.field}>
                  <td>{r.field}</td>
                  <td>{r.source}</td>
                  <td>{r.observed}</td>
                  <td>{r.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tab === "cases" ? (
          inCases.length ? (
            <div>
              {inCases.map((c) => (
                <div
                  key={c.id}
                  className="list-row row-click"
                  style={{ paddingLeft: 0 }}
                  onClick={() => nav(`/cases/${c.id}`)}
                >
                  <div className="grow">{c.title}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Not attached to any case.</p>
          )
        ) : null}

        {tab === "raw" ? (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              color: "var(--ink-secondary)",
              margin: 0,
            }}
          >
            {RAW_RECORDS[obj.id] ??
              "No raw record stored for this object."}
          </pre>
        ) : null}
      </div>

      {manual ? (
        <ManualEntryModal onClose={() => setManual(false)} />
      ) : null}
    </div>
  );
}
