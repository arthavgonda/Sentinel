import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { Button, EmptyState, Input } from "../ui/primitives";

export function AuditLogPage() {
  const { canSeeAudit, audit, addAudit, user } = useStore();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ref, setRef] = useState("");
  const [expandId, setExpandId] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState("");
  const dateErr = from && to && to < from;

  const rows = useMemo(() => {
    return audit.filter((r) => {
      if (ref.trim() && !r.reference.toLowerCase().includes(ref.toLowerCase()))
        return false;
      if (from && r.timestamp.slice(0, 10) < from) return false;
      if (to && r.timestamp.slice(0, 10) > to) return false;
      return true;
    });
  }, [audit, from, to, ref]);

  if (!canSeeAudit) {
    return (
      <div className="empty">
        <p className="empty-title">You don't have access to this page.</p>
        <Button
          variant="secondary"
          onClick={() => (window.location.href = "/dashboard")}
        >
          Go to Dashboard
        </Button>
      </div>
    );
  }

  function handleExport() {
    if (rows.length > 5000) {
      setExportErr(
        "This export would include a very large number of records. Narrow your filters, or contact your administrator for a full data export.",
      );
      return;
    }
    setExportErr("");
    addAudit({
      timestamp: new Date().toISOString(),
      actor: user?.name ?? "Auditor",
      action: "EXPORT",
      reference: "Audit Log",
      result: "SUCCESS",
      purpose: "filtered-export",
    });
    const header = "Timestamp,Actor,Action,Object/Case Reference,Result";
    const body = rows.map((r) =>
      [r.timestamp, r.actor, r.action, `"${r.reference}"`, r.result].join(","),
    );
    const csv = [header, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sentinel-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="serif page-title">Audit Log</h1>
        <Button onClick={handleExport}>Export CSV</Button>
      </div>

      {exportErr ? (
        <p className="field-error-text" style={{ marginBottom: 12 }}>
          {exportErr}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <label className="form-label">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ width: 160 }}
          />
        </div>
        <div>
          <label className="form-label">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: 160 }}
            error={Boolean(dateErr)}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="form-label">Object / Case Reference</label>
          <Input
            value={ref}
            placeholder="e.g. Case #1042"
            onChange={(e) => setRef(e.target.value)}
          />
        </div>
        {(from || to || ref) ? (
          <Button
            variant="secondary"
            onClick={() => { setFrom(""); setTo(""); setRef(""); }}
          >
            Clear Filters
          </Button>
        ) : null}
      </div>

      {dateErr ? (
        <p className="field-error-text" style={{ marginBottom: 12 }}>
          End date must be after start date.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No audit records match these filters"
          action={
            (from || to || ref) ? (
              <Button
                variant="link"
                onClick={() => { setFrom(""); setTo(""); setRef(""); }}
              >
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Object/Case Reference</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <>
                  <tr
                    key={r.id}
                    className="row-click"
                    onClick={() =>
                      setExpandId(expandId === r.id ? null : r.id)
                    }
                  >
                    <td className="muted">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td>{r.actor}</td>
                    <td>
                      <span style={{ color: actionColor(r.action), fontWeight: 500 }}>
                        {r.action}
                      </span>
                    </td>
                    <td>{r.reference}</td>
                    <td>
                      <span
                        style={{
                          color:
                            r.result === "DENIED"
                              ? "var(--signal-high)"
                              : "var(--ink-secondary)",
                        }}
                      >
                        {r.result}
                      </span>
                    </td>
                  </tr>
                  {expandId === r.id ? (
                    <tr key={`${r.id}-exp`}>
                      <td
                        colSpan={5}
                        style={{ background: "var(--paper)", padding: "12px 16px" }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "auto 1fr",
                            gap: "4px 16px",
                            fontSize: 12,
                          }}
                        >
                          <span className="muted">Purpose</span>
                          <span>{r.purpose}</span>
                          <span className="muted">Timestamp</span>
                          <span>{r.timestamp}</span>
                          <span className="muted">ID</span>
                          <span className="muted">{r.id}</span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function actionColor(action: string): string {
  switch (action) {
    case "WRITE":
      return "var(--accent)";
    case "MERGE":
      return "var(--signal-medium)";
    case "ESCALATE":
    case "EXPORT":
      return "var(--signal-high)";
    default:
      return "var(--ink-secondary)";
  }
}
