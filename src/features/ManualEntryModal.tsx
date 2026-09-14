import { useMemo, useState } from "react";
import { CLASSIFICATION_HELP } from "../data/mock";
import { useStore } from "../state/store";
import { CONTENT_POLICY, UI_TIMING } from "../config/application";
import { Button, Input, Modal, Select } from "../ui/primitives";
import type { Classification, ObjectType } from "../types";

const OBJECT_TYPES: ObjectType[] = [
  "Person",
  "Organization",
  "Phone",
  "Location",
  "JobListing",
  "Document",
];

const STEP_LABELS = [
  "Object Type",
  "Properties",
  "Justification",
  "Related Objects",
];

type FieldMap = Record<string, string>;

function fieldsForType(type: ObjectType): string[] {
  switch (type) {
    case "Person":
      return ["Name", "Aliases", "City"];
    case "Organization":
      return ["Name", "Address", "Sector"];
    case "Phone":
      return ["Number", "Carrier"];
    case "Location":
      return ["Address", "Type"];
    case "JobListing":
      return ["Title", "Organization", "Phone", "Location"];
    case "Document":
      return ["Title", "Source", "Date"];
    default:
      return ["Title"];
  }
}

export function ManualEntryModal({ onClose }: { onClose: () => void }) {
  const { addObject, objects } = useStore();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ObjectType>("Location");
  const [fields, setFields] = useState<FieldMap>({});
  const [justification, setJustification] = useState("");
  const [basis, setBasis] = useState("Field Report");
  const [basisOther, setBasisOther] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [err, setErr] = useState("");
  const [toast, setToast] = useState(false);

  const fieldKeys = useMemo(() => fieldsForType(type), [type]);

  const primaryField = fieldKeys[0] ?? "Title";
  const displayValue = fields[primaryField]?.trim() || "";

  function advance() {
    if (step === 1 && !displayValue) {
      setErr(`${primaryField} is required.`);
      return;
    }
    if (step === 2 && !justification.trim()) {
      setErr("Justification is required.");
      return;
    }
    setErr("");
    setStep((s) => s + 1);
  }

  function handleCreate() {
    addObject({
      id: `obj-${crypto.randomUUID()}`,
      type,
      display: displayValue || "Untitled",
      linkedCount: linkTo ? 1 : 0,
      firstSeen: new Date().toISOString().slice(0, 10),
      imageUrl: fields["Image URL"]?.trim() || undefined,
      properties: {
        ...fields,
        Justification: justification,
        Basis: basis === "Other" ? basisOther || "Other" : basis,
      },
    });
    setToast(true);
    window.setTimeout(onClose, UI_TIMING.dismissDelayMs);
  }

  return (
    <>
      <Modal
        title="Add object manually"
        onClose={onClose}
        width={520}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            >
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < 3 ? (
              <Button onClick={advance}>Next</Button>
            ) : (
              <Button onClick={handleCreate}>Create Object</Button>
            )}
          </>
        }
      >
        <StepIndicator current={step} total={4} labels={STEP_LABELS} />

        {step === 0 ? (
          <div>
            <label className="form-label">Object type</label>
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value as ObjectType);
                setFields({});
              }}
            >
              {OBJECT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            {fieldKeys.map((f) => (
              <div key={f} style={{ marginBottom: 12 }}>
                <label className="form-label">{f}</label>
                <Input
                  value={fields[f] ?? ""}
                  onChange={(e) => {
                    setFields((p) => ({ ...p, [f]: e.target.value }));
                    setErr("");
                  }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Image URL <span className="muted">(optional)</span></label>
              <Input
                type="url"
                value={fields["Image URL"] ?? ""}
                placeholder="https://…"
                onChange={(e) => setFields((p) => ({ ...p, "Image URL": e.target.value }))}
              />
            </div>
            {err ? <p className="field-error-text">{err}</p> : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <label className="form-label">Justification</label>
            <textarea
              className="field"
              maxLength={CONTENT_POLICY.manualEntryJustificationMaxLength}
              placeholder="Why are you adding this object? What is the source of this information?"
              value={justification}
              autoFocus
              onChange={(e) => {
                setJustification(e.target.value);
                setErr("");
              }}
            />
            {justification.length > CONTENT_POLICY.manualEntryJustificationWarningLength ? (
              <div className="char-count">{justification.length}/{CONTENT_POLICY.manualEntryJustificationMaxLength}</div>
            ) : null}
            <div style={{ height: 12 }} />
            <label className="form-label">Basis</label>
            <Select
              value={basis}
              onChange={(e) => setBasis(e.target.value)}
            >
              <option>Hotline Call</option>
              <option>Field Report</option>
              <option>Partner Agency Communication</option>
              <option>Other</option>
            </Select>
            {basis === "Other" ? (
              <Input
                style={{ marginTop: 8 }}
                value={basisOther}
                placeholder="Specify"
                onChange={(e) => setBasisOther(e.target.value)}
              />
            ) : null}
            {err ? <p className="field-error-text">{err}</p> : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <label className="form-label">Link to existing object (optional)</label>
            <Select
              value={linkTo}
              onChange={(e) => setLinkTo(e.target.value)}
            >
              <option value="">None</option>
              {objects.slice(0, 20).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.display} ({o.type})
                </option>
              ))}
            </Select>
            {linkTo ? (
              <p className="muted" style={{ marginTop: 8 }}>
                Will be linked via "related_to" relationship.
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {toast ? (
        <div className="toast">
          Object created — pending entity resolution check.
        </div>
      ) : null}
    </>
  );
}

export function SourceWizard({ onClose }: { onClose: () => void }) {
  const { addSource, user } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [type, setType] = useState("API Connection");
  const [legal, setLegal] = useState("");
  const [doc, setDoc] = useState("");
  const [cls, setCls] = useState<Classification>("Internal");
  const [ret, setRet] = useState("1 year");

  const warn = cls === "Highly Restricted" && ret === "Indefinite";

  const canNext =
    step === 0
      ? name.trim().length > 0
      : step === 1
        ? Boolean(legal && doc.trim())
        : true;

  const STEP_LABELS_SRC = [
    "Basic Info",
    "Legal Basis",
    "Classification",
    "Retention Policy",
  ];

  function handleCreate() {
    addSource({
      id: `src-${crypto.randomUUID()}`,
      name: name.trim(),
      classification: cls,
      legalBasis: legal,
      owner: user?.name ?? "Steward",
      recordsIngested: 0,
      lastSync: "Never",
      type: type as "API Connection" | "CSV Upload" | "Manual Entry",
    });
    onClose();
  }

  return (
    <Modal
      title="Add source"
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button
              disabled={!canNext}
              title={
                !canNext && step === 1
                  ? "Legal basis is required before this source can be created."
                  : undefined
              }
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button onClick={handleCreate}>Create Source</Button>
          )}
        </>
      }
    >
      <StepIndicator current={step} total={4} labels={STEP_LABELS_SRC} />

      {step === 0 ? (
        <div>
          <label className="form-label">Source name</label>
          <Input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Regional Business Registry"
          />
          <div style={{ height: 12 }} />
          <label className="form-label">Source type</label>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option>API Connection</option>
            <option>CSV Upload</option>
            <option>Manual Entry</option>
          </Select>
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <label className="form-label">Legal basis</label>
          <Select
            value={legal}
            onChange={(e) => setLegal(e.target.value)}
          >
            <option value="">Select…</option>
            <option>Public record</option>
            <option>License</option>
            <option>MOU or DPA</option>
            <option>Documented consent</option>
          </Select>
          <div style={{ height: 12 }} />
          <label className="form-label">Supporting documentation reference</label>
          <Input
            value={doc}
            placeholder="Internal reference number (e.g. DPA-2026-014)"
            onChange={(e) => setDoc(e.target.value)}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <label className="form-label">Classification</label>
          <Select
            value={cls}
            onChange={(e) => setCls(e.target.value as Classification)}
          >
            <option>Public</option>
            <option>Internal</option>
            <option>Restricted</option>
            <option>Highly Restricted</option>
          </Select>
          <p className="muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
            {CLASSIFICATION_HELP[cls]}
          </p>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <label className="form-label">Retention period</label>
          <Select value={ret} onChange={(e) => setRet(e.target.value)}>
            <option>90 days</option>
            <option>1 year</option>
            <option>3 years</option>
            <option>Indefinite</option>
          </Select>
          {warn ? (
            <p className="field-error-text" style={{ marginTop: 10, lineHeight: 1.5 }}>
              Indefinite retention of Highly Restricted data typically requires
              additional legal sign-off — confirm this has been obtained.
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function StepIndicator({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels: string[];
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`step-dot ${i === current ? "active" : i < current ? "done" : ""}`}
          />
        ))}
      </div>
      <p className="eyebrow" style={{ marginBottom: 0 }}>
        {labels[current]} — step {current + 1} of {total}
      </p>
    </div>
  );
}
