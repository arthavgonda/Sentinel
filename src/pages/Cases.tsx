import { useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { typeColor, userById } from "../data/mock";
import { useStore } from "../state/store";
import { SignalsDisclaimer, StatusBadge } from "../features/shared";
import { Button, EmptyState, Input, Modal, Select, TypeDot } from "../ui/primitives";
import type { CaseStatus, ObjectType } from "../types";
import { CASE_POLICY, UI_TIMING } from "../config/application";


export function CaseListPage() {
  const { cases, user, createCase } = useStore();
  const nav = useNavigate();
  const [status, setStatus] = useState("All");
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState("Last Updated");
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");

  const rows = useMemo(() => {
    let list = [...cases];
    if (status !== "All") list = list.filter((c) => c.status === status);
    if (mine)
      list = list.filter(
        (c) =>
          c.assignedIds.includes(user?.id ?? "") || c.leadId === user?.id,
      );
    if (sort === "Last Updated")
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (sort === "Created Date")
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "Title A–Z") list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [cases, status, mine, sort, user]);

  function handleCreate() {
    if (!user || !title.trim()) return;
    const c = createCase(title.trim(), user.id);
    setModalOpen(false);
    setTitle("");
    nav(`/cases/${c.id}`);
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="serif page-title">Cases</h1>
        <Button onClick={() => setModalOpen(true)}>New Case</Button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ width: 160 }}
        >
          <option>All</option>
          <option>Open</option>
          <option>Under Review</option>
          <option>Escalated</option>
          <option>Closed</option>
        </Select>
        <label
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
          />
          Assigned to me
        </label>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{ width: 160 }}
        >
          <option>Last Updated</option>
          <option>Created Date</option>
          <option>Title A–Z</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No cases yet"
          body="Create a case to begin grouping objects and building an investigation."
          action={
            <Button onClick={() => setModalOpen(true)}>+ New Case</Button>
          }
        />
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Status</th>
                <th>Lead</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="row-click"
                  onClick={() => nav(`/cases/${c.id}`)}
                >
                  <td className="muted">{c.number}</td>
                  <td style={{ fontWeight: 500 }}>{c.title}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>{userById(c.leadId)?.name ?? c.leadId}</td>
                  <td className="muted">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <Modal
          title="New Case"
          onClose={() => { setModalOpen(false); setTitle(""); }}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setModalOpen(false); setTitle(""); }}>
                Cancel
              </Button>
              <Button
                disabled={!title.trim()}
                title={!title.trim() ? "Case title is required" : undefined}
                onClick={handleCreate}
              >
                Create Case
              </Button>
            </>
          }
        >
          <label className="form-label">Case Title</label>
          <Input
            value={title}
            autoFocus
            maxLength={CASE_POLICY.titleMaxLength}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          {!title.trim() ? (
            <p className="field-error-text">Case title is required.</p>
          ) : null}
          <div style={{ height: 12 }} />
          <label className="form-label">Lead Investigator</label>
          <p style={{ fontSize: 13 }}>{user?.name}</p>
        </Modal>
      ) : null}
    </div>
  );
}

export function CaseLayout() {
  const { id = "" } = useParams();
  const {
    cases,
    user,
    notes,
    renameCase,
    proposeEscalation,
    resolveEscalation,
    agencies,
  } = useStore();
  const rec = cases.find((c) => c.id === id);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(rec?.title ?? "");
  const [escModal, setEscModal] = useState(false);
  const [agencyId, setAgencyId] = useState(agencies[0]?.id ?? "");
  const [denyModal, setDenyModal] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const nav = useNavigate();
  const titleRef = useRef<HTMLInputElement>(null);

  if (!rec) {
    return (
      <div className="empty">
        <p className="empty-title">Case not found.</p>
        <Button variant="secondary" onClick={() => nav("/cases")}>
          Back to Cases
        </Button>
      </div>
    );
  }

  const agencyName = agencies.find((a) => a.id === rec.escalation?.agencyId)?.name;
  const isLead =
    user?.id === rec.leadId ||
    user?.role === "admin" ||
    user?.role === "case_lead";
  const isProposeUser = rec.escalation?.proposedBy === user?.id;
  const canGenerate =
    rec.objectIds.length > 0 || notes.some((n) => n.caseId === rec.id);

  const TABS = [
    { path: "", label: "Overview" },
    { path: "/objects", label: "Objects" },
    { path: "/evidence", label: "Evidence" },
    { path: "/signals", label: "Signals" },
    { path: "/notes", label: "Notes" },
    { path: "/timeline", label: "Timeline" },
  ];

  return (
    <div>
      {rec.escalation?.pending ? (
        <div
          className="banner-warn no-print"
          style={{ margin: "-24px -32px 16px" }}
        >
          <span style={{ fontSize: 13 }}>
            Escalation to{" "}
            <strong>{agencyName ?? "partner agency"}</strong> is pending
            approval.
          </span>
          {isLead && !isProposeUser ? (
            <span style={{ display: "flex", gap: 8 }}>
              <Button
                style={{ height: 32 }}
                onClick={() => resolveEscalation(rec.id, true)}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                style={{ height: 32 }}
                onClick={() => setDenyModal(true)}
              >
                Deny
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              ref={titleRef}
              className="field serif"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                height: 40,
                maxWidth: 480,
              }}
              value={editTitle}
              autoFocus
              maxLength={CASE_POLICY.titleMaxLength}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => {
                if (editTitle.trim()) renameCase(rec.id, editTitle.trim());
                else setEditTitle(rec.title);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") titleRef.current?.blur();
                if (e.key === "Escape") {
                  setEditTitle(rec.title);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <h1
              className="serif"
              style={{ fontSize: 20, margin: 0, cursor: "text" }}
              title="Click to rename"
              onClick={() => {
                setEditTitle(rec.title);
                setEditing(true);
              }}
            >
              {rec.title}
            </h1>
          )}
          <p className="muted" style={{ marginTop: 4 }}>
            Case #{rec.number} · Lead {userById(rec.leadId)?.name ?? rec.leadId}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <Select
            value={rec.status}
            disabled={Boolean(rec.escalation?.pending)}
            title={
              rec.escalation?.pending
                ? "Status is locked while an escalation is pending"
                : undefined
            }
            onChange={(e) => {
              const v = e.target.value as CaseStatus;
              if (v === "Escalated") setEscModal(true);
            }}
            style={{ width: 160 }}
          >
            <option>Open</option>
            <option>Under Review</option>
            <option>Escalated</option>
            <option>Closed</option>
          </Select>
          <StatusBadge status={rec.status} />
          <Button
            variant="secondary"
            disabled={!canGenerate}
            title={
              !canGenerate
                ? "Add at least one object or note before generating a brief"
                : undefined
            }
            onClick={() => nav(`/cases/${rec.id}/brief`)}
          >
            Generate Brief
          </Button>
        </div>
      </div>

      <div className="tabs no-print">
        {TABS.map(({ path, label }) => (
          <NavLink
            key={label}
            to={`/cases/${rec.id}${path}`}
            end={path === ""}
            className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
          >
            {label}
          </NavLink>
        ))}
      </div>

      <div style={{ paddingTop: 16 }}>
        <Outlet />
      </div>

      {escModal ? (
        <Modal
          title="Escalate this case?"
          onClose={() => setEscModal(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEscModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  proposeEscalation(rec.id, agencyId);
                  setEscModal(false);
                }}
              >
                Propose Escalation
              </Button>
            </>
          }
        >
          <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
            This will prepare a scoped export for a partner agency. A Case Lead
            must approve before any data leaves the system.
          </p>
          <label className="form-label">Partner agency</label>
          <Select
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
          >
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Modal>
      ) : null}

      {denyModal ? (
        <Modal
          title="Deny escalation"
          onClose={() => setDenyModal(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setDenyModal(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={!denyReason.trim()}
                onClick={() => {
                  resolveEscalation(rec.id, false, denyReason.trim());
                  setDenyModal(false);
                  setDenyReason("");
                }}
              >
                Deny
              </Button>
            </>
          }
        >
          <label className="form-label">Reason (required)</label>
          <textarea
            className="field"
            value={denyReason}
            autoFocus
            onChange={(e) => setDenyReason(e.target.value)}
          />
        </Modal>
      ) : null}
    </div>
  );
}

export function CaseOverview() {
  const { id = "" } = useParams();
  const { cases, objects, notes, signals } = useStore();
  const nav = useNavigate();
  const rec = cases.find((c) => c.id === id);
  if (!rec) return null;

  const members = objects.filter((o) => rec.objectIds.includes(o.id));
  const counts = members.reduce<Record<string, number>>((acc, o) => {
    acc[o.type] = (acc[o.type] ?? 0) + 1;
    return acc;
  }, {});
  const caseNotes = notes
    .filter((n) => n.caseId === rec.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const caseSignals = signals.filter((s) => s.caseId === rec.id);
  const total = caseSignals.reduce((n, s) => n + s.points, 0);
  const draft = localStorage.getItem(`sentinel.noteDraft.${rec.id}`);

  return (
    <div className="grid-2">
      <div>
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="list-row">
            <p className="eyebrow" style={{ marginBottom: 0 }}>
              Objects
            </p>
          </div>
          {members.length === 0 ? (
            <div style={{ padding: "12px 16px" }}>
              <p className="muted">No objects in this case yet.</p>
              <Button
                variant="link"
                style={{ marginTop: 8 }}
                onClick={() => nav(`/cases/${rec.id}/objects`)}
              >
                + Add Object
              </Button>
            </div>
          ) : (
            Object.entries(counts).map(([t, n]) => (
              <div
                key={t}
                className="list-row row-click"
                onClick={() =>
                  nav(`/cases/${rec.id}/objects?type=${t}`)
                }
              >
                <TypeDot color={typeColor(t as ObjectType)} />
                <span className="grow">
                  {n} {t === "Person" ? "People" : `${t}s`}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <p className="eyebrow">Recent Notes</p>
          {caseNotes.length === 0 ? (
            <p className="muted">No notes yet.</p>
          ) : (
            caseNotes.map((n) => (
              <div
                key={n.id}
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "10px 0",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <p className="muted" style={{ marginBottom: 4 }}>
                  {userById(n.authorId)?.name} ·{" "}
                  {new Date(n.createdAt).toLocaleDateString()}
                </p>
                <p>
                  {n.body.length > 160
                    ? `${n.body.slice(0, 158)}…`
                    : n.body}
                </p>
              </div>
            ))
          )}
          {notes.filter((n) => n.caseId === rec.id).length > 3 ? (
            <Button
              variant="link"
              style={{ marginTop: 10 }}
              onClick={() => nav(`/cases/${rec.id}/notes`)}
            >
              View all notes →
            </Button>
          ) : null}
        </div>
      </div>

      <div>
        {draft ? (
          <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
            <p style={{ marginBottom: 8, fontSize: 13 }}>
              You have an unsaved note from your last session.
            </p>
            <Link to={`/cases/${rec.id}/notes`}>Restore</Link>
          </div>
        ) : null}

        <div className="panel" style={{ padding: 16 }}>
          <p className="serif" style={{ fontSize: 16, marginBottom: 4 }}>
            Investigation Signals
          </p>
          <SignalsDisclaimer />
          <p style={{ fontWeight: 600, margin: "12px 0 8px" }}>
            Total signals: {total}
          </p>
          {caseSignals.slice(0, 3).map((s) => (
            <div
              key={s.id}
              className="list-row"
              style={{ paddingLeft: 0, paddingRight: 0 }}
            >
              <span className="grow">{s.label}</span>
              <span style={{ fontWeight: 500 }}>+{s.points}</span>
            </div>
          ))}
          {caseSignals.length > 0 ? (
            <Button
              variant="link"
              style={{ marginTop: 8 }}
              onClick={() => nav(`/cases/${rec.id}/signals`)}
            >
              View all →
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CaseObjects() {
  const { id = "" } = useParams();
  const { cases, objects, removeObjectFromCase, addObjectToCase } = useStore();
  const rec = cases.find((c) => c.id === id);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [q, setQ] = useState("");

  if (!rec) return null;
  const members = objects.filter((o) => rec.objectIds.includes(o.id));
  const available = objects.filter(
    (o) =>
      !rec.objectIds.includes(o.id) &&
      (o.display.toLowerCase().includes(q.toLowerCase()) || !q),
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <Button onClick={() => setAddModal(true)}>+ Add Object</Button>
      </div>

      {members.length === 0 ? (
        <EmptyState
          title="No objects in this case"
          body="Add objects to begin building out this investigation."
          action={
            <Button onClick={() => setAddModal(true)}>+ Add Object</Button>
          }
        />
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Type</th>
                <th>Linked to</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <TypeDot color={typeColor(o.type)} />
                      <span style={{ fontWeight: 500 }}>{o.display}</span>
                    </div>
                  </td>
                  <td className="muted">{o.type}</td>
                  <td className="muted">{o.linkedCount} objects</td>
                  <td style={{ textAlign: "right" }}>
                    {confirmId === o.id ? (
                      <span style={{ display: "inline-flex", gap: 8 }}>
                        <Button
                          variant="danger-text"
                          style={{ height: "auto", padding: 0, fontSize: 12 }}
                          onClick={() => {
                            removeObjectFromCase(rec.id, o.id);
                            setConfirmId(null);
                          }}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="link"
                          style={{ height: "auto", padding: 0, fontSize: 12 }}
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <Button
                        variant="icon"
                        aria-label={`Remove ${o.display}`}
                        onClick={() => setConfirmId(o.id)}
                        style={{ fontSize: 16 }}
                      >
                        ×
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addModal ? (
        <Modal
          title="Add object"
          onClose={() => { setAddModal(false); setQ(""); }}
          footer={
            <Button onClick={() => { setAddModal(false); setQ(""); }}>
              Done
            </Button>
          }
        >
          <Input
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search objects…"
          />
          <div style={{ marginTop: 8 }}>
            {available.slice(0, 10).map((o) => (
              <button
                key={o.id}
                className="suggest-row"
                onClick={() => addObjectToCase(rec.id, o.id)}
                style={{ justifyContent: "space-between" }}
              >
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <TypeDot color={typeColor(o.type)} />
                  {o.display}
                </span>
                <span className="muted">{o.type}</span>
              </button>
            ))}
            {available.length === 0 ? (
              <p className="muted" style={{ padding: "8px 12px" }}>
                No more objects to add.
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function CaseEvidence() {
  const { id = "" } = useParams();
  const { cases, objects } = useStore();
  const rec = cases.find((c) => c.id === id);
  if (!rec) return null;
  const items = objects.filter(
    (o) =>
      rec.objectIds.includes(o.id) &&
      (o.type === "Document" || o.type === "JobListing"),
  );

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState
          title="No evidence items yet"
          body="Documents and job listings linked to this case will appear here."
        />
      ) : (
        items.map((o) => (
          <div
            key={o.id}
            className="panel"
            style={{ padding: 16, marginBottom: 12 }}
          >
            <p className="eyebrow">{o.type}</p>
            <p style={{ fontWeight: 500, fontSize: 15, margin: "4px 0 8px" }}>
              {o.display}
            </p>
            <p className="muted">{Object.values(o.properties).join(" · ")}</p>
          </div>
        ))
      )}
    </div>
  );
}

export function CaseSignals() {
  const { id = "" } = useParams();
  const { cases, signals, objects } = useStore();
  const rec = cases.find((c) => c.id === id);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!rec) return null;

  const list = signals.filter((s) => s.caseId === rec.id);
  const total = list.reduce((n, s) => n + s.points, 0);

  return (
    <div className="panel" style={{ padding: 16 }}>
      <p className="serif" style={{ fontSize: 16, marginBottom: 4 }}>
        Investigation Signals
      </p>
      <SignalsDisclaimer />

      {list.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>
          No signals for this case yet.
        </p>
      ) : (
        <>
          <p style={{ fontWeight: 600, margin: "16px 0 8px" }}>
            Total signals: {total}
          </p>
          {list.map((s) => (
            <div
              key={s.id}
              style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}
            >
              <button
                className="btn btn-link"
                style={{ fontWeight: 500, fontSize: 13 }}
                onClick={() => setOpenId(openId === s.id ? null : s.id)}
              >
                {s.label}
                <span
                  style={{
                    color: "var(--signal-medium)",
                    fontWeight: 600,
                    marginLeft: 4,
                  }}
                >
                  +{s.points}
                </span>
              </button>
              {openId === s.id ? (
                <ul style={{ marginTop: 8 }}>
                  {s.objectIds.map((oid) => (
                    <li key={oid} style={{ fontSize: 12, color: "var(--ink-secondary)" }}>
                      {objects.find((o) => o.id === oid)?.display ?? oid}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function CaseNotes() {
  const { id = "" } = useParams();
  const { notes, postNote, saveNoteDraft, consumeNoteDraft, users } = useStore();
  const [body, setBody] = useState("");
  const draftExists = Boolean(localStorage.getItem(`sentinel.noteDraft.${id}`));
  const [showBanner, setShowBanner] = useState(draftExists);
  const list = notes
    .filter((n) => n.caseId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function handlePost() {
    if (!body.trim()) return;
    postNote(id, body.trim());
    setBody("");
  }

  return (
    <div>
      {showBanner ? (
        <div
          className="panel"
          style={{ padding: 16, marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}
        >
          <span style={{ flex: 1, fontSize: 13 }}>
            You have an unsaved note from your last session.
          </span>
          <Button
            variant="secondary"
            style={{ height: 32 }}
            onClick={() => {
              const draft = consumeNoteDraft(id);
              if (draft) setBody(draft);
              setShowBanner(false);
            }}
          >
            Restore
          </Button>
          <Button
            variant="icon"
            aria-label="Dismiss"
            onClick={() => setShowBanner(false)}
          >
            ×
          </Button>
        </div>
      ) : null}

      <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
        <textarea
          className="field"
          maxLength={5000}
          placeholder="Add a note to this case…"
          value={body}
          style={{ minHeight: 96 }}
          onChange={(e) => {
            setBody(e.target.value);
            saveNoteDraft(id, e.target.value);
          }}
        />
        {body.length > 4500 ? (
          <div className="char-count">{body.length}/5000</div>
        ) : null}
        <div style={{ marginTop: 10 }}>
          <Button disabled={!body.trim()} onClick={handlePost}>
            Post
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No notes yet"
          body="Notes posted here are permanent — post a correction to amend rather than editing."
        />
      ) : (
        list.map((n) => (
          <div
            key={n.id}
            className="panel"
            style={{ padding: 16, marginBottom: 12 }}
          >
            <p className="muted" style={{ marginBottom: 8 }}>
              {users.find((u) => u.id === n.authorId)?.name ?? n.authorId} ·{" "}
              {new Date(n.createdAt).toLocaleString()}
            </p>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{n.body}</p>
          </div>
        ))
      )}
    </div>
  );
}

export function CaseTimeline() {
  const { id = "" } = useParams();
  const { cases, notes } = useStore();
  const rec = cases.find((c) => c.id === id);
  if (!rec) return null;

  const events = [
    { at: rec.createdAt, text: "Case created", type: "case" },
    ...notes
      .filter((n) => n.caseId === rec.id)
      .map((n) => ({
        at: n.createdAt,
        text: `Note posted by ${userById(n.authorId)?.name ?? "analyst"}`,
        type: "note",
      })),
    ...(rec.escalation
      ? [{ at: rec.updatedAt, text: "Escalation proposed", type: "escalate" }]
      : []),
    { at: rec.updatedAt, text: `Status: ${rec.status}`, type: "status" },
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="panel" style={{ padding: 16 }}>
      {events.map((e, i) => (
        <div
          key={i}
          className="list-row"
          style={{ paddingLeft: 0, paddingRight: 0 }}
        >
          <span
            className="muted"
            style={{ minWidth: 160, flexShrink: 0 }}
          >
            {new Date(e.at).toLocaleString()}
          </span>
          <span style={{ flex: 1 }}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}

export function BriefPage() {
  const { id = "" } = useParams();
  const { cases, objects, notes, signals } = useStore();
  const rec = cases.find((c) => c.id === id);
  const [generating, setGenerating] = useState(false);
  const nav = useNavigate();

  if (!rec) return null;

  const members = objects.filter((o) => rec.objectIds.includes(o.id));
  const byType = members.reduce<Record<string, typeof members>>((acc, o) => {
    acc[o.type] = [...(acc[o.type] ?? []), o];
    return acc;
  }, {});
  const evidence = members.filter(
    (o) => o.type === "Document" || o.type === "JobListing",
  );
  const sig = signals.filter((s) => s.caseId === rec.id);
  const total = sig.reduce((n, s) => n + s.points, 0);
  const caseNotes = notes
    .filter((n) => n.caseId === rec.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  function handleDownload() {
    setGenerating(true);
    window.setTimeout(() => {
      setGenerating(false);
      window.print();
    }, UI_TIMING.dismissDelayMs);
  }

  return (
    <div>
      <div className="page-head no-print">
        <div className="crumb" style={{ marginBottom: 0 }}>
          <Link to={`/cases/${rec.id}`}>Case #{rec.number}</Link>
          <span>/</span>
          <span>Investigation Brief</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={() => nav(`/cases/${rec.id}`)}>
            ← Back to Case
          </Button>
          <Button onClick={handleDownload}>
            {generating ? "Generating your brief…" : "Download as PDF"}
          </Button>
        </div>
      </div>

      <div
        className="panel"
        style={{ padding: 32, maxWidth: 800 }}
        id="brief-content"
      >
        <h1 className="serif" style={{ fontSize: 24, marginBottom: 4 }}>
          {rec.title}
        </h1>
        <p className="muted" style={{ marginBottom: 24, fontSize: 12 }}>
          {rec.status} · Lead {userById(rec.leadId)?.name ?? rec.leadId} ·
          Created {new Date(rec.createdAt).toLocaleDateString()} · Generated{" "}
          {new Date().toLocaleString()}
        </p>

        <h2 className="serif" style={{ fontSize: 14, marginBottom: 12 }}>
          Objects
        </h2>
        {Object.entries(byType).map(([t, list]) => (
          <div key={t} style={{ marginBottom: 12 }}>
            <p className="eyebrow">
              {t}s ({list.length})
            </p>
            {list.map((o) => (
              <p key={o.id} style={{ fontSize: 13, margin: "4px 0" }}>
                {o.display}
              </p>
            ))}
          </div>
        ))}

        <h2 className="serif" style={{ fontSize: 14, margin: "20px 0 12px" }}>
          Evidence
        </h2>
        {evidence.length === 0 ? (
          <p className="muted">No evidence items.</p>
        ) : (
          evidence.map((o) => (
            <p key={o.id} style={{ fontSize: 13, margin: "4px 0" }}>
              {o.display} — {Object.values(o.properties).join(", ")}
            </p>
          ))
        )}

        <h2 className="serif" style={{ fontSize: 14, margin: "20px 0 4px" }}>
          Investigation Signals
        </h2>
        <SignalsDisclaimer />
        <p style={{ fontWeight: 600, margin: "10px 0 8px" }}>
          Total signals: {total}
        </p>
        {sig.map((s) => (
          <p key={s.id} style={{ fontSize: 13, margin: "4px 0" }}>
            {s.label}{" "}
            <span style={{ color: "var(--signal-medium)" }}>+{s.points}</span>
          </p>
        ))}

        <h2 className="serif" style={{ fontSize: 14, margin: "20px 0 12px" }}>
          Notes
        </h2>
        {caseNotes.length === 0 ? (
          <p className="muted">No notes.</p>
        ) : (
          caseNotes.map((n) => (
            <div
              key={n.id}
              style={{
                borderBottom: "1px solid var(--border)",
                padding: "10px 0",
              }}
            >
              <p
                className="muted"
                style={{ marginBottom: 4, fontSize: 11 }}
              >
                {userById(n.authorId)?.name ?? n.authorId} ·{" "}
                {new Date(n.createdAt).toLocaleString()}
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.6 }}>{n.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

