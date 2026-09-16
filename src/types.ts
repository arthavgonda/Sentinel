export type Role = "analyst" | "steward" | "case_lead" | "auditor" | "admin";

export type ObjectType =
  | "Person"
  | "Organization"
  | "Phone"
  | "Location"
  | "JobListing"
  | "Document"
  | "Case";

export type CaseStatus = "Open" | "Under Review" | "Escalated" | "Closed";

export type Classification = "Public" | "Internal" | "Restricted" | "Highly Restricted";

export type MatchMethod = "deterministic" | "probabilistic";

export type User = {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
};

export type OntologyObject = {
  id: string;
  type: ObjectType;
  display: string;
  properties: Record<string, string>;
  linkedCount: number;
  firstSeen?: string;
  imageUrl?: string;
};

export type Link = {
  id: string;
  from: string;
  to: string;
  type: string;
  confidence: number;
  method: MatchMethod;
  sourceId: string;
  sourceLabel: string;
  observed: string;
  matchedAttributes: string[];
};

export type CaseRecord = {
  id: string;
  number: string;
  title: string;
  status: CaseStatus;
  leadId: string;
  assignedIds: string[];
  objectIds: string[];
  graphLayout?: Record<string, { x: number; y: number }>;
  createdAt: string;
  updatedAt: string;
  escalation?: {
    agencyId: string;
    proposedBy: string;
    pending: boolean;
  };
};

export type Note = {
  id: string;
  caseId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Signal = {
  id: string;
  caseId: string;
  label: string;
  points: number;
  objectIds: string[];
};

export type ActivityItem = {
  id: string;
  text: string;
  objectType?: ObjectType;
  at: string;
  href: string;
};

export type NotificationItem = {
  id: string;
  text: string;
  at: string;
  href: string;
  read: boolean;
};

export type ErMatch = {
  id: string;
  confidence: number;
  left: OntologyObject;
  right: OntologyObject;
  reasons: string[];
  modelVersion?: string | null;
};

export type EvidenceAsset = {
  id: string;
  objectId: string;
  title: string;
  kind: "Document" | "Image" | "Video" | "Audio";
  source: string;
  observed: string;
  summary: string;
  url?: string;
};

export type DataSource = {
  id: string;
  name: string;
  classification: Classification;
  legalBasis: string;
  owner: string;
  recordsIngested: number;
  lastSync: string;
  type: "API Connection" | "CSV Upload" | "Manual Entry";
  syncWarning?: string;
};

export type Agency = {
  id: string;
  name: string;
};

export type AuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: "READ" | "WRITE" | "MERGE" | "ESCALATE" | "EXPORT";
  reference: string;
  result: "SUCCESS" | "DENIED";
  purpose: string;
};

export type HistoryEntry = {
  id: string;
  actorId: string;
  actorName: string;
  action: "Created" | "Updated" | "Deleted" | "Added" | "Removed" | "Merged" | "Reverted";
  subject: string;
  detail: string;
  timestamp: string;
};

export type ProvenanceRow = {
  field: string;
  source: string;
  observed: string;
  method: string;
};
