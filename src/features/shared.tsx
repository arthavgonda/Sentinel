import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  confidenceTone,
  formatRelative,
  SIGNALS_DISCLAIMER,
  typeColor,
  userById,
} from "../data/mock";
import { useStore } from "../state/store";
import type { Link, OntologyObject } from "../types";
import { Badge, Button, Input, Modal, TypeDot } from "../ui/primitives";
import { CASE_POLICY, UI_TIMING } from "../config/application";

export function EvidencePopover({
  link,
  from,
  to,
  onClose,
  style,
}: {
  link: Link;
  from?: OntologyObject;
  to?: OntologyObject;
  onClose: () => void;
  style?: React.CSSProperties;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [docModal, setDocModal] = useState(false);
  const tone = confidenceTone(link.confidence);

  return (
    <>
      <div
        className="popover"
        style={{ width: 340, padding: 16, position: "relative", ...style }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 10,
          }}
        >
          <strong className="serif" style={{ fontSize: 16 }}>
            Relationship Evidence
          </strong>
          <Button
            variant="icon"
            aria-label="Close evidence popover"
            onClick={onClose}
            style={{ marginTop: -4, marginRight: -4 }}
          >
            ×
          </Button>
        </div>

        <p style={{ fontSize: 13, marginBottom: 6 }}>
          {from?.display ?? link.from}{" "}
          <span className="muted">— {link.type.replace(/_/g, " ")} —</span>{" "}
          {to?.display ?? link.to}
        </p>

        <p className="muted" style={{ marginBottom: 4 }}>
          Source:{" "}
          <button className="btn btn-link" onClick={() => setDocModal(true)}>
            {link.sourceLabel}
          </button>
        </p>

        <p className="muted" style={{ marginBottom: 10 }}>
          Observed {link.observed}
        </p>

        <p style={{ fontSize: 13, marginBottom: 8 }}>
          {link.method === "deterministic"
            ? "Deterministic match"
            : "Probabilistic match"}
          {link.method === "probabilistic" ? (
            <span className="tip-wrap" style={{ marginLeft: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                ⓘ
              </span>
              <span className="tip">
                This match was computed using similarity scoring, not an exact
                identifier match.
              </span>
            </span>
          ) : null}
        </p>

        <div
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}
        >
          <div className="conf-bar-wrap">
            <div
              className="conf-bar-fill"
              style={{
                width: `${link.confidence}%`,
                background:
                  tone === "high"
                    ? "var(--signal-high)"
                    : tone === "medium"
                      ? "var(--signal-medium)"
                      : "var(--signal-low)",
              }}
            />
          </div>
          <span className={`conf-${tone}`} style={{ fontSize: 13, fontWeight: 500 }}>
            {link.confidence}%
          </span>
        </div>

        <p className="eyebrow" style={{ marginBottom: 6 }}>
          Matched attributes
        </p>
        <ul style={{ paddingLeft: 16, margin: "0 0 12px" }}>
          {link.matchedAttributes.map((a) => (
            <li key={a} style={{ fontSize: 12, color: "var(--ink-secondary)", margin: "3px 0" }}>
              {a}
            </li>
          ))}
        </ul>

        {noteOpen ? (
          <div>
            <textarea
              className="field"
              value={noteText}
              autoFocus
              placeholder="Add a note about this relationship…"
              onChange={(e) => setNoteText(e.target.value)}
            />
            <Button
              style={{ marginTop: 8, height: 32 }}
              onClick={() => setNoteOpen(false)}
            >
              Save
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="secondary"
              style={{ height: 32, fontSize: 12 }}
              onClick={() => setDocModal(true)}
            >
              View Source Document
            </Button>
            <Button
              variant="secondary"
              style={{ height: 32, fontSize: 12 }}
              onClick={() => setNoteOpen(true)}
            >
              Add Note
            </Button>
          </div>
        )}
      </div>

      {docModal ? (
        <Modal
          title={link.sourceLabel}
          onClose={() => setDocModal(false)}
          width={640}
        >
          <HighlightedSourceText
            text="Registered office: Andheri East, Mumbai. Contact listed as +91 22 4188 2901 for Horizon Staffing Pvt Ltd."
            match="+91 22 4188 2901"
          />
        </Modal>
      ) : null}
    </>
  );
}

function HighlightedSourceText({
  text,
  match,
}: {
  text: string;
  match: string;
}) {
  const i = text.indexOf(match);
  if (i < 0) return <p style={{ lineHeight: 1.6 }}>{text}</p>;
  return (
    <p style={{ lineHeight: 1.6 }}>
      {text.slice(0, i)}
      <mark
        style={{
          background: "color-mix(in srgb, var(--signal-medium) 30%, transparent)",
          padding: "0 2px",
          borderRadius: 2,
        }}
      >
        {match}
      </mark>
      {text.slice(i + match.length)}
    </p>
  );
}

export function AddToCasePopover({
  objectId,
  onClose,
}: {
  objectId: string;
  onClose: () => void;
}) {
  const { cases, user, addObjectToCase, createCase } = useStore();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  const mine = cases.filter(
    (c) =>
      c.assignedIds.includes(user?.id ?? "") || c.leadId === user?.id,
  );

  if (creating) {
    return (
      <Modal
        title="New Case"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!newTitle.trim()}
              title={!newTitle.trim() ? "Case title is required" : undefined}
              onClick={() => {
                if (!newTitle.trim() || !user) return;
                const c = createCase(
                  newTitle.trim().slice(0, CASE_POLICY.titleMaxLength),
                  user.id,
                  objectId,
                );
                nav(`/cases/${c.id}`);
                onClose();
              }}
            >
              Create Case
            </Button>
          </>
        }
      >
        <label className="form-label">Case Title</label>
        <Input
          autoFocus
          maxLength={CASE_POLICY.titleMaxLength}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        {!newTitle.trim() ? (
          <p className="field-error-text">Case title is required.</p>
        ) : null}
        <div style={{ height: 12 }} />
        <label className="form-label">Lead Investigator</label>
        <p style={{ fontSize: 13 }}>{user?.name}</p>
      </Modal>
    );
  }

  return (
    <div className="popover" style={{ width: 280, padding: 4, right: 0, top: "100%" }}>
      {mine.length === 0 ? (
        <p className="muted" style={{ padding: "8px 12px" }}>
          No cases yet.
        </p>
      ) : null}
      {mine.map((c) => (
        <button
          key={c.id}
          className="suggest-row"
          onClick={() => {
            addObjectToCase(c.id, objectId);
            setAdded(c.id);
            window.setTimeout(onClose, UI_TIMING.dismissDelayMs);
          }}
        >
          <span className="grow">{c.title}</span>
          {added === c.id ? (
            <span style={{ color: "var(--signal-medium)", fontSize: 11 }}>
              Added ✓
            </span>
          ) : null}
        </button>
      ))}
      <button
        className="suggest-row"
        style={{ borderTop: "1px solid var(--border)" }}
        onClick={() => setCreating(true)}
      >
        + Create New Case with this Object
      </button>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Open"
      ? "accent"
      : status === "Under Review"
        ? "medium"
        : status === "Escalated"
          ? "high"
          : "muted";
  return <Badge tone={tone}>{status}</Badge>;
}

export function ClassBadge({ value }: { value: string }) {
  const tone =
    value === "Highly Restricted"
      ? "high"
      : value === "Restricted"
        ? "medium"
        : value === "Internal"
          ? "accent"
          : "low";
  return (
    <span className="tip-wrap">
      <Badge tone={tone}>{value}</Badge>
      <span className="tip" style={{ whiteSpace: "normal", minWidth: 200 }}>
        {CLASSIFICATION_HELP[value]}
      </span>
    </span>
  );
}

export function SignalsDisclaimer() {
  return (
    <p
      className="muted"
      style={{ fontStyle: "italic", fontSize: 11, margin: "4px 0 0" }}
    >
      {SIGNALS_DISCLAIMER}
    </p>
  );
}

export function ObjectRow({
  object,
  extra,
}: {
  object: OntologyObject;
  extra?: React.ReactNode;
}) {
  const nav = useNavigate();
  return (
    <div
      className="list-row row-click"
      onClick={() => nav(`/objects/${object.id}`)}
    >
      <TypeDot color={typeColor(object.type)} />
      <div className="grow truncate">
        <div style={{ fontSize: 15, fontWeight: 500 }}>{object.display}</div>
        <div className="muted">{object.type}</div>
      </div>
      {extra}
    </div>
  );
}

export function relative(iso: string) {
  return formatRelative(iso);
}

export function leadName(id: string) {
  return userById(id)?.name ?? id;
}

const CLASSIFICATION_HELP: Record<string, string> = {
  Public: "Public: openly available information with no access restriction.",
  Internal:
    "Internal: business and organizational data not directly tied to identifiable individuals.",
  Restricted:
    "Restricted: sensitive operational data that is not public but does not directly identify individuals.",
  "Highly Restricted":
    "Highly Restricted: contains direct PII such as full names and phone numbers tied to identifiable individuals.",
};
