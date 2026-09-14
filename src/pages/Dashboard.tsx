import { useNavigate } from "react-router-dom";
import { ACTIVITY, formatRelative, typeColor } from "../data/mock";
import { useStore } from "../state/store";
import { Button, TypeDot } from "../ui/primitives";
import { StatusBadge } from "../features/shared";
import type { ObjectType } from "../types";

export function DashboardPage() {
  const { cases, erMatches, user } = useStore();
  const nav = useNavigate();

  const mine = cases.filter(
    (c) => c.assignedIds.includes(user?.id ?? "") || c.leadId === user?.id,
  );
  const open = cases.filter(
    (c) => c.status === "Open" || c.status === "Under Review",
  ).length;
  const objCount = mine.reduce((n, c) => n + c.objectIds.length, 0);
  const recent = [...cases]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const assigned = mine
    .filter((c) => c.status !== "Closed")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <div>
      <div className="page-head">
        <h1 className="serif page-title">Dashboard</h1>
        <Button onClick={() => nav("/cases")}>New Case</Button>
      </div>

      <div className="stat-row">
        <StatCard
          num={open}
          label="Open Cases"
          onClick={() => nav("/cases")}
        />
        <StatCard
          num={objCount}
          label="Objects in My Cases"
          onClick={() => nav("/cases")}
        />
        <StatCard
          num={erMatches.length}
          label="Pending Review"
          onClick={() => nav("/entity-resolution/review")}
        />
        <StatCard num={6} label="New Evidence (7d)" />
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="list-row" style={{ paddingTop: 12, paddingBottom: 12 }}>
              <strong className="grow" style={{ fontSize: 15 }}>
                Recent Cases
              </strong>
              <Button variant="link" onClick={() => nav("/cases")}>
                View all →
              </Button>
            </div>
            {recent.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <p className="muted">No cases yet.</p>
                <Button
                  style={{ marginTop: 12 }}
                  onClick={() => nav("/cases")}
                >
                  New Case
                </Button>
              </div>
            ) : (
              recent.map((c) => (
                <div
                  key={c.id}
                  className="list-row row-click"
                  onClick={() => nav(`/cases/${c.id}`)}
                >
                  <div className="grow truncate" style={{ fontSize: 13 }}>
                    {c.title}
                  </div>
                  <StatusBadge status={c.status} />
                  <span className="muted">{formatRelative(c.updatedAt)}</span>
                </div>
              ))
            )}
          </div>

          <div className="panel">
            <div className="list-row" style={{ paddingTop: 12, paddingBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>Assigned to Me</strong>
            </div>
            {assigned.length === 0 ? (
              <div style={{ padding: "16px", color: "var(--ink-secondary)", fontSize: 12 }}>
                No active assignments.
              </div>
            ) : (
              assigned.map((c) => (
                <div
                  key={c.id}
                  className="list-row row-click"
                  onClick={() => nav(`/cases/${c.id}`)}
                >
                  <div className="grow truncate">{c.title}</div>
                  <StatusBadge status={c.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="list-row" style={{ paddingTop: 12, paddingBottom: 12 }}>
            <strong style={{ fontSize: 15 }}>Activity</strong>
          </div>
          {ACTIVITY.sort((a, b) => b.at.localeCompare(a.at)).map((a) => (
            <div
              key={a.id}
              className="list-row row-click"
              onClick={() => nav(a.href)}
            >
              <TypeDot
                color={typeColor((a.objectType as ObjectType) ?? "Document")}
              />
              <div className="grow">
                <div style={{ fontSize: 13 }}>{a.text}</div>
                <div className="muted">{formatRelative(a.at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  num,
  label,
  onClick,
}: {
  num: number;
  label: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="panel stat-card"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <p className="stat-num">{num}</p>
      <p className="muted">{label}</p>
    </div>
  );
}
