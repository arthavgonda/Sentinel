import { randomUUID } from "node:crypto";

interface ObjRow {
  id: string;
  type: string;
  display: string;
  properties: string;
  linked_count: number;
}

interface ErCandidate {
  left_id: string;
  right_id: string;
  confidence: number;
  shadow_confidence?: number;
  reasons: string[];
  features?: Record<string, number>;
}

interface Db {
  prepare(sql: string): {
    get(...args: unknown[]): unknown;
    all(...args: unknown[]): unknown[];
    run(...args: unknown[]): void;
  };
}

interface ModelRow {
  id: string;
  version: string;
  object_type: string;
  use_logistic: number;
  weights: string;
  intercept: number | null;
  status: string;
}

const ER_SERVICE_URL = process.env.ER_SERVICE_URL ?? "http://localhost:3002";

function buildMergedWeights(personRow: ModelRow | undefined, orgRow: ModelRow | undefined): Record<string, unknown> | null {
  const personCoefs = personRow ? JSON.parse(personRow.weights) as Record<string, number> : null;
  const orgCoefs = orgRow ? JSON.parse(orgRow.weights) as Record<string, number> : null;
  if (!personCoefs && !orgCoefs) return null;

  const useLogistic = Boolean(personRow?.use_logistic || orgRow?.use_logistic);

  const coefs: Record<string, number> = {};
  if (personCoefs) Object.assign(coefs, personCoefs);
  if (orgCoefs) Object.assign(coefs, orgCoefs);

  return {
    use_logistic: useLogistic,
    intercept: personRow?.intercept ?? 0,
    coefs,
    jw_high_thresh: 0.95,
    jw_med_thresh: 0.72,
    org_jw_high_thresh: 0.92,
    org_jw_med_thresh: 0.78,
    min_confidence: 45,
  };
}

function getLiveRows(db: Db): { person: ModelRow | undefined; org: ModelRow | undefined } {
  try {
    const person = db.prepare("SELECT * FROM model_registry WHERE object_type = 'Person' AND status = 'live' ORDER BY created_at DESC LIMIT 1").get() as ModelRow | undefined;
    const org = db.prepare("SELECT * FROM model_registry WHERE object_type = 'Organization' AND status = 'live' ORDER BY created_at DESC LIMIT 1").get() as ModelRow | undefined;
    return { person, org };
  } catch {
    return { person: undefined, org: undefined };
  }
}

function getCandidateRows(db: Db): { person: ModelRow | undefined; org: ModelRow | undefined } {
  try {
    const person = db.prepare("SELECT * FROM model_registry WHERE object_type = 'Person' AND status = 'candidate' ORDER BY created_at DESC LIMIT 1").get() as ModelRow | undefined;
    const org = db.prepare("SELECT * FROM model_registry WHERE object_type = 'Organization' AND status = 'candidate' ORDER BY created_at DESC LIMIT 1").get() as ModelRow | undefined;
    return { person, org };
  } catch {
    return { person: undefined, org: undefined };
  }
}

export async function triggerErCheck(objects: Record<string, unknown>[], db: Db): Promise<number> {
  const payload = objects.map((o) => ({
    id: o.id,
    type: o.type,
    display: o.display,
    properties: JSON.parse((o.properties as string) ?? "{}"),
  }));

  const { person: livePerson, org: liveOrg } = getLiveRows(db);
  const { person: candidatePerson, org: candidateOrg } = getCandidateRows(db);

  const liveWeights = buildMergedWeights(livePerson, liveOrg);
  const shadowWeights = buildMergedWeights(candidatePerson, candidateOrg);

  const liveVersion = [livePerson?.version, liveOrg?.version].filter(Boolean).join("+") || "v1.0-baseline";

  const requestBody: Record<string, unknown> = { objects: payload };
  if (liveWeights) requestBody.live_weights = liveWeights;
  if (shadowWeights) requestBody.shadow_weights = shadowWeights;

  let candidates: ErCandidate[];
  try {
    const resp = await fetch(`${ER_SERVICE_URL}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`ER service ${resp.status}`);
    const body = await resp.json() as { candidates: ErCandidate[] };
    candidates = body.candidates;
  } catch {
    return 0;
  }

  const insert = db.prepare(
    "INSERT OR IGNORE INTO er_matches (id, confidence, left_object, right_object, reasons, features, model_version) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const insertShadow = db.prepare(
    "INSERT INTO shadow_scores (id, candidate_version, match_left_id, match_right_id, live_confidence, shadow_confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const candidateVersion = [candidatePerson?.version, candidateOrg?.version].filter(Boolean).join("+");

  let count = 0;
  for (const c of candidates) {
    const leftRow = db.prepare("SELECT * FROM objects WHERE id = ?").get(c.left_id) as ObjRow | undefined;
    const rightRow = db.prepare("SELECT * FROM objects WHERE id = ?").get(c.right_id) as ObjRow | undefined;
    if (!leftRow || !rightRow) continue;

    const existing = db.prepare(
      "SELECT id FROM er_matches WHERE status = 'pending' AND ((left_object LIKE ? AND right_object LIKE ?) OR (left_object LIKE ? AND right_object LIKE ?))"
    ).get(`%"id":"${c.left_id}"%`, `%"id":"${c.right_id}"%`, `%"id":"${c.right_id}"%`, `%"id":"${c.left_id}"%`);
    if (existing) continue;

    const left = { id: leftRow.id, type: leftRow.type, display: leftRow.display, linkedCount: leftRow.linked_count, properties: JSON.parse(leftRow.properties ?? "{}") };
    const right = { id: rightRow.id, type: rightRow.type, display: rightRow.display, linkedCount: rightRow.linked_count, properties: JSON.parse(rightRow.properties ?? "{}") };
    const key = [c.left_id, c.right_id].sort().join(":");
    const matchId = `er-${key}-${randomUUID().slice(0, 8)}`;

    insert.run(
      matchId,
      c.confidence,
      JSON.stringify(left),
      JSON.stringify(right),
      JSON.stringify(c.reasons),
      c.features ? JSON.stringify(c.features) : null,
      liveVersion
    );

    if (c.shadow_confidence != null && c.shadow_confidence > 0 && candidateVersion) {
      insertShadow.run(
        randomUUID(), candidateVersion, c.left_id, c.right_id,
        c.confidence, c.shadow_confidence, new Date().toISOString()
      );
    }

    count++;
  }
  return count;
}
