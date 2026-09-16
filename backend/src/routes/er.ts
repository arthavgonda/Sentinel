import { Router, type Request, type Response } from "express";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { getDb, q, qOne, run, type Row } from "../db/connection";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { auditWrite } from "../middleware/audit";

const router = Router();
router.use(requireAuth);

router.get("/matches", (_req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: q(db, "SELECT * FROM er_matches WHERE status = 'pending' ORDER BY confidence DESC").map(deser) });
});

router.get("/matches/:id", (req: Request, res: Response) => {
  const db = getDb();
  const row = qOne(db, "SELECT * FROM er_matches WHERE id = ?", req.params.id);
  if (!row) { res.status(404).json({ error: "Not found", code: "NOT_FOUND" }); return; }
  res.json({ data: deser(row) });
});

router.post("/matches/:id/resolve", requireRole("steward", "admin"),
  auditWrite("MERGE", (req) => `ER match #${req.params.id}`),
  (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as AuthRequest).user;
    const { merge, purpose } = req.body as { merge: boolean; purpose?: string };
    const match = qOne(db, "SELECT * FROM er_matches WHERE id = ?", req.params.id);
    if (!match) { res.status(404).json({ error: "Match not found", code: "NOT_FOUND" }); return; }
    if (match.status !== "pending") { res.status(409).json({ error: "Match already resolved", code: "CONFLICT" }); return; }
    const now = new Date().toISOString();
    run(db, "UPDATE er_matches SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?",
      merge ? "merged" : "rejected", now, user.sub, req.params.id);

    if (match.features) {
      try {
        const features = JSON.parse(String(match.features)) as Record<string, number>;
        const leftObj = JSON.parse(String(match.left_object)) as { type?: string };
        const objectType = leftObj.type ?? "Person";
        if (objectType === "Person" || objectType === "Organization") {
          run(db,
            `INSERT OR IGNORE INTO er_training_log
             (id, object_type, match_id, jaro_winkler, soundex_match, exact_phone, partial_phone,
              same_city, alias_match, org_jw_high, org_jw_med, org_same_address, org_reg_id, label, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            randomUUID(), objectType, String(match.id),
            features.jaro_winkler ?? 0,
            features.soundex_match ?? 0,
            features.exact_phone ?? 0,
            features.partial_phone ?? 0,
            features.same_city ?? 0,
            features.alias_match ?? 0,
            features.org_jw_high ?? 0,
            features.org_jw_med ?? 0,
            features.org_same_address ?? 0,
            features.org_reg_id ?? 0,
            merge ? 1 : 0,
            now
          );
        }
      } catch { }
    }

    res.json({ data: { ok: true, action: merge ? "merged" : "rejected" } });
  }
);

router.post("/run", requireRole("steward", "admin"),
  async (_req: Request, res: Response) => {
    const { triggerErCheck } = await import("../services/erClient");
    const db = getDb();
    const objects = q(db, "SELECT * FROM objects") as Row[];
    const count = await triggerErCheck(objects as Record<string, unknown>[], db as Parameters<typeof triggerErCheck>[1]);
    res.json({ data: { queued: count } });
  }
);

router.post("/retrain", requireRole("steward", "admin"),
  auditWrite("RETRAIN", () => "Model Registry"),
  (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as AuthRequest).user;
    const { object_type } = req.body as { object_type?: "Person" | "Organization" };
    const types: Array<"Person" | "Organization"> = object_type ? [object_type] : ["Person", "Organization"];

    const results: unknown[] = [];

    for (const type of types) {
      const rows = q(db, "SELECT * FROM er_training_log WHERE object_type = ? ORDER BY created_at ASC", type) as Row[];
      if (rows.length < 30) {
        results.push({ object_type: type, status: "skipped", n: rows.length, required: 30 });
        continue;
      }
      const merged = rows.filter(r => r.label === 1).length;
      const rejected = rows.filter(r => r.label === 0).length;
      if (merged < 5 || rejected < 5) {
        results.push({ object_type: type, status: "skipped", n: rows.length, reason: `Need 5 of each class; have ${merged} merged, ${rejected} rejected` });
        continue;
      }

      const existingCandidate = qOne(db, "SELECT id, version FROM model_registry WHERE object_type = ? AND status = 'candidate' ORDER BY created_at DESC LIMIT 1", type) as Row | undefined;
      if (existingCandidate) {
        run(db, "UPDATE model_registry SET status = 'archived' WHERE id = ?", existingCandidate.id);
        run(db, `INSERT INTO audit_log (id, timestamp, actor, action, reference, result, purpose) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          randomUUID(), new Date().toISOString(), user.name, "MODEL_AUTO_ARCHIVED",
          `Model Registry / ${type} ${existingCandidate.version}`, "SUCCESS",
          "superseded-by-new-retrain"
        );
      }

      const trainingPayload = JSON.stringify({
        rows: rows.map(r => ({
          jaro_winkler: r.jaro_winkler,
          soundex_match: r.soundex_match,
          exact_phone: r.exact_phone,
          partial_phone: r.partial_phone,
          same_city: r.same_city,
          alias_match: r.alias_match,
          org_same_address: r.org_same_address,
          org_reg_id: r.org_reg_id,
          label: r.label,
        })),
        object_type: type,
        jw_high_thresh: 0.92,
        jw_med_thresh: 0.78,
      });

      const scriptPath = path.resolve(__dirname, "retrain.py");
      const result = spawnSync("python3", [scriptPath], {
        input: trainingPayload,
        encoding: "utf8",
        timeout: 60000,
      });

      if (result.error || result.status !== 0) {
        let errMsg = result.error?.message ?? result.stderr ?? "Unknown error";
        try {
          const parsed = JSON.parse(result.stdout) as { error?: string };
          if (parsed.error) errMsg = parsed.error;
        } catch { }
        results.push({ object_type: type, status: "error", error: errMsg });
        continue;
      }

      let trainResult: { use_logistic: boolean; intercept: number; coefs: Record<string, number>; precision: number; recall: number; f1: number; n_train: number; n_test: number };
      try {
        trainResult = JSON.parse(result.stdout);
      } catch {
        results.push({ object_type: type, status: "error", error: "Could not parse Python output" });
        continue;
      }

      const liveRow = qOne(db, "SELECT version FROM model_registry WHERE object_type = ? AND status = 'live' ORDER BY created_at DESC LIMIT 1", type) as Row | undefined;
      const nextVersion = bumpVersion(String(liveRow?.version ?? "v1.0-baseline"));
      const now = new Date().toISOString();
      const trainingFrom = String(rows[0].created_at);
      const trainingTo = String(rows[rows.length - 1].created_at);
      const modelId = `mr-${type.toLowerCase()}-${createHash("sha1").update(now).digest("hex").slice(0, 8)}`;

      run(db,
        `INSERT INTO model_registry
         (id, version, object_type, use_logistic, weights, intercept, n_train, n_test,
          precision_score, recall_score, f1_score, training_from, training_to, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        modelId, nextVersion, type, trainResult.use_logistic ? 1 : 0,
        JSON.stringify(trainResult.coefs), trainResult.intercept,
        trainResult.n_train, trainResult.n_test,
        trainResult.precision, trainResult.recall, trainResult.f1,
        trainingFrom, trainingTo, "candidate", now
      );

      results.push({
        object_type: type, status: "ok", version: nextVersion, modelId,
        precision: trainResult.precision, recall: trainResult.recall, f1: trainResult.f1,
        n_train: trainResult.n_train, n_test: trainResult.n_test,
      });
    }

    res.json({ data: results });
  }
);

router.get("/model-registry", (_req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: q(db, "SELECT * FROM model_registry ORDER BY object_type, created_at DESC").map(deserModel) });
});

router.get("/model-registry/:id", (req: Request, res: Response) => {
  const db = getDb();
  const row = qOne(db, "SELECT * FROM model_registry WHERE id = ?", req.params.id);
  if (!row) { res.status(404).json({ error: "Not found", code: "NOT_FOUND" }); return; }
  const shadowSummary = q(db,
    `SELECT AVG(shadow_confidence - live_confidence) as avg_delta, COUNT(*) as n
     FROM shadow_scores WHERE candidate_version = ?`,
    String(row.version)
  );
  res.json({ data: { ...deserModel(row), shadowSummary: shadowSummary[0] } });
});

router.post("/model-registry/:id/promote", requireRole("steward", "admin"),
  auditWrite("MODEL_PROMOTE", (req) => `Model Registry / ${req.params.id}`),
  (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as AuthRequest).user;
    const row = qOne(db, "SELECT * FROM model_registry WHERE id = ?", req.params.id) as Row | undefined;
    if (!row) { res.status(404).json({ error: "Not found", code: "NOT_FOUND" }); return; }
    if (row.status !== "candidate") { res.status(409).json({ error: "Only candidate models can be promoted", code: "CONFLICT" }); return; }
    const now = new Date().toISOString();
    run(db, "UPDATE model_registry SET status = 'archived' WHERE object_type = ? AND status = 'live'", row.object_type);
    run(db, "UPDATE model_registry SET status = 'live', approved_by = ?, approved_at = ? WHERE id = ?", user.name, now, req.params.id);
    res.json({ data: { ok: true, version: row.version } });
  }
);

router.post("/model-registry/:id/reject", requireRole("steward", "admin"),
  auditWrite("MODEL_REJECT", (req) => `Model Registry / ${req.params.id}`),
  (_req: Request, res: Response) => {
    const db = getDb();
    const row = qOne(db, "SELECT * FROM model_registry WHERE id = ?", _req.params.id) as Row | undefined;
    if (!row) { res.status(404).json({ error: "Not found", code: "NOT_FOUND" }); return; }
    if (row.status !== "candidate") { res.status(409).json({ error: "Only candidate models can be rejected", code: "CONFLICT" }); return; }
    run(db, "UPDATE model_registry SET status = 'archived' WHERE id = ?", _req.params.id);
    res.json({ data: { ok: true } });
  }
);

router.post("/model-registry/:id/rollback", requireRole("steward", "admin"),
  auditWrite("MODEL_ROLLBACK", (req) => `Model Registry / ${req.params.id}`),
  (req: Request, res: Response) => {
    const db = getDb();
    const liveRow = qOne(db, "SELECT * FROM model_registry WHERE id = ?", req.params.id) as Row | undefined;
    if (!liveRow) { res.status(404).json({ error: "Not found", code: "NOT_FOUND" }); return; }
    if (liveRow.status !== "live") { res.status(409).json({ error: "Only live models can be rolled back", code: "CONFLICT" }); return; }
    const prevArchived = qOne(db,
      "SELECT * FROM model_registry WHERE object_type = ? AND status = 'archived' ORDER BY approved_at DESC, created_at DESC LIMIT 1",
      liveRow.object_type
    ) as Row | undefined;
    if (!prevArchived) { res.status(409).json({ error: "No archived version available to roll back to", code: "CONFLICT" }); return; }
    const now = new Date().toISOString();
    run(db, "UPDATE model_registry SET status = 'archived' WHERE id = ?", req.params.id);
    run(db, "UPDATE model_registry SET status = 'live', approved_by = ?, approved_at = ? WHERE id = ?",
      (req as AuthRequest).user.name, now, prevArchived.id);
    res.json({ data: { ok: true, rolledBackTo: prevArchived.version } });
  }
);

function deser(r: Row) {
  return {
    id: r.id, confidence: r.confidence,
    left: JSON.parse(String(r.left_object)),
    right: JSON.parse(String(r.right_object)),
    reasons: JSON.parse(String(r.reasons ?? "[]")),
    features: r.features ? JSON.parse(String(r.features)) : null,
    modelVersion: r.model_version ?? null,
    status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at,
  };
}

function deserModel(r: Row) {
  return {
    id: r.id, version: r.version, objectType: r.object_type,
    useLogistic: Boolean(r.use_logistic),
    weights: JSON.parse(String(r.weights ?? "{}")),
    intercept: r.intercept ?? null,
    nTrain: r.n_train ?? null, nTest: r.n_test ?? null,
    precision: r.precision_score ?? null,
    recall: r.recall_score ?? null,
    f1: r.f1_score ?? null,
    trainingFrom: r.training_from ?? null,
    trainingTo: r.training_to ?? null,
    status: r.status,
    approvedBy: r.approved_by ?? null,
    approvedAt: r.approved_at ?? null,
    createdAt: r.created_at,
  };
}

function bumpVersion(current: string): string {
  const m = current.match(/^v(\d+)\.(\d+)/);
  if (!m) return "v1.1";
  return `v${m[1]}.${Number(m[2]) + 1}`;
}

export default router;
