import type {
  ActivityItem,
  Agency,
  AuditEntry,
  CaseRecord,
  DataSource,
  EvidenceAsset,
  ErMatch,
  Link,
  Note,
  NotificationItem,
  OntologyObject,
  ProvenanceRow,
  Signal,
  User,
} from "../types";
import { OBJECT_TYPE_COLORS } from "../config/application";

export const USERS: User[] = [
  { id: "u1", name: "Maya Rao", email: "maya@sentinel.local", initials: "MR", role: "analyst" },
  { id: "u2", name: "Priya Shah", email: "priya@sentinel.local", initials: "PS", role: "steward" },
  { id: "u3", name: "Devraj Mehta", email: "devraj@sentinel.local", initials: "DM", role: "case_lead" },
  { id: "u4", name: "Farah Khan", email: "farah@sentinel.local", initials: "FK", role: "auditor" },
  { id: "u5", name: "Admin", email: "admin@sentinel.local", initials: "AD", role: "admin" },
];

export const OBJECTS: OntologyObject[] = [
  {
    id: "ph-182",
    type: "Phone",
    display: "+91 22 4188 2901",
    firstSeen: "2026-07-28",
    linkedCount: 3,
    properties: { Number: "+91 22 4188 2901", Carrier: "Airtel", "First seen": "28 Jul 2026" },
  },
  {
    id: "p-ramesh",
    type: "Person",
    display: "Ramesh K.",
    firstSeen: "2026-07-28",
    linkedCount: 5,
    properties: { Name: "Ramesh K.", Aliases: "R. Kumar", "Dates observed": "Jul 2026 – Sep 2026" },
  },
  {
    id: "p-joaquim",
    type: "Person",
    display: "Joaquim Fernandes",
    firstSeen: "2026-06-12",
    linkedCount: 4,
    properties: { Name: "Joaquim Fernandes", Aliases: "J. Fernandes", City: "Mumbai" },
  },
  {
    id: "p-ananya",
    type: "Person",
    display: "Ananya Desai",
    firstSeen: "2026-08-02",
    linkedCount: 2,
    properties: { Name: "Ananya Desai", City: "Pune" },
  },
  {
    id: "org-horizon",
    type: "Organization",
    display: "Horizon Staffing Pvt Ltd",
    firstSeen: "2026-05-04",
    linkedCount: 6,
    properties: {
      Name: "Horizon Staffing Pvt Ltd",
      Address: "Andheri East, Mumbai",
      Sector: "Recruitment",
      "Registration ID": "U74999MH2018PTC312441",
    },
  },
  {
    id: "loc-andheri",
    type: "Location",
    display: "Andheri East, Mumbai",
    firstSeen: "2026-05-04",
    linkedCount: 3,
    properties: { Address: "Andheri East, Mumbai", Type: "registered office" },
  },
  {
    id: "job-warehouse",
    type: "JobListing",
    display: "Warehouse helper — immediate join",
    firstSeen: "2026-08-19",
    linkedCount: 3,
    properties: {
      Title: "Warehouse helper — immediate join",
      Organization: "Horizon Staffing Pvt Ltd",
      Phone: "+91 22 4188 2901",
      Location: "Mumbai",
    },
  },
  {
    id: "doc-27",
    type: "Document",
    display: "Business Registry #27",
    firstSeen: "2026-05-04",
    linkedCount: 2,
    properties: { Title: "Business Registry extract", Source: "Regional Business Registry", Date: "4 May 2026" },
  },
  {
    id: "p-second",
    type: "Person",
    display: "Ramesh Kumar",
    firstSeen: "2026-08-21",
    linkedCount: 2,
    properties: { Name: "Ramesh Kumar", City: "Mumbai" },
  },
];

export const LINKS: Link[] = [
  {
    id: "l1",
    from: "p-ramesh",
    to: "ph-182",
    type: "uses",
    confidence: 96,
    method: "deterministic",
    sourceId: "src-phone",
    sourceLabel: "Phone Records",
    observed: "28 Jul 2026",
    matchedAttributes: ["Exact phone number against carrier record"],
  },
  {
    id: "l2",
    from: "p-second",
    to: "ph-182",
    type: "uses",
    confidence: 61,
    method: "probabilistic",
    sourceId: "doc-27",
    sourceLabel: "Documents (DOC-441)",
    observed: "21 Aug 2026",
    matchedAttributes: ["Phonetic name similarity", "Partial phone-number match"],
  },
  {
    id: "l3",
    from: "job-warehouse",
    to: "ph-182",
    type: "lists",
    confidence: 88,
    method: "deterministic",
    sourceId: "src-jobs",
    sourceLabel: "Job listings feed",
    observed: "19 Aug 2026",
    matchedAttributes: ["Phone extracted from listing text"],
  },
  {
    id: "l4",
    from: "p-ramesh",
    to: "org-horizon",
    type: "associated_with",
    confidence: 84,
    method: "probabilistic",
    sourceId: "src-jobs",
    sourceLabel: "Job listings feed",
    observed: "19 Aug 2026",
    matchedAttributes: ["Name on listing", "Shared phone"],
  },
  {
    id: "l5",
    from: "org-horizon",
    to: "loc-andheri",
    type: "registered_at",
    confidence: 100,
    method: "deterministic",
    sourceId: "src-registry",
    sourceLabel: "Business Registry #27",
    observed: "4 May 2026",
    matchedAttributes: ["Registered address", "Registration identifier"],
  },
  {
    id: "l6",
    from: "job-warehouse",
    to: "org-horizon",
    type: "posted_by",
    confidence: 92,
    method: "deterministic",
    sourceId: "src-jobs",
    sourceLabel: "Job listings feed",
    observed: "19 Aug 2026",
    matchedAttributes: ["Organization name on listing"],
  },
  {
    id: "l7",
    from: "p-joaquim",
    to: "org-horizon",
    type: "associated_with",
    confidence: 73,
    method: "probabilistic",
    sourceId: "src-jobs",
    sourceLabel: "Job listings feed",
    observed: "12 Jun 2026",
    matchedAttributes: ["Name similarity", "Same city"],
  },
];

export const CASES: CaseRecord[] = [
  {
    id: "c-1042",
    number: "1042",
    title: "Mumbai recruitment network",
    status: "Under Review",
    leadId: "u3",
    assignedIds: ["u1", "u3"],
    objectIds: [
      "ph-182",
      "p-ramesh",
      "p-second",
      "org-horizon",
      "loc-andheri",
      "job-warehouse",
      "doc-27",
      "p-joaquim",
    ],
    createdAt: "2026-09-04T09:12:00Z",
    updatedAt: "2026-09-11T16:40:00Z",
    escalation: { agencyId: "ag-1", proposedBy: "u1", pending: true },
  },
  {
    id: "c-1038",
    number: "1038",
    title: "Pune lodging cluster",
    status: "Open",
    leadId: "u1",
    assignedIds: ["u1"],
    objectIds: ["p-ananya", "loc-andheri"],
    createdAt: "2026-08-22T11:00:00Z",
    updatedAt: "2026-09-10T08:15:00Z",
  },
  {
    id: "c-1021",
    number: "1021",
    title: "Registry mismatch review",
    status: "Closed",
    leadId: "u3",
    assignedIds: ["u3", "u2"],
    objectIds: ["org-horizon", "doc-27"],
    createdAt: "2026-07-02T10:00:00Z",
    updatedAt: "2026-08-01T14:22:00Z",
  },
  {
    id: "c-1040",
    number: "1040",
    title: "Shared-phone follow-up",
    status: "Open",
    leadId: "u1",
    assignedIds: ["u1"],
    objectIds: ["ph-182", "p-ramesh"],
    createdAt: "2026-09-08T07:30:00Z",
    updatedAt: "2026-09-11T09:02:00Z",
  },
  {
    id: "c-0998",
    number: "0998",
    title: "Coastal listings sweep",
    status: "Escalated",
    leadId: "u3",
    assignedIds: ["u1", "u3"],
    objectIds: ["job-warehouse", "org-horizon"],
    createdAt: "2026-06-18T09:00:00Z",
    updatedAt: "2026-09-01T12:00:00Z",
  },
];

export const NOTES: Note[] = [
  {
    id: "n1",
    caseId: "c-1042",
    authorId: "u1",
    createdAt: "2026-09-11T10:18:00Z",
    body: "Started from hotline tip. Phone number already had a six-week footprint via phone records and a document. Two people linked to the same number at different confidence — see graph. Organization reachable via two independent paths, worth prioritizing.",
  },
  {
    id: "n2",
    caseId: "c-1042",
    authorId: "u3",
    createdAt: "2026-09-12T07:40:00Z",
    body: "Reviewed object set and signals. Shared-phone pattern plus dual path to Horizon Staffing is enough to propose escalation to the Mumbai Anti-Trafficking Unit.",
  },
];

export const SIGNALS: Signal[] = [
  { id: "s1", caseId: "c-1042", label: "Shared phone number", points: 3, objectIds: ["p-ramesh", "p-second", "ph-182"] },
  { id: "s2", caseId: "c-1042", label: "Closed-loop organization path", points: 3, objectIds: ["p-ramesh", "job-warehouse", "org-horizon"] },
  { id: "s3", caseId: "c-1042", label: "Repeated listing language", points: 2, objectIds: ["job-warehouse"] },
  { id: "s4", caseId: "c-1042", label: "Recent first-seen cluster", points: 1, objectIds: ["ph-182", "job-warehouse"] },
];

export const ACTIVITY: ActivityItem[] = [
  { id: "a1", text: "New document references Person: Ramesh K.", objectType: "Person", at: "2026-09-11T16:12:00Z", href: "/objects/p-ramesh" },
  { id: "a2", text: "Analyst added a note to Case #1042", objectType: "Case", at: "2026-09-11T10:18:00Z", href: "/cases/c-1042/notes" },
  { id: "a3", text: "Job listing linked to Phone +91 22 4188 2901", objectType: "Phone", at: "2026-09-10T14:02:00Z", href: "/objects/ph-182" },
  { id: "a4", text: "Escalation proposed on Case #1042", objectType: "Case", at: "2026-09-12T04:50:00Z", href: "/cases/c-1042" },
];

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "nt1",
    text: "Escalation proposed on Case #1042 — Mumbai recruitment network",
    at: "2026-09-12T04:50:00Z",
    href: "/cases/c-1042",
    read: false,
  },
  {
    id: "nt2",
    text: "2 matches awaiting entity-resolution review",
    at: "2026-09-12T02:10:00Z",
    href: "/entity-resolution/review",
    read: false,
  },
  {
    id: "nt3",
    text: "New evidence attached to Case #1038",
    at: "2026-09-11T18:22:00Z",
    href: "/cases/c-1038/evidence",
    read: true,
  },
];

export const ER_MATCHES: ErMatch[] = [
  {
    id: "er1",
    confidence: 91,
    left: {
      id: "p-jf-partial",
      type: "Person",
      display: "J. Fernandes",
      linkedCount: 2,
      properties: { Name: "J. Fernandes", Phone: "+91 22 4188", City: "Mumbai" },
    },
    right: {
      id: "p-joaquim",
      type: "Person",
      display: "Joaquim Fernandes",
      linkedCount: 4,
      properties: { Name: "Joaquim Fernandes", Phone: "+91 22 4188 2901", City: "Mumbai" },
    },
    reasons: ["Same phone (exact match on digits present in both)", "Similar name (Jaro-Winkler 0.91)", "Same city"],
  },
  {
    id: "er2",
    confidence: 58,
    left: OBJECTS.find((o) => o.id === "p-ramesh")!,
    right: OBJECTS.find((o) => o.id === "p-second")!,
    reasons: ["Similar name (Jaro-Winkler 0.74)"],
  },
];

export const EVIDENCE_ASSETS: EvidenceAsset[] = [
  { id: "ev-1", objectId: "p-jf-partial", title: "Job-listing extraction", kind: "Document", source: "Public job listings", observed: "12 Jun 2026", summary: "Listing contact includes the partial number +91 22 4188 and the name J. Fernandes." },
  { id: "ev-2", objectId: "p-joaquim", title: "Business registry profile", kind: "Document", source: "Regional Business Registry", observed: "12 Jun 2026", summary: "Registry record identifies Joaquim Fernandes and lists the complete phone number." },
  { id: "ev-3", objectId: "p-joaquim", title: "Registry record image", kind: "Image", source: "Regional Business Registry", observed: "12 Jun 2026", summary: "Captured registry image used during entity-resolution review." },
  { id: "ev-4", objectId: "p-ramesh", title: "Carrier relationship record", kind: "Document", source: "Phone Records", observed: "28 Jul 2026", summary: "Phone record connects Ramesh K. to the same carrier account." },
  { id: "ev-5", objectId: "p-second", title: "Document reference", kind: "Document", source: "Documents (DOC-441)", observed: "21 Aug 2026", summary: "Free-text reference containing Ramesh Kumar and a partially matching contact number." },
];

export const DATA_SOURCES: DataSource[] = [
  {
    id: "src-phone",
    name: "Phone Records",
    classification: "Highly Restricted",
    legalBasis: "MOU / DPA",
    owner: "Priya Shah",
    recordsIngested: 18420,
    lastSync: "2026-09-11T22:00:00Z",
    type: "API Connection",
  },
  {
    id: "src-registry",
    name: "Regional Business Registry",
    classification: "Internal",
    legalBasis: "MOU / DPA",
    owner: "Priya Shah",
    recordsIngested: 902,
    lastSync: "Never",
    type: "API Connection",
  },
  {
    id: "src-jobs",
    name: "Public job listings",
    classification: "Public",
    legalBasis: "Public record",
    owner: "Data Engineering",
    recordsIngested: 4412,
    lastSync: "2026-09-12T01:00:00Z",
    type: "CSV Upload",
  },
  {
    id: "src-docs",
    name: "Partner NGO field notes",
    classification: "Restricted",
    legalBasis: "Documented consent",
    owner: "Priya Shah",
    recordsIngested: 126,
    lastSync: "2026-09-09T11:30:00Z",
    type: "CSV Upload",
    syncWarning: "Scheduled sync failed at 02:00. Last successful sync shown.",
  },
];

export const AGENCIES: Agency[] = [
  { id: "ag-1", name: "Mumbai Anti-Trafficking Unit" },
  { id: "ag-2", name: "State CID — Organised Crime" },
];

export const AUDIT: AuditEntry[] = [
  {
    id: "au1",
    timestamp: "2026-09-11T16:12:00Z",
    actor: "Maya Rao",
    action: "READ",
    reference: "Case #1042",
    result: "SUCCESS",
    purpose: "investigation-lead-follow-up",
  },
  {
    id: "au2",
    timestamp: "2026-09-11T10:18:00Z",
    actor: "Maya Rao",
    action: "WRITE",
    reference: "Case #1042 / note",
    result: "SUCCESS",
    purpose: "case-note",
  },
  {
    id: "au3",
    timestamp: "2026-09-12T04:50:00Z",
    actor: "Maya Rao",
    action: "ESCALATE",
    reference: "Case #1042",
    result: "SUCCESS",
    purpose: "propose-escalation",
  },
  {
    id: "au4",
    timestamp: "2026-09-10T09:00:00Z",
    actor: "Farah Khan",
    action: "EXPORT",
    reference: "Audit Log",
    result: "SUCCESS",
    purpose: "weekly-access-review",
  },
];

export const PROVENANCE: Record<string, ProvenanceRow[]> = {
  "ph-182": [
    { field: "Number", source: "Phone Records", observed: "28 Jul 2026", method: "Ingest" },
    { field: "Carrier", source: "Phone Records", observed: "28 Jul 2026", method: "Ingest" },
  ],
  "p-ramesh": [
    { field: "Name", source: "Phone Records", observed: "28 Jul 2026", method: "Deterministic match" },
    { field: "Aliases", source: "Job listings feed", observed: "19 Aug 2026", method: "Extraction" },
  ],
};

export const RAW_RECORDS: Record<string, string> = {
  "ph-182": "msisdn=+912241882901; first_seen=2026-07-28; carrier=AIRTEL; region=MH",
  "p-ramesh": "name=Ramesh K.; alt=R. Kumar; phone=+912241882901; city=Mumbai",
  "org-horizon": "legal_name=Horizon Staffing Pvt Ltd; cin=U74999MH2018PTC312441; addr=Andheri East, Mumbai",
};

export const PIPELINE = [
  { id: "raw", label: "Raw sources", items: ["Phone Records", "Job listings CSV", "Business Registry API"] },
  { id: "tx", label: "Transforms", items: ["Normalize phones", "Bedrock extract", "Entity resolution"] },
  { id: "enr", label: "Enriched datasets", items: ["Persons resolved", "Org registry join", "Listing entities"] },
  { id: "ont", label: "Ontology types", items: ["Person", "Organization", "Phone", "JobListing"] },
];

export const SIGNALS_DISCLAIMER =
  "This is not a probability of trafficking. It reflects why this cluster of objects became interesting.";

export const CLASSIFICATION_HELP: Record<string, string> = {
  Public: "Public: openly available information with no access restriction.",
  Internal: "Internal: business and organizational data not directly tied to identifiable individuals.",
  Restricted: "Restricted: sensitive operational data that is not public but does not directly identify individuals.",
  "Highly Restricted":
    "Highly Restricted: contains direct PII such as full names and phone numbers tied to identifiable individuals.",
};

export function objectById(id: string) {
  return OBJECTS.find((o) => o.id === id);
}

export function userById(id: string) {
  return USERS.find((u) => u.id === id);
}

export function neighbors(id: string, hops: number) {
  const nodes = new Set<string>([id]);
  let frontier = new Set<string>([id]);
  for (let i = 0; i < hops; i += 1) {
    const next = new Set<string>();
    for (const n of frontier) {
      for (const link of LINKS) {
        if (link.from === n && !nodes.has(link.to)) {
          nodes.add(link.to);
          next.add(link.to);
        }
        if (link.to === n && !nodes.has(link.from)) {
          nodes.add(link.from);
          next.add(link.from);
        }
      }
    }
    frontier = next;
  }
  const nodeList = [...nodes].map((nid) => objectById(nid)!).filter(Boolean);
  const edges = LINKS.filter((l) => nodes.has(l.from) && nodes.has(l.to));
  return { nodes: nodeList, edges };
}

export function typeColor(type: OntologyObject["type"]) {
  return OBJECT_TYPE_COLORS[type];
}

export function confidenceTone(n: number) {
  if (n >= 80) return "high" as const;
  if (n >= 50) return "medium" as const;
  return "low" as const;
}

export function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
