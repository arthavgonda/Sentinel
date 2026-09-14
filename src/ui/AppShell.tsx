import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  Database,
  Folder,
  Home,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { formatRelative, typeColor } from "../data/mock";
import { useStore } from "../state/store";
import { Button, Modal, TypeDot } from "./primitives";
import { ManualEntryModal } from "../features/ManualEntryModal";
import type { OntologyObject } from "../types";
import { APP_NAME, AUTH_POLICY } from "../config/application";
import { SHORTCUTS, useShortcut } from "../features/graph-ide/shortcuts";

const ICON = { size: 16, strokeWidth: 1.5 };

export function AppShell() {
  const {
    user,
    logout,
    notifications,
    markAllRead,
    markNotification,
    objects,
    canSeeAudit,
    canSteward,
    graphEditorDirty,
    setGraphEditorDirty,
  } = useStore();

  const [q, setQ] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [sessionWarn, setSessionWarn] = useState(false);
  const [expired, setExpired] = useState(false);
  const [countdown, setCountdown] = useState<number>(AUTH_POLICY.sessionCountdownSeconds);
  const [graphNavCompact, setGraphNavCompact] = useState(true);
  const [editorTopbarVisible, setEditorTopbarVisible] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const nav = useNavigate();
  const loc = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;
  const graphWorkspace = loc.pathname.startsWith("/graph");
  const graphEditorWorkspace = loc.pathname === "/graph/editor";
  const searchCurrentlyHidden = graphEditorWorkspace && !editorTopbarVisible;

  useEffect(() => {
    const toggleTopbar = () => setEditorTopbarVisible((value) => !value);
    window.addEventListener("sentinel:toggle-editor-topbar", toggleTopbar);
    return () => window.removeEventListener("sentinel:toggle-editor-topbar", toggleTopbar);
  }, []);

  useShortcut(SHORTCUTS.toggleGlobalSearch.combo, () => {
    if (searchCurrentlyHidden) {
      setEditorTopbarVisible(true);
      window.requestAnimationFrame(() => focusGlobalSearch());
    } else {
      focusGlobalSearch();
    }
  }, { allowInEditableFields: true });

  useEffect(() => {
    const t = window.setTimeout(() => setSessionWarn(true), AUTH_POLICY.sessionWarningMs);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!sessionWarn || expired) return;
    setCountdown(AUTH_POLICY.sessionCountdownSeconds);
    const iv = window.setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          window.clearInterval(iv);
          setExpired(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(iv);
  }, [sessionWarn, expired]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestRef.current &&
        !suggestRef.current.contains(e.target as Node)
      ) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const suggestions = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = q.toLowerCase();
    return objects
      .filter(
        (o) =>
          o.display.toLowerCase().includes(t) ||
          o.id.toLowerCase().includes(t),
      )
      .slice(0, 6);
  }, [q, objects]);

  const mm = String(Math.floor(countdown / 60));
  const ss = String(countdown % 60).padStart(2, "0");

  if (expired) {
    return (
      <div className="auth-wrap">
        <div className="auth-col" style={{ textAlign: "center" }}>
          <p className="wordmark" style={{ fontSize: 22, color: "var(--ink)" }}>
            {APP_NAME}
          </p>
          <h1 className="serif page-title" style={{ margin: "20px 0 16px" }}>
            Your session has expired.
          </h1>
          <Button
            onClick={() => {
              logout();
              nav("/login");
            }}
          >
            Log In Again
          </Button>
        </div>
      </div>
    );
  }

  const showLimitBanner =
    (loc.pathname.startsWith("/graph") ||
      loc.pathname.startsWith("/cases/")) &&
    typeof window !== "undefined" &&
    window.innerWidth < 1024;

  function guardGraphNavigation(event: React.MouseEvent<HTMLElement>) {
    if (!loc.pathname.startsWith("/graph/editor") || !graphEditorDirty) return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.target || anchor.href === window.location.href) return;
    const url = new URL(anchor.href);
    event.preventDefault();
    setPendingNavigation(`${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <div className={`shell ${graphWorkspace && graphNavCompact ? "graph-nav-compact" : ""} ${graphEditorWorkspace && !editorTopbarVisible ? "graph-editor-fullscreen" : ""}`}>
      <header className="topbar no-print">
        <div className="topbar-brand">
          {graphWorkspace ? <button className="graph-nav-toggle" type="button" aria-label={graphNavCompact ? "Expand navigation" : "Minimize navigation"} title={graphNavCompact ? "Expand navigation" : "Minimize navigation"} onClick={() => setGraphNavCompact((value) => !value)}>{graphNavCompact ? <PanelLeftOpen {...ICON} /> : <PanelLeftClose {...ICON} />}</button> : null}
          <Link to="/dashboard" onClick={guardGraphNavigation} className="wordmark" style={{ fontSize: 18, color: "var(--ink)" }}>SENTINEL</Link>
        </div>

        <div className="search-wrap" ref={suggestRef}>
          <div style={{ position: "relative" }}>
            <Search
              {...ICON}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-secondary)",
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchRef}
              id="global-search"
              className="field"
              style={{ paddingLeft: 34, paddingRight: canSteward ? 36 : 12 }}
              placeholder="Search phone, name, organization, address, case…"
              value={q}
              aria-label="Global search"
              autoComplete="off"
              onChange={(e) => {
                setQ(e.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSuggestOpen(false);
                  e.currentTarget.blur();
                }
                if (e.key === "Enter" && q.trim()) {
                  setSuggestOpen(false);
                  nav(`/search?q=${encodeURIComponent(q.trim())}`);
                }
              }}
            />
            {canSteward ? (
              <button
                className="btn btn-icon"
                style={{ position: "absolute", right: 2, top: 2, height: 32 }}
                aria-label="Add object manually"
                title="Add object manually"
                onClick={() => setManualOpen(true)}
              >
                <Plus {...ICON} />
              </button>
            ) : null}
          </div>

          {suggestOpen ? (
            <div className="suggest">
              {q.trim().length < 2 ? (
                <div style={{ padding: "10px 12px" }}>
                  <p className="muted">Type to search</p>
                </div>
              ) : suggestions.length === 0 ? (
                <div style={{ padding: "10px 12px" }}>
                  <p className="muted">No quick matches — try a full search.</p>
                </div>
              ) : (
                suggestions.map((o) => (
                  <button
                    key={o.id}
                    className="suggest-row"
                    onClick={() => {
                      setSuggestOpen(false);
                      setQ("");
                      nav(`/objects/${o.id}`, { state: { from: "search" } });
                    }}
                  >
                    <TypeDot color={typeColor(o.type)} />
                    <span
                      className="grow"
                      style={{ fontSize: 13, fontWeight: 500 }}
                    >
                      {o.display}
                    </span>
                    <span className="muted">{o.type}</span>
                  </button>
                ))
              )}
              {q.trim().length >= 2 ? (
                <button
                  className="suggest-row"
                  style={{ borderTop: "1px solid var(--border)" }}
                  onClick={() => {
                    setSuggestOpen(false);
                    nav(`/search?q=${encodeURIComponent(q.trim())}`);
                  }}
                >
                  Search for '{q}' →
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="topbar-actions">
          <div style={{ position: "relative" }}>
            <button
              className="btn btn-icon"
              aria-label="Notifications"
              title="Notifications"
              onClick={() => {
                setNotifOpen((v) => !v);
                setUserMenuOpen(false);
              }}
            >
              <Bell {...ICON} />
              {unread > 0 ? (
                <span
                  style={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--signal-high)",
                    pointerEvents: "none",
                  }}
                />
              ) : null}
            </button>

            {notifOpen ? (
              <div
                className="popover"
                style={{ right: 0, top: 40, width: 360, maxHeight: 420, overflowY: "auto" }}
              >
                {notifications.length === 0 ? (
                  <div className="empty" style={{ padding: "24px 16px" }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>
                      You're all caught up
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      className="suggest-row"
                      style={{
                        background: n.read ? undefined : "var(--paper)",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                      onClick={() => {
                        markNotification(n.id);
                        setNotifOpen(false);
                        nav(n.href);
                      }}
                    >
                      {!n.read ? (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--accent)",
                            flexShrink: 0,
                            marginTop: 4,
                          }}
                        />
                      ) : (
                        <span style={{ width: 6, flexShrink: 0 }} />
                      )}
                      <span className="grow" style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                          {n.text}
                        </div>
                        <div className="muted" style={{ marginTop: 3 }}>
                          {formatRelative(n.at)}
                        </div>
                      </span>
                    </button>
                  ))
                )}
                <div
                  style={{
                    padding: "8px 12px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <Button variant="link" onClick={markAllRead}>
                    Mark all as read
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--border)",
              flexShrink: 0,
            }}
          />

          <div style={{ position: "relative" }}>
            <button
              className="btn btn-icon"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
              }}
              title={user?.name}
              aria-label={`User menu — ${user?.name}`}
              onClick={() => {
                setUserMenuOpen((v) => !v);
                setNotifOpen(false);
              }}
            >
              {user?.initials}
            </button>

            {userMenuOpen ? (
              <div
                className="popover"
                style={{ right: 0, top: 40, width: 200, padding: 4 }}
              >
                <Link
                  className="suggest-row"
                  to="/settings/profile"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  className="suggest-row"
                  to="/settings/security"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Security
                </Link>
                <div
                  style={{
                    height: 1,
                    background: "var(--border)",
                    margin: "4px 0",
                  }}
                />
                <button
                  className="suggest-row"
                  style={{ color: "var(--signal-high)" }}
                  onClick={() => {
                    setUserMenuOpen(false);
                    setLogoutConfirm(true);
                  }}
                >
                  Log Out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <aside className="nav no-print" aria-label="Main navigation" onClickCapture={guardGraphNavigation}>
        <NavItem to="/dashboard" icon={<Home {...ICON} />} label="Home" />
        <NavItem to="/search" icon={<Search {...ICON} />} label="Search" />
        <NavItem to="/cases" icon={<Folder {...ICON} />} label="Cases" />
        <NavItem
          to="/graph"
          icon={<Network {...ICON} />}
          label="Graph Explorer"
        />
        <NavItem
          to="/data-sources"
          icon={<Database {...ICON} />}
          label="Data Sources"
        />
        {canSeeAudit ? (
          <NavItem
            to="/audit-log"
            icon={<Activity {...ICON} />}
            label="Audit Log"
          />
        ) : null}
        <div className="nav-spacer" />
        <NavItem
          to="/settings/profile"
          icon={<Settings {...ICON} />}
          label="Settings"
        />
      </aside>

      <main className="main" id="main-content">
        {showLimitBanner ? (
          <div className="limit-banner">
            This view works best on a screen at least 1024px wide. Graph
            exploration and case workspace tools may be limited at this size.
          </div>
        ) : null}
        <Outlet />
      </main>

      {logoutConfirm ? (
        <Modal
          title="Log out?"
          onClose={() => setLogoutConfirm(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setLogoutConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  logout();
                  nav("/login");
                }}
              >
                Log Out
              </Button>
            </>
          }
        >
          <p className="muted">
            You'll need to authenticate again, including MFA.
          </p>
        </Modal>
      ) : null}

      {sessionWarn && !expired ? (
        <Modal
          title="Your session is about to expire"
          onClose={() => setSessionWarn(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setSessionWarn(false);
                  setExpired(true);
                }}
              >
                Log Out Now
              </Button>
              <Button onClick={() => setSessionWarn(false)}>
                Stay Logged In
              </Button>
            </>
          }
        >
          <p>You'll be logged out in {mm}:{ss}.</p>
        </Modal>
      ) : null}

      {manualOpen ? (
        <ManualEntryModal onClose={() => setManualOpen(false)} />
      ) : null}

      {pendingNavigation ? (
        <Modal
          title="Save graph changes before leaving?"
          onClose={() => setPendingNavigation(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setPendingNavigation(null)}>Cancel</Button>
            <Button variant="secondary" onClick={() => { window.dispatchEvent(new Event("sentinel:discard-graph-editor-changes")); setGraphEditorDirty(false); nav(pendingNavigation); setPendingNavigation(null); }}>Discard changes</Button>
            <Button onClick={() => { setGraphEditorDirty(false); nav(pendingNavigation); setPendingNavigation(null); }}>Save changes</Button>
          </>}
        >
          <p className="muted">The active graph has unsaved manual edits. Save keeps them in the current case; discard restores the version from when you opened the editor.</p>
        </Modal>
      ) : null}
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
      title={label}
      aria-label={label}
    >
      {icon}
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

export function focusGlobalSearch() {
  const el = document.getElementById("global-search");
  if (el) {
    el.focus();
    (el as HTMLInputElement).select();
  }
}

export type SearchHit = OntologyObject;