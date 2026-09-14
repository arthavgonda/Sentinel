import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { CLASSIFICATION_HELP, PIPELINE } from "../data/mock";
import { useStore } from "../state/store";
import { SourceWizard } from "../features/ManualEntryModal";
import { ClassBadge } from "../features/shared";
import { Button, EmptyState } from "../ui/primitives";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

export function DataSourcesLayout() {
  const { canSteward } = useStore();
  const [wizOpen, setWizOpen] = useState(false);

  return (
    <div>
      <div className="page-head">
        <h1 className="serif page-title">Data Sources</h1>
        {canSteward ? (
          <Button onClick={() => setWizOpen(true)}>+ Add Source</Button>
        ) : null}
      </div>

      <div className="tabs">
        <NavLink
          to="/data-sources"
          end
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Sources
        </NavLink>
        <NavLink
          to="/data-sources/pipeline"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Pipeline
        </NavLink>
        <NavLink
          to="/data-sources/agencies"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Partner Agencies
        </NavLink>
      </div>

      <div style={{ paddingTop: 16 }}>
        <Outlet />
      </div>

      {wizOpen ? <SourceWizard onClose={() => setWizOpen(false)} /> : null}
    </div>
  );
}

export function SourcesTable() {
  const { sources } = useStore();
  const nav = useNavigate();

  return (
    <div className="panel">
      {sources.length === 0 ? (
        <EmptyState
          title="No data sources configured"
          body="Add a source to begin ingesting data into the ontology."
        />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Source Name</th>
              <th>Classification</th>
              <th>Legal Basis</th>
              <th>Owner</th>
              <th>Records Ingested</th>
              <th>Last Sync</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr
                key={s.id}
                className="row-click"
                onClick={() => nav(`/data-sources/${s.id}`)}
              >
                <td style={{ fontWeight: 500 }}>{s.name}</td>
                <td>
                  <ClassBadge value={s.classification} />
                </td>
                <td>{s.legalBasis}</td>
                <td>{s.owner}</td>
                <td>{s.recordsIngested.toLocaleString()}</td>
                <td>
                  <span>
                    {s.lastSync === "Never"
                      ? "Never"
                      : new Date(s.lastSync).toLocaleString()}
                  </span>
                  {s.syncWarning ? (
                    <span
                      style={{
                        marginLeft: 6,
                        color: "var(--signal-medium)",
                        cursor: "help",
                      }}
                      title={s.syncWarning}
                    >
                      ⚠
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SourceDetail() {
  const { id = "" } = useParams();
  const { sources } = useStore();
  const s = sources.find((x) => x.id === id);
  const nav = useNavigate();

  if (!s) {
    return (
      <div className="empty">
        <p className="empty-title">Source not found.</p>
        <Button variant="secondary" onClick={() => nav("/data-sources")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="crumb">
        <button
          className="btn btn-link"
          style={{ fontSize: 12 }}
          onClick={() => nav("/data-sources")}
        >
          Data Sources
        </button>
        <ChevronRight size={12} color="var(--ink-secondary)" />
        <span>{s.name}</span>
      </div>

      <div className="panel" style={{ padding: 20, maxWidth: 560 }}>
        <h2 className="serif" style={{ fontSize: 18, marginBottom: 12 }}>
          {s.name}
        </h2>

        <div style={{ display: "grid", gap: 10 }}>
          <Row label="Classification">
            <ClassBadge value={s.classification} />
          </Row>
          <Row label="Legal basis">{s.legalBasis}</Row>
          <Row label="Owner">{s.owner}</Row>
          <Row label="Source type">{s.type}</Row>
          <Row label="Records ingested">
            {s.recordsIngested.toLocaleString()}
          </Row>
          <Row label="Last sync">
            {s.lastSync === "Never"
              ? "Never"
              : new Date(s.lastSync).toLocaleString()}
          </Row>
        </div>

        {s.syncWarning ? (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "color-mix(in srgb, var(--signal-medium) 10%, var(--panel-bg))",
              border: "1px solid color-mix(in srgb, var(--signal-medium) 25%, var(--border))",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--signal-medium)",
            }}
          >
            {s.syncWarning}
          </div>
        ) : null}

        <p
          className="muted"
          style={{ marginTop: 16, lineHeight: 1.5, fontSize: 12 }}
        >
          {CLASSIFICATION_HELP[s.classification]}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        paddingBottom: 10,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span className="muted" style={{ minWidth: 120, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 13 }}>{children}</span>
    </div>
  );
}

export function PipelinePage() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr) ",
        gap: 0,
        alignItems: "start",
      }}
    >
      {PIPELINE.map((col, ci) => (
        <div key={col.id} style={{ display: "flex", gap: 0, alignItems: "start" }}>
          <div className="pipeline-col" style={{ flex: 1 }}>
            <p className="eyebrow">{col.label}</p>
            {col.items.map((item) => (
              <div
                key={item}
                className="panel"
                style={{ padding: "10px 12px", marginBottom: 8, fontSize: 13 }}
              >
                {item}
              </div>
            ))}
          </div>
          {ci < PIPELINE.length - 1 ? (
            <div className="pipeline-arrow">→</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AgenciesPage() {
  const { agencies } = useStore();

  return (
    <div className="panel">
      {agencies.length === 0 ? (
        <div style={{ padding: 16 }}>
          <p className="muted">No partner agencies configured.</p>
        </div>
      ) : (
        agencies.map((a) => (
          <div key={a.id} className="list-row">
            <span style={{ flex: 1, fontWeight: 500 }}>{a.name}</span>
          </div>
        ))
      )}
    </div>
  );
}
