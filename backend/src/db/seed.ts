import { getDb } from "./connection";
import { randomUUID } from "node:crypto";

const USERS = [
  { id: "u1", name: "Maya Rao", email: "maya@sentinel.local", initials: "MR", role: "analyst" },
  { id: "u2", name: "Priya Shah", email: "priya@sentinel.local", initials: "PS", role: "steward" },
  { id: "u3", name: "Devraj Mehta", email: "devraj@sentinel.local", initials: "DM", role: "case_lead" },
  { id: "u4", name: "Farah Khan", email: "farah@sentinel.local", initials: "FK", role: "auditor" },
  { id: "u5", name: "Admin", email: "admin@sentinel.local", initials: "AD", role: "admin" },
];

const OBJECTS = [
  { id: "ph-182", type: "Phone", display: "+91 22 4188 2901", first_seen: "2026-07-28", linked_count: 3, properties: { Number: "+91 22 4188 2901", Carrier: "Airtel", "First seen": "28 Jul 2026" } },
  { id: "p-ramesh", type: "Person", display: "Ramesh K.", first_seen: "2026-07-28", linked_count: 5, properties: { Name: "Ramesh K.", Aliases: "R. Kumar", "Dates observed": "Jul 2026 – Sep 2026" } },
  { id: "p-joaquim", type: "Person", display: "Joaquim Fernandes", first_seen: "2026-06-12", linked_count: 4, properties: { Name: "Joaquim Fernandes", Aliases: "J. Fernandes", City: "Mumbai" } },
  { id: "p-ananya", type: "Person", display: "Ananya Desai", first_seen: "2026-08-02", linked_count: 2, properties: { Name: "Ananya Desai", City: "Pune" } },
  { id: "org-horizon", type: "Organization", display: "Horizon Staffing Pvt Ltd", first_seen: "2026-05-04", linked_count: 6, properties: { Name: "Horizon Staffing Pvt Ltd", Address: "Andheri East, Mumbai", Sector: "Recruitment", "Registration ID": "U74999MH2018PTC312441" } },
  { id: "loc-andheri", type: "Location", display: "Andheri East, Mumbai", first_seen: "2026-05-04", linked_count: 3, properties: { Address: "Andheri East, Mumbai", Type: "registered office" } },
  { id: "job-warehouse", type: "JobListing", display: "Warehouse helper — immediate join", first_seen: "2026-08-19", linked_count: 3, properties: { Title: "Warehouse helper — immediate join", Organization: "Horizon Staffing Pvt Ltd", Phone: "+91 22 4188 2901", Location: "Mumbai" } },
  { id: "doc-27", type: "Document", display: "Business Registry #27", first_seen: "2026-05-04", linked_count: 2, properties: { Title: "Business Registry extract", Source: "Regional Business Registry", Date: "4 May 2026" } },
  { id: "p-second", type: "Person", display: "Ramesh Kumar", first_seen: "2026-08-21", linked_count: 2, properties: { Name: "Ramesh Kumar", City: "Mumbai" } },
];

const LINKS = [
  { id: "l1", from_id: "p-ramesh", to_id: "ph-182", type: "uses", confidence: 96, method: "deterministic", source_id: "src-phone", source_label: "Phone Records", observed: "28 Jul 2026", matched_attributes: ["Exact phone number against carrier record"] },
  { id: "l2", from_id: "p-second", to_id: "ph-182", type: "uses", confidence: 61, method: "probabilistic", source_id: "doc-27", source_label: "Documents (DOC-441)", observed: "21 Aug 2026", matched_attributes: ["Phonetic name similarity", "Partial phone-number match"] },
  { id: "l3", from_id: "job-warehouse", to_id: "ph-182", type: "lists", confidence: 88, method: "deterministic", source_id: "src-jobs", source_label: "Job listings feed", observed: "19 Aug 2026", matched_attributes: ["Phone extracted from listing text"] },
  { id: "l4", from_id: "p-ramesh", to_id: "org-horizon", type: "associated_with", confidence: 84, method: "probabilistic", source_id: "src-jobs", source_label: "Job listings feed", observed: "19 Aug 2026", matched_attributes: ["Name on listing", "Shared phone"] },
  { id: "l5", from_id: "org-horizon", to_id: "loc-andheri", type: "registered_at", confidence: 100, method: "deterministic", source_id: "src-registry", source_label: "Business Registry #27", observed: "4 May 2026", matched_attributes: ["Registered address", "Registration identifier"] },
  { id: "l6", from_id: "job-warehouse", to_id: "org-horizon", type: "posted_by", confidence: 92, method: "deterministic", source_id: "src-jobs", source_label: "Job listings feed", observed: "19 Aug 2026", matched_attributes: ["Organization name on listing"] },
  { id: "l7", from_id: "p-joaquim", to_id: "org-horizon", type: "associated_with", confidence: 73, method: "probabilistic", source_id: "src-jobs", source_label: "Job listings feed", observed: "12 Jun 2026", matched_attributes: ["Name similarity", "Same city"] },
];

const CASES = [
  { id: "c-1042", number: "1042", title: "Mumbai recruitment network", status: "Under Review", lead_id: "u3", assigned_ids: ["u1", "u3"], object_ids: ["ph-182", "p-ramesh", "p-second", "org-horizon", "loc-andheri", "job-warehouse", "doc-27", "p-joaquim"], created_at: "2026-09-04T09:12:00Z", updated_at: "2026-09-11T16:40:00Z", escalation: { agencyId: "ag-1", proposedBy: "u1", pending: true } },
  { id: "c-1038", number: "1038", title: "Pune lodging cluster", status: "Open", lead_id: "u1", assigned_ids: ["u1"], object_ids: ["p-ananya", "loc-andheri"], created_at: "2026-08-22T11:00:00Z", updated_at: "2026-09-10T08:15:00Z", escalation: null },
  { id: "c-1021", number: "1021", title: "Registry mismatch review", status: "Closed", lead_id: "u3", assigned_ids: ["u3", "u2"], object_ids: ["org-horizon", "doc-27"], created_at: "2026-07-02T10:00:00Z", updated_at: "2026-08-01T14:22:00Z", escalation: null },
  { id: "c-1040", number: "1040", title: "Shared-phone follow-up", status: "Open", lead_id: "u1", assigned_ids: ["u1"], object_ids: ["ph-182", "p-ramesh"], created_at: "2026-09-08T07:30:00Z", updated_at: "2026-09-11T09:02:00Z", escalation: null },
  { id: "c-0998", number: "0998", title: "Coastal listings sweep", status: "Escalated", lead_id: "u3", assigned_ids: ["u1", "u3"], object_ids: ["job-warehouse", "org-horizon"], created_at: "2026-06-18T09:00:00Z", updated_at: "2026-09-01T12:00:00Z", escalation: null },
];

const NOTES = [
  { id: "n1", case_id: "c-1042", author_id: "u1", body: "Started from hotline tip. Phone number already had a six-week footprint via phone records and a document. Two people linked to the same number at different confidence — see graph. Organization reachable via two independent paths, worth prioritizing.", created_at: "2026-09-11T10:18:00Z" },
  { id: "n2", case_id: "c-1042", author_id: "u3", body: "Reviewed object set and signals. Shared-phone pattern plus dual path to Horizon Staffing is enough to propose escalation to the Mumbai Anti-Trafficking Unit.", created_at: "2026-09-12T07:40:00Z" },
];

const SIGNALS = [
  { id: "s1", case_id: "c-1042", label: "Shared phone number", points: 3, object_ids: ["p-ramesh", "p-second", "ph-182"] },
  { id: "s2", case_id: "c-1042", label: "Closed-loop organization path", points: 3, object_ids: ["p-ramesh", "job-warehouse", "org-horizon"] },
  { id: "s3", case_id: "c-1042", label: "Repeated listing language", points: 2, object_ids: ["job-warehouse"] },
  { id: "s4", case_id: "c-1042", label: "Recent first-seen cluster", points: 1, object_ids: ["ph-182", "job-warehouse"] },
];

const ER_MATCHES = [
  { id: "er1", confidence: 91, left_object: { id: "p-jf-partial", type: "Person", display: "J. Fernandes", linkedCount: 2, properties: { Name: "J. Fernandes", Phone: "+91 22 4188", City: "Mumbai" } }, right_object: { id: "p-joaquim", type: "Person", display: "Joaquim Fernandes", linkedCount: 4, properties: { Name: "Joaquim Fernandes", Phone: "+91 22 4188 2901", City: "Mumbai" } }, reasons: ["Same phone (exact match on digits present in both)", "Similar name (Jaro-Winkler 0.91)", "Same city"] },
  { id: "er2", confidence: 58, left_object: { id: "p-ramesh", type: "Person", display: "Ramesh K.", linkedCount: 5, properties: { Name: "Ramesh K.", Aliases: "R. Kumar" } }, right_object: { id: "p-second", type: "Person", display: "Ramesh Kumar", linkedCount: 2, properties: { Name: "Ramesh Kumar", City: "Mumbai" } }, reasons: ["Similar name (Jaro-Winkler 0.74)"] },
];

const DATA_SOURCES = [
  { id: "src-phone", name: "Phone Records", classification: "Highly Restricted", legal_basis: "MOU / DPA", owner: "Priya Shah", records_ingested: 18420, last_sync: "2026-09-11T22:00:00Z", type: "API Connection", sync_warning: null },
  { id: "src-registry", name: "Regional Business Registry", classification: "Internal", legal_basis: "MOU / DPA", owner: "Priya Shah", records_ingested: 902, last_sync: "Never", type: "API Connection", sync_warning: null },
  { id: "src-jobs", name: "Public job listings", classification: "Public", legal_basis: "Public record", owner: "Data Engineering", records_ingested: 4412, last_sync: "2026-09-12T01:00:00Z", type: "CSV Upload", sync_warning: null },
  { id: "src-docs", name: "Partner NGO field notes", classification: "Restricted", legal_basis: "Documented consent", owner: "Priya Shah", records_ingested: 126, last_sync: "2026-09-09T11:30:00Z", type: "CSV Upload", sync_warning: "Scheduled sync failed at 02:00. Last successful sync shown." },
];

const AGENCIES = [
  { id: "ag-1", name: "Mumbai Anti-Trafficking Unit" },
  { id: "ag-2", name: "State CID — Organised Crime" },
];

const AUDIT = [
  { id: "au1", timestamp: "2026-09-11T16:12:00Z", actor: "Maya Rao", action: "READ", reference: "Case #1042", result: "SUCCESS", purpose: "investigation-lead-follow-up" },
  { id: "au2", timestamp: "2026-09-11T10:18:00Z", actor: "Maya Rao", action: "WRITE", reference: "Case #1042 / note", result: "SUCCESS", purpose: "case-note" },
  { id: "au3", timestamp: "2026-09-12T04:50:00Z", actor: "Maya Rao", action: "ESCALATE", reference: "Case #1042", result: "SUCCESS", purpose: "propose-escalation" },
  { id: "au4", timestamp: "2026-09-10T09:00:00Z", actor: "Farah Khan", action: "EXPORT", reference: "Audit Log", result: "SUCCESS", purpose: "weekly-access-review" },
];

export function seed(): void {
  const db = getDb();
  const check = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
  if (check.cnt > 0) return;

  const insertUser = db.prepare("INSERT OR IGNORE INTO users (id, name, email, initials, role) VALUES (?, ?, ?, ?, ?)");
  const insertObject = db.prepare("INSERT OR IGNORE INTO objects (id, type, display, linked_count, first_seen, properties) VALUES (?, ?, ?, ?, ?, ?)");
  const insertLink = db.prepare("INSERT OR IGNORE INTO links (id, from_id, to_id, type, confidence, method, source_id, source_label, observed, matched_attributes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertCase = db.prepare("INSERT OR IGNORE INTO cases (id, number, title, status, lead_id, escalation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insertAssign = db.prepare("INSERT OR IGNORE INTO case_assignments (case_id, user_id) VALUES (?, ?)");
  const insertCaseObj = db.prepare("INSERT OR IGNORE INTO case_objects (case_id, object_id) VALUES (?, ?)");
  const insertNote = db.prepare("INSERT OR IGNORE INTO notes (id, case_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)");
  const insertSignal = db.prepare("INSERT OR IGNORE INTO signals (id, case_id, label, points, object_ids) VALUES (?, ?, ?, ?, ?)");
  const insertEr = db.prepare("INSERT OR IGNORE INTO er_matches (id, confidence, left_object, right_object, reasons) VALUES (?, ?, ?, ?, ?)");
  const insertSource = db.prepare("INSERT OR IGNORE INTO data_sources (id, name, classification, legal_basis, owner, records_ingested, last_sync, type, sync_warning) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertAgency = db.prepare("INSERT OR IGNORE INTO agencies (id, name) VALUES (?, ?)");
  const insertAudit = db.prepare("INSERT OR IGNORE INTO audit_log (id, timestamp, actor, action, reference, result, purpose) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const insertProv = db.prepare("INSERT OR IGNORE INTO provenance (id, object_id, field, source, observed, method) VALUES (?, ?, ?, ?, ?, ?)");
  const insertModel = db.prepare("INSERT OR IGNORE INTO model_registry (id, version, object_type, use_logistic, weights, intercept, n_train, n_test, status, approved_by, approved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

  for (const u of USERS) insertUser.run(u.id, u.name, u.email, u.initials, u.role);
  for (const o of OBJECTS) insertObject.run(o.id, o.type, o.display, o.linked_count, o.first_seen ?? null, JSON.stringify(o.properties));
  for (const l of LINKS) insertLink.run(l.id, l.from_id, l.to_id, l.type, l.confidence, l.method, l.source_id, l.source_label, l.observed, JSON.stringify(l.matched_attributes));
  for (const c of CASES) {
    insertCase.run(c.id, c.number, c.title, c.status, c.lead_id, c.escalation ? JSON.stringify(c.escalation) : null, c.created_at, c.updated_at);
    for (const uid of c.assigned_ids) insertAssign.run(c.id, uid);
    for (const oid of c.object_ids) insertCaseObj.run(c.id, oid);
  }
  for (const n of NOTES) insertNote.run(n.id, n.case_id, n.author_id, n.body, n.created_at);
  for (const s of SIGNALS) insertSignal.run(s.id, s.case_id, s.label, s.points, JSON.stringify(s.object_ids));
  for (const m of ER_MATCHES) insertEr.run(m.id, m.confidence, JSON.stringify(m.left_object), JSON.stringify(m.right_object), JSON.stringify(m.reasons));
  for (const s of DATA_SOURCES) insertSource.run(s.id, s.name, s.classification, s.legal_basis, s.owner, s.records_ingested, s.last_sync, s.type, s.sync_warning);
  for (const a of AGENCIES) insertAgency.run(a.id, a.name);
  for (const a of AUDIT) insertAudit.run(a.id, a.timestamp, a.actor, a.action, a.reference, a.result, a.purpose);
  const provRows = [
    { id: randomUUID(), object_id: "ph-182", field: "Number", source: "Phone Records", observed: "28 Jul 2026", method: "Ingest" },
    { id: randomUUID(), object_id: "ph-182", field: "Carrier", source: "Phone Records", observed: "28 Jul 2026", method: "Ingest" },
    { id: randomUUID(), object_id: "p-ramesh", field: "Name", source: "Phone Records", observed: "28 Jul 2026", method: "Deterministic match" },
    { id: randomUUID(), object_id: "p-ramesh", field: "Aliases", source: "Job listings feed", observed: "19 Aug 2026", method: "Extraction" },
  ];
  for (const p of provRows) insertProv.run(p.id, p.object_id, p.field, p.source, p.observed, p.method);

  const now = new Date().toISOString();
  const personBaselineWeights = JSON.stringify({
    jaro_winkler_high: 40, jaro_winkler_med: 25, soundex_match: 8,
    exact_phone: 35, partial_phone: 15, same_city: 8, alias_match: 12,
  });
  const orgBaselineWeights = JSON.stringify({
    org_jw_high: 45, org_jw_med: 22, org_same_address: 25, org_reg_id: 50,
  });
  insertModel.run("mr-person-baseline", "v1.0-baseline", "Person", 0, personBaselineWeights, 0, 0, 0, "live", "system", now, now);
  insertModel.run("mr-org-baseline", "v1.0-baseline", "Organization", 0, orgBaselineWeights, 0, 0, 0, "live", "system", now, now);
}

