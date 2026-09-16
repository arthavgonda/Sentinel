import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getDb, q, qOne, run, type Row } from "../db/connection";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { auditWrite } from "../middleware/audit";

const router = Router();
router.use(requireAuth);

router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const user = (req as AuthRequest).user;
  const { status } = req.query as { status?: string };
  let rows: Row[];
  if (user.role === "analyst" || user.role === "case_lead") {
    const sql = `SELECT c.* FROM cases c JOIN case_assignments ca ON ca.case_id = c.id WHERE ca.user_id = ?${status ? " AND c.status = ?" : ""} ORDER BY c.updated_at DESC`;
    rows = status ? q(db, sql, user.sub, status) : q(db, sql, user.sub);
  } else {
    const sql = `SELECT * FROM cases${status ? " WHERE status = ?" : ""} ORDER BY updated_at DESC`;
    rows = status ? q(db, sql, status) : q(db, sql);
  }
  res.json({ data: rows.map((c) => hydrateCase(db, c)) });
});

router.post("/",
  requireRole("analyst", "steward", "admin", "case_lead"),
  auditWrite("WRITE", () => "Case / new"),
  (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as AuthRequest).user;
    const { title, leadId, firstObjectId } = req.body as { title: string; leadId: string; firstObjectId?: string };
    if (!title || !leadId) { res.status(400).json({ error: "title and leadId required", code: "BAD_REQUEST" }); return; }
    const maxNum = qOne(db, "SELECT MAX(CAST(number AS INTEGER)) as mx FROM cases") as { mx: number | null } | undefined;
    const nextNum = String(((maxNum?.mx) ?? 1099) + 1).padStart(4, "0");
    const id = `c-${randomUUID()}`;
    const now = new Date().toISOString();
    run(db, "INSERT INTO cases (id, number, title, status, lead_id, created_at, updated_at) VALUES (?, ?, ?, 'Open', ?, ?, ?)", id, nextNum, title, leadId, now, now);
    run(db, "INSERT OR IGNORE INTO case_assignments (case_id, user_id) VALUES (?, ?)", id, leadId);
    if (user.sub !== leadId) run(db, "INSERT OR IGNORE INTO case_assignments (case_id, user_id) VALUES (?, ?)", id, user.sub);
    if (firstObjectId) run(db, "INSERT OR IGNORE INTO case_objects (case_id, object_id) VALUES (?, ?)", id, firstObjectId);
    res.status(201).json({ data: hydrateCase(db, qOne(db, "SELECT * FROM cases WHERE id = ?", id)!) });
  }
);

router.get("/:id",
  auditWrite("READ", (req) => `Case #${req.params.id}`),
  (req: Request, res: Response) => {
    const db = getDb();
    const row = qOne(db, "SELECT * FROM cases WHERE id = ?", req.params.id);
    if (!row) { res.status(404).json({ error: "Case not found", code: "NOT_FOUND" }); return; }
    res.json({ data: hydrateCase(db, row) });
  }
);

router.patch("/:id",
  requireRole("analyst", "steward", "admin", "case_lead"),
  auditWrite("WRITE", (req) => `Case #${req.params.id}`),
  (req: Request, res: Response) => {
    const db = getDb();
    const existing = qOne(db, "SELECT * FROM cases WHERE id = ?", req.params.id);
    if (!existing) { res.status(404).json({ error: "Case not found", code: "NOT_FOUND" }); return; }
    const { title, status } = req.body as { title?: string; status?: string };
    const now = new Date().toISOString();
    run(db, "UPDATE cases SET title = ?, status = ?, updated_at = ? WHERE id = ?",
      title ?? String(existing.title), status ?? String(existing.status), now, req.params.id);
    res.json({ data: hydrateCase(db, qOne(db, "SELECT * FROM cases WHERE id = ?", req.params.id)!) });
  }
);

router.post("/:id/objects", requireRole("analyst", "steward", "admin", "case_lead"),
  (req: Request, res: Response) => {
    const db = getDb();
    const { objectId } = req.body as { objectId: string };
    if (!objectId) { res.status(400).json({ error: "objectId required", code: "BAD_REQUEST" }); return; }
    run(db, "INSERT OR IGNORE INTO case_objects (case_id, object_id) VALUES (?, ?)", req.params.id, objectId);
    run(db, "UPDATE cases SET updated_at = ? WHERE id = ?", new Date().toISOString(), req.params.id);
    res.json({ data: { ok: true } });
  }
);

router.delete("/:id/objects/:objId", requireRole("analyst", "steward", "admin", "case_lead"),
  (req: Request, res: Response) => {
    const db = getDb();
    run(db, "DELETE FROM case_objects WHERE case_id = ? AND object_id = ?", req.params.id, req.params.objId);
    run(db, "UPDATE cases SET updated_at = ? WHERE id = ?", new Date().toISOString(), req.params.id);
    res.json({ data: { ok: true } });
  }
);

router.post("/:id/escalate",
  requireRole("analyst", "case_lead"),
  auditWrite("ESCALATE", (req) => `Case #${req.params.id}`),
  (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as AuthRequest).user;
    const { agencyId } = req.body as { agencyId: string };
    if (!agencyId) { res.status(400).json({ error: "agencyId required", code: "BAD_REQUEST" }); return; }
    run(db, "UPDATE cases SET status = 'Under Review', escalation = ?, updated_at = ? WHERE id = ?",
      JSON.stringify({ agencyId, proposedBy: user.sub, pending: true }), new Date().toISOString(), req.params.id);
    res.json({ data: { ok: true } });
  }
);

router.post("/:id/escalate/resolve",
  requireRole("steward", "admin"),
  auditWrite("ESCALATE", (req) => `Case #${req.params.id} / resolve`),
  (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as AuthRequest).user;
    const { approve, reason } = req.body as { approve: boolean; reason?: string };
    const now = new Date().toISOString();
    if (approve) {
      run(db, "UPDATE cases SET status = 'Escalated', escalation = NULL, updated_at = ? WHERE id = ?", now, req.params.id);
    } else {
      run(db, "UPDATE cases SET status = 'Under Review', escalation = NULL, updated_at = ? WHERE id = ?", now, req.params.id);
      if (reason) run(db, "INSERT INTO notes (id, case_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)", `n-${randomUUID()}`, req.params.id, user.sub, `Escalation denied: ${reason}`, now);
    }
    res.json({ data: { ok: true } });
  }
);

router.get("/:id/signals", (req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: q(db, "SELECT * FROM signals WHERE case_id = ?", req.params.id).map((r) => ({ id: r.id, caseId: r.case_id, label: r.label, points: r.points, objectIds: JSON.parse(String(r.object_ids ?? "[]")) })) });
});

function hydrateCase(db: ReturnType<typeof getDb>, row: Row) {
  const assigns = q(db, "SELECT user_id FROM case_assignments WHERE case_id = ?", String(row.id));
  const objs = q(db, "SELECT object_id FROM case_objects WHERE case_id = ?", String(row.id));
  return {
    id: row.id, number: row.number, title: row.title, status: row.status, leadId: row.lead_id,
    assignedIds: assigns.map((a) => a.user_id),
    objectIds: objs.map((o) => o.object_id),
    graphLayout: row.graph_layout ? JSON.parse(String(row.graph_layout)) : undefined,
    escalation: row.escalation ? JSON.parse(String(row.escalation)) : undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export default router;
