import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useStore } from "../state/store";
import { Button, Input } from "../ui/primitives";

export function SettingsLayout() {
  return (
    <div>
      <h1 className="serif page-title">Settings</h1>
      <div className="tabs" style={{ marginTop: 16 }}>
        <NavLink
          to="/settings/profile"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Profile
        </NavLink>
        <NavLink
          to="/settings/security"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Security
        </NavLink>
        <NavLink
          to="/settings/notifications"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Notification Preferences
        </NavLink>
        <NavLink
          to="/settings/workspace"
          className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
        >
          Workspace
        </NavLink>
        <NavLink to="/settings/accessibility" className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>Accessibility</NavLink>
        <NavLink to="/settings/data-privacy" className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>Data & Privacy</NavLink>
        <NavLink to="/settings/history" className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>My History</NavLink>
      </div>
      <div style={{ paddingTop: 20, maxWidth: 560 }}>
        <Outlet />
      </div>
    </div>
  );
}

export function PersonalHistorySettings() {
  const { history, user } = useStore();
  const entries = history.filter((entry) => entry.actorId === user?.id);
  return <div className="settings-stack">
    <SettingsSection title="My immutable activity history" summary="A private, timestamped record of your Sentinel changes.">
      <p className="muted" style={{ marginBottom: 16 }}>Only you can view these entries. History is append-only and has no edit or delete controls.</p>
      {entries.length ? <div className="history-list">{entries.map((entry) => <article className="history-entry" key={entry.id}><div><strong>{entry.action} · {entry.subject}</strong><p>{entry.detail}</p></div><time dateTime={entry.timestamp}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(entry.timestamp))}</time></article>)}</div> : <p className="muted">Your activity history will appear here when you make a change.</p>}
    </SettingsSection>
  </div>;
}

function SettingsSection({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="settings-section">
      <button className="settings-section-trigger" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span><strong>{title}</strong><small>{summary}</small></span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="settings-section-content">{children}</div> : null}
    </section>
  );
}

export function ProfileSettings() {
  const { user } = useStore();
  const [name, setName] = useState(user?.name ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div className="settings-stack">
      <SettingsSection title="Personal details" summary="Name, job title, and account identity.">
      <label className="form-label" htmlFor="profile-name">
        Name
      </label>
      <Input
        id="profile-name"
        value={name}
        onChange={(e) => { setName(e.target.value); setSaved(false); }}
      />

      <div style={{ height: 12 }} />

      <label className="form-label" htmlFor="profile-title">Job title</label>
      <Input id="profile-title" placeholder="e.g. Senior analyst" />

      <div style={{ height: 12 }} />

      <div style={{ height: 16 }} />

      <Button
        onClick={() => setSaved(true)}
        disabled={!name.trim() || name === user?.name}
      >
        Save Changes
      </Button>
      {saved ? (
        <span className="muted" style={{ marginLeft: 12, fontSize: 12 }}>
          Saved.
        </span>
      ) : null}
      </SettingsSection>
      <SettingsSection title="Account contact" summary="Your verified account email and role.">
        <label className="form-label">Email</label>
        <Input defaultValue={user?.email} disabled style={{ color: "var(--ink-secondary)" }} />
        <div style={{ height: 12 }} />
        <label className="form-label">Role</label>
        <Input defaultValue={user?.role} disabled style={{ color: "var(--ink-secondary)", textTransform: "capitalize" }} />
      </SettingsSection>
    </div>
  );
}

export function SecuritySettings() {
  const [sessions, setSessions] = useState([
    { id: "s1", label: "This browser · Current session", current: true },
    { id: "s2", label: "Chrome · Office workstation", current: false },
    { id: "s3", label: "Firefox · Home laptop", current: false },
  ]);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [err, setErr] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  function handlePwChange() {
    if (pw.next.length < 12 || !/\d/.test(pw.next) || !/[^\w\s]/.test(pw.next)) {
      setErr("Password must be at least 12 characters and include a number and a symbol.");
      return;
    }
    if (pw.next === pw.current) {
      setErr("Your new password must be different from your current password.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setErr("Passwords don't match.");
      return;
    }
    setErr("");
    setPw({ current: "", next: "", confirm: "" });
    setPwSaved(true);
  }

  return (
    <div>
      <SettingsSection title="Password" summary="Change your password using the current-password check.">
        <p className="eyebrow" style={{ marginBottom: 16 }}>
          Password
        </p>
        <label className="form-label" htmlFor="pw-current">
          Current password
        </label>
        <Input
          id="pw-current"
          type="password"
          value={pw.current}
          autoComplete="current-password"
          onChange={(e) => { setPw({ ...pw, current: e.target.value }); setErr(""); }}
        />
        <div style={{ height: 10 }} />
        <label className="form-label" htmlFor="pw-new">
          New password
        </label>
        <Input
          id="pw-new"
          type="password"
          value={pw.next}
          autoComplete="new-password"
          onChange={(e) => { setPw({ ...pw, next: e.target.value }); setErr(""); }}
        />
        <div style={{ height: 10 }} />
        <label className="form-label" htmlFor="pw-confirm">
          Confirm new password
        </label>
        <Input
          id="pw-confirm"
          type="password"
          value={pw.confirm}
          autoComplete="new-password"
          onChange={(e) => { setPw({ ...pw, confirm: e.target.value }); setErr(""); }}
        />
        {err ? <p className="field-error-text">{err}</p> : null}
        {pwSaved ? (
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Password updated.
          </p>
        ) : null}
        <Button style={{ marginTop: 14 }} onClick={handlePwChange}>
          Update password
        </Button>
      </SettingsSection>

      <SettingsSection title="Multi-factor authentication" summary="Authenticator app and recovery-code controls.">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Multi-factor authentication</p>
        <div className="list-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <span className="grow"><strong>Authenticator app</strong><br /><span className="muted">Required for this account</span></span>
          <Button variant="secondary" style={{ fontSize: 12 }}>Reconfigure</Button>
        </div>
        <div className="list-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <span className="grow"><strong>Recovery codes</strong><br /><span className="muted">Use only when your authenticator is unavailable</span></span>
          <Button variant="secondary" style={{ fontSize: 12 }}>Generate</Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Active sessions" summary="Review and revoke signed-in devices.">
        <p className="eyebrow" style={{ marginBottom: 12 }}>
          Active Sessions
        </p>
        {sessions.map((s) => (
          <div key={s.id} className="list-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <span className="grow" style={{ fontSize: 13 }}>
              {s.label}
              {s.current ? (
                <span className="muted"> (this session)</span>
              ) : null}
            </span>
            {!s.current ? (
              <Button
                variant="link"
                style={{ color: "var(--signal-high)", fontSize: 12 }}
                onClick={() => setSessions((x) => x.filter((i) => i.id !== s.id))}
              >
                Revoke
              </Button>
            ) : null}
          </div>
        ))}
      </SettingsSection>
    </div>
  );
}

export function NotificationSettings() {
  const [prefs, setPrefs] = useState({
    case_activity: true,
    er_queue: true,
    escalations: true,
    email_digest: false,
  });

  const PREF_LABELS: Array<[keyof typeof prefs, string]> = [
    ["case_activity", "Case activity (notes, objects added)"],
    ["er_queue", "Entity-resolution queue updates"],
    ["escalations", "Escalation proposals and approvals"],
    ["email_digest", "Hourly email digest"],
  ];

  return (
    <SettingsSection title="Delivery preferences" summary="Choose which investigation events reach you.">
      <p className="eyebrow" style={{ marginBottom: 12 }}>
        In-app notifications
      </p>
      {PREF_LABELS.map(([k, label]) => (
        <div
          key={k}
          className="list-row"
          style={{ paddingLeft: 0, paddingRight: 0 }}
        >
          <span className="grow" style={{ fontSize: 13 }}>
            {label}
          </span>
          <button
            className={`switch ${prefs[k] ? "on" : ""}`}
            role="switch"
            aria-checked={prefs[k]}
            aria-label={label}
            onClick={() => setPrefs((p) => ({ ...p, [k]: !p[k] }))}
          />
        </div>
      ))}
    </SettingsSection>
  );
}

export function WorkspaceSettings() {
  const [prefs, setPrefs] = useState({ compact: false, evidence: true, graphLabels: true, reducedMotion: false });
  const options: Array<[keyof typeof prefs, string, string]> = [
    ["compact", "Compact data tables", "Show more records with denser row spacing."],
    ["evidence", "Open relationship evidence automatically", "Show the evidence inspector whenever an edge is selected."],
    ["graphLabels", "Show graph labels by default", "Display entity names when the graph opens."],
    ["reducedMotion", "Reduce motion", "Minimize nonessential interface animations."],
  ];
  return (
    <SettingsSection title="Workspace preferences" summary="Configure your personal working environment.">
      <p className="eyebrow" style={{ marginBottom: 4 }}>Workspace preferences</p>
      <p className="muted" style={{ marginBottom: 12 }}>These preferences affect only your current workspace.</p>
      {options.map(([key, title, detail]) => (
        <div key={key} className="list-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <span className="grow"><strong>{title}</strong><br /><span className="muted">{detail}</span></span>
          <button className={`switch ${prefs[key] ? "on" : ""}`} role="switch" aria-checked={prefs[key]} aria-label={title} onClick={() => setPrefs((value) => ({ ...value, [key]: !value[key] }))} />
        </div>
      ))}
    </SettingsSection>
  );
}

export function AccessibilitySettings() {
  const [prefs, setPrefs] = useState({ contrast: false, largeText: false, reducedMotion: false, keyboardHints: true });
  const options: Array<[keyof typeof prefs, string, string]> = [
    ["contrast", "Higher contrast", "Increase separation between controls, text, and surfaces."],
    ["largeText", "Larger interface text", "Increase the base reading size in this workspace."],
    ["reducedMotion", "Reduce motion", "Avoid nonessential transitions and animation."],
    ["keyboardHints", "Keyboard shortcuts", "Show shortcut hints in supported tools."],
  ];
  return <SettingsSection title="Accessibility preferences" summary="Visual, motion, and keyboard options.">{options.map(([key, title, detail]) => <div key={key} className="list-row" style={{ paddingLeft: 0, paddingRight: 0 }}><span className="grow"><strong>{title}</strong><br /><span className="muted">{detail}</span></span><button className={`switch ${prefs[key] ? "on" : ""}`} role="switch" aria-checked={prefs[key]} aria-label={title} onClick={() => setPrefs((value) => ({ ...value, [key]: !value[key] }))} /></div>)}</SettingsSection>;
}

export function DataPrivacySettings() {
  const [exportOpen, setExportOpen] = useState(false);
  return <div className="settings-stack">
    <SettingsSection title="Data handling" summary="Control local workspace storage and sensitive-data display.">
      <div className="list-row" style={{ paddingLeft: 0, paddingRight: 0 }}><span className="grow"><strong>Clear local drafts</strong><br /><span className="muted">Remove unsent case-note drafts stored on this device.</span></span><Button variant="secondary" style={{ fontSize: 12 }}>Clear drafts</Button></div>
      <div className="list-row" style={{ paddingLeft: 0, paddingRight: 0 }}><span className="grow"><strong>Mask sensitive identifiers</strong><br /><span className="muted">Hide full phone numbers and direct identifiers until revealed.</span></span><button className="switch" role="switch" aria-checked={false} aria-label="Mask sensitive identifiers" /></div>
    </SettingsSection>
    <SettingsSection title="Account data export" summary="Request a copy of your account preferences and activity metadata.">
      <Button variant="secondary" onClick={() => setExportOpen(true)}>Request export</Button>
      {exportOpen ? <p className="muted" style={{ marginTop: 12 }}>Your export request has been recorded. You will be notified when it is ready.</p> : null}
    </SettingsSection>
  </div>;
}
