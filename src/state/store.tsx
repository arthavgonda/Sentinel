import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  AGENCIES,
  AUDIT,
  CASES,
  DATA_SOURCES,
  ER_MATCHES,
  LINKS,
  NOTES,
  NOTIFICATIONS,
  OBJECTS,
  SIGNALS,
  USERS,
} from "../data/mock";
import type {
  AuditEntry,
  CaseRecord,
  CaseStatus,
  DataSource,
  ErMatch,
  HistoryEntry,
  Link,
  Note,
  NotificationItem,
  OntologyObject,
  Role,
  User,
} from "../types";
import { AUTH_POLICY, CASE_POLICY } from "../config/application";

const NOTE_DRAFT_KEY = "sentinel.noteDraft";
const HISTORY_KEY = "sentinel.personalHistory.v1";

export type GraphExplorerState = {
  originId: string | null;
  hops: number;
  selectedId: string | null;
  showLabels: boolean;
  detailMode: "all" | "focused";
  layoutVersion: number;
  transform: { x: number; y: number; k: number };
};

type Store = {
  user: User | null;
  users: User[];
  objects: OntologyObject[];
  links: Link[];
  cases: CaseRecord[];
  notes: Note[];
  signals: typeof SIGNALS;
  notifications: NotificationItem[];
  erMatches: ErMatch[];
  sources: DataSource[];
  agencies: typeof AGENCIES;
  audit: AuditEntry[];
  history: HistoryEntry[];
  graphEditorDirty: boolean;
  setGraphEditorDirty: (dirty: boolean) => void;
  graphExplorer: GraphExplorerState;
  setGraphExplorer: (state: GraphExplorerState) => void;
  login: (email: string, password: string) => "ok" | "invalid" | "locked";
  completeMfa: (code: string) => "ok" | "incorrect" | "expired";
  logout: () => void;
  markAllRead: () => void;
  markNotification: (id: string) => void;
  createCase: (title: string, leadId: string, firstObjectId?: string) => CaseRecord;
  addObjectToCase: (caseId: string, objectId: string) => void;
  removeObjectFromCase: (caseId: string, objectId: string) => void;
  setCaseGraphLayout: (caseId: string, layout: Record<string, { x: number; y: number }>) => void;
  restoreCaseGraph: (caseId: string, objectIds: string[], layout: Record<string, { x: number; y: number }>, relationSnapshot: Link[]) => void;
  renameCase: (caseId: string, title: string) => void;
  setCaseStatus: (caseId: string, status: CaseStatus) => void;
  proposeEscalation: (caseId: string, agencyId: string) => void;
  resolveEscalation: (caseId: string, approve: boolean, reason?: string) => void;
  postNote: (caseId: string, body: string) => void;
  saveNoteDraft: (caseId: string, body: string) => void;
  consumeNoteDraft: (caseId: string) => string | null;
  resolveMatch: (id: string, merge: boolean) => "ok" | "gone";
  addSource: (source: DataSource) => void;
  addObject: (object: OntologyObject) => void;
  updateObject: (id: string, patch: Partial<Pick<OntologyObject, "display" | "properties">>) => void;
  mergeCases: (sourceCaseId: string, targetCaseId: string) => void;
  deleteLink: (id: string) => void;
  addLink: (link: Omit<Link, "id">) => void;
  addAudit: (entry: Omit<AuditEntry, "id">) => void;
  canSeeAudit: boolean;
  canSteward: boolean;
};

const StoreContext = createContext<Store | null>(null);

const FAIL_KEY = "sentinel.loginFails";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [objects, setObjects] = useState(OBJECTS);
  const [links, setLinks] = useState(LINKS);
  const [cases, setCases] = useState(CASES);
  const [notes, setNotes] = useState(NOTES);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [erMatches, setErMatches] = useState(ER_MATCHES);
  const [sources, setSources] = useState(DATA_SOURCES);
  const [audit, setAudit] = useState(AUDIT);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) as HistoryEntry[] : [];
    } catch {
      return [];
    }
  });
  const [graphEditorDirty, setGraphEditorDirty] = useState(false);
  const [graphExplorer, setGraphExplorer] = useState<GraphExplorerState>({
    originId: null,
    hops: 1,
    selectedId: null,
    showLabels: true,
    detailMode: "all",
    layoutVersion: 0,
    transform: { x: 0, y: 0, k: 1 },
  });

  function recordHistory(action: HistoryEntry["action"], subject: string, detail: string) {
    if (!user) return;
    const entry: HistoryEntry = { id: `h-${crypto.randomUUID()}`, actorId: user.id, actorName: user.name, action, subject, detail, timestamp: new Date().toISOString() };
    setHistory((items) => {
      const next = [entry, ...items];
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { }
      return next;
    });
  }

  const value = useMemo<Store>(() => {
    const role: Role | undefined = user?.role;
    return {
      user,
      users: USERS,
      objects,
      links,
      cases,
      notes,
      signals: SIGNALS,
      notifications,
      erMatches,
      sources,
      agencies: AGENCIES,
      audit,
      history,
      graphEditorDirty,
      setGraphEditorDirty,
      graphExplorer,
      setGraphExplorer,
      canSeeAudit: role === "auditor" || role === "admin",
      canSteward: role === "steward" || role === "admin",
      login(email, password) {
        const fails = Number(sessionStorage.getItem(FAIL_KEY) || "0");
        if (fails >= AUTH_POLICY.maxFailedAttempts) return "locked";
        const found = USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!found || password.length < AUTH_POLICY.minimumPasswordLength) {
          sessionStorage.setItem(FAIL_KEY, String(fails + 1));
          return "invalid";
        }
        sessionStorage.setItem(FAIL_KEY, "0");
        sessionStorage.setItem("sentinel.pendingUser", found.id);
        return "ok";
      },
      completeMfa(code) {
        if (code === AUTH_POLICY.mfaExpiredCode) return "expired";
        if (code.length !== AUTH_POLICY.mfaCodeLength) return "incorrect";
        const id = sessionStorage.getItem("sentinel.pendingUser");
        const found = USERS.find((u) => u.id === id);
        if (!found) return "incorrect";
        sessionStorage.removeItem("sentinel.pendingUser");
        setUser(found);
        return "ok";
      },
      logout() {
        setUser(null);
      },
      markAllRead() {
        setNotifications((n) => n.map((x) => ({ ...x, read: true })));
      },
      markNotification(id) {
        setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
      },
      createCase(title, leadId, firstObjectId) {
        const rec: CaseRecord = {
          id: `c-${crypto.randomUUID()}`,
          number: String(CASE_POLICY.numberStart + cases.length),
          title,
          status: "Open",
          leadId,
          assignedIds: [leadId],
          objectIds: firstObjectId ? [firstObjectId] : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCases((c) => [rec, ...c]);
        recordHistory("Created", `Case #${rec.number}`, `Created case “${title}”.`);
        return rec;
      },
      addObjectToCase(caseId, objectId) {
        setCases((c) =>
          c.map((x) =>
            x.id === caseId && !x.objectIds.includes(objectId)
              ? { ...x, objectIds: [...x.objectIds, objectId], updatedAt: new Date().toISOString() }
              : x,
          ),
        );
        const item = objects.find((object) => object.id === objectId);
        const target = cases.find((record) => record.id === caseId);
        recordHistory("Added", target ? `Case #${target.number}` : caseId, `Added ${item?.display ?? objectId} to the case.`);
      },
      removeObjectFromCase(caseId, objectId) {
        setCases((c) =>
          c.map((x) =>
            x.id === caseId
              ? { ...x, objectIds: x.objectIds.filter((id) => id !== objectId), updatedAt: new Date().toISOString() }
              : x,
          ),
        );
        const item = objects.find((object) => object.id === objectId);
        const target = cases.find((record) => record.id === caseId);
        recordHistory("Removed", target ? `Case #${target.number}` : caseId, `Removed ${item?.display ?? objectId} from the case.`);
      },
      setCaseGraphLayout(caseId, layout) {
        setCases((items) => items.map((item) => item.id === caseId ? { ...item, graphLayout: layout, updatedAt: new Date().toISOString() } : item));
      },
      restoreCaseGraph(caseId, objectIds, graphLayout, relationSnapshot) {
        const current = cases.find((item) => item.id === caseId);
        const scope = new Set([...(current?.objectIds ?? []), ...objectIds]);
        const snapshotIds = new Set(relationSnapshot.map((item) => item.id));
        setCases((items) => items.map((item) => item.id === caseId ? { ...item, objectIds, graphLayout, updatedAt: new Date().toISOString() } : item));
        setLinks((items) => [
          ...relationSnapshot,
          ...items.filter((item) => {
            const inScope = scope.has(item.from) && scope.has(item.to);
            return !snapshotIds.has(item.id) && !(inScope && item.sourceId === "manual-editor");
          }),
        ]);
        const target = cases.find((record) => record.id === caseId);
        recordHistory("Reverted", target ? `Case #${target.number}` : caseId, "Reverted unsaved graph changes.");
      },
      renameCase(caseId, title) {
        setCases((c) => c.map((x) => (x.id === caseId ? { ...x, title, updatedAt: new Date().toISOString() } : x)));
        recordHistory("Updated", caseId, `Renamed case to “${title}”.`);
      },
      setCaseStatus(caseId, status) {
        setCases((c) => c.map((x) => (x.id === caseId ? { ...x, status, updatedAt: new Date().toISOString() } : x)));
        recordHistory("Updated", caseId, `Changed case status to ${status}.`);
      },
      proposeEscalation(caseId, agencyId) {
        if (!user) return;
        setCases((c) =>
          c.map((x) =>
            x.id === caseId
              ? {
                  ...x,
                  status: "Under Review",
                  escalation: { agencyId, proposedBy: user.id, pending: true },
                  updatedAt: new Date().toISOString(),
                }
              : x,
          ),
        );
        recordHistory("Updated", caseId, `Proposed an escalation to ${agencyId}.`);
      },
      resolveEscalation(caseId, approve, reason) {
        setCases((c) =>
          c.map((x) => {
            if (x.id !== caseId) return x;
            if (approve) {
              return { ...x, status: "Escalated", escalation: undefined, updatedAt: new Date().toISOString() };
            }
            return {
              ...x,
              status: "Under Review",
              escalation: undefined,
              updatedAt: new Date().toISOString(),
            };
          }),
        );
        if (!approve && reason) {
          setNotes((n) => [
            {
              id: `n-${crypto.randomUUID()}`,
              caseId,
              authorId: user?.id ?? "u3",
              body: `Escalation denied: ${reason}`,
              createdAt: new Date().toISOString(),
            },
            ...n,
          ]);
        }
        recordHistory("Updated", caseId, approve ? "Approved a case escalation." : "Resolved an escalation without approval.");
      },
      postNote(caseId, body) {
        if (!user) return;
        setNotes((n) => [
          { id: `n-${crypto.randomUUID()}`, caseId, authorId: user.id, body, createdAt: new Date().toISOString() },
          ...n,
        ]);
        localStorage.removeItem(`${NOTE_DRAFT_KEY}.${caseId}`);
        recordHistory("Created", caseId, "Added a case note.");
      },
      saveNoteDraft(caseId, body) {
        localStorage.setItem(`${NOTE_DRAFT_KEY}.${caseId}`, body);
      },
      consumeNoteDraft(caseId) {
        const key = `${NOTE_DRAFT_KEY}.${caseId}`;
        const v = localStorage.getItem(key);
        return v;
      },
      resolveMatch(id, merge) {
        const match = erMatches.find((item) => item.id === id);
        if (!match) return "gone";
        setErMatches((m) => m.filter((x) => x.id !== id));
        recordHistory(merge ? "Merged" : "Removed", "Entity resolution", merge ? `Merged the proposed match between ${match.left.display} and ${match.right.display}.` : `Kept ${match.left.display} and ${match.right.display} separate.`);
        return "ok";
      },
      addSource(source) {
        setSources((s) => [source, ...s]);
        recordHistory("Created", "Data source", `Added data source “${source.name}”.`);
      },
      addObject(object) {
        setObjects((o) => [object, ...o]);
        recordHistory("Created", object.type, `Added ${object.type.toLowerCase()} “${object.display}”.`);
      },
      updateObject(id, patch) {
        const current = objects.find((item) => item.id === id);
        setObjects((o) => o.map((item) => (item.id === id ? { ...item, ...patch } : item)));
        if (current) {
          recordHistory("Updated", current.type, `Renamed ${current.type.toLowerCase()} “${current.display}” to “${patch.display ?? current.display}”.`);
        }
      },
      mergeCases(sourceCaseId, targetCaseId) {
        const source = cases.find((item) => item.id === sourceCaseId);
        if (!source || sourceCaseId === targetCaseId) return;
        setCases((items) => items.map((item) => item.id === targetCaseId ? { ...item, objectIds: [...new Set([...item.objectIds, ...source.objectIds])], updatedAt: new Date().toISOString() } : item));
        const target = cases.find((item) => item.id === targetCaseId);
        recordHistory("Merged", target ? `Case #${target.number}` : targetCaseId, `Merged entities from “${source.title}”.`);
      },
      deleteLink(id) {
        setLinks((items) => items.filter((item) => item.id !== id));
        const link = links.find((item) => item.id === id);
        recordHistory("Deleted", "Relationship", link ? `Deleted ${link.type.replace(/_/g, " ")} relationship.` : "Deleted a relationship.");
      },
      addLink(link) {
        setLinks((items) => [{ ...link, id: `l-${crypto.randomUUID()}` }, ...items]);
        recordHistory("Created", "Relationship", `Created ${link.type.replace(/_/g, " ")} relationship.`);
      },
      addAudit(entry) {
        setAudit((a) => [{ ...entry, id: `au-${crypto.randomUUID()}` }, ...a]);
      },
    };
  }, [user, objects, links, cases, notes, notifications, erMatches, sources, audit, history, graphEditorDirty, graphExplorer]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("Store missing");
  return ctx;
}