import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getDb, q, qOne, run, type Row } from "../db/connection";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const { from, to } = req.query as { from?: string; to?: string };
  const where: string[] = [];
  const params: (string | number | null)[] = [];
  if (from) { where.push("from_id = ?"); params.push(from); }
  if (to) { where.push("to_id = ?"); params.push(to); }
  const sql = `SELECT * FROM links${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
  res.json({ data: q(db, sql, ...params).map(deser) });
});

router.post("/", requireRole("analyst", "steward", "admin", "case_lead"),
  (req: Request, res: Response) => {
    const db = getDb();
    const { from, to, type, confidence, method, sourceId, sourceLabel, observed, matchedAttributes } = req.body as {
      from: string; to: string; type: string; confidence?: number;
      method?: string; sourceId?: string; sourceLabel?: string;
      observed?: string; matchedAttributes?: string[];
    };
    if (!from || !to || !type) { res.status(400).json({ error: "from, to, type required", code: "BAD_REQUEST" }); return; }
    const id = `l-${randomUUID()}`;
    const now = new Date().toISOString();
    run(db, "INSERT INTO links (id, from_id, to_id, type, confidence, method, source_id, source_label, observed, matched_attributes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, from, to, type, confidence ?? 50, method ?? "deterministic", sourceId ?? "manual-entry", sourceLabel ?? "Manual Entry", observed ?? now.slice(0, 10), JSON.stringify(matchedAttributes ?? []), now);
    run(db, "UPDATE objects SET linked_count = linked_count + 1, updated_at = ? WHERE id = ?", now, from);
    run(db, "UPDATE objects SET linked_count = linked_count + 1, updated_at = ? WHERE id = ?", now, to);
    res.status(201).json({ data: deser(qOne(db, "SELECT * FROM links WHERE id = ?", id)!) });
  }
);

router.delete("/:id", requireRole("analyst", "steward", "admin", "case_lead"),
  (req: Request, res: Response) => {
    const db = getDb();
    const link = qOne(db, "SELECT * FROM links WHERE id = ?", req.params.id);
    if (!link) { res.status(404).json({ error: "Link not found", code: "NOT_FOUND" }); return; }
    const now = new Date().toISOString();
    run(db, "DELETE FROM links WHERE id = ?", req.params.id);
    run(db, "UPDATE objects SET linked_count = MAX(0, linked_count - 1), updated_at = ? WHERE id = ?", now, String(link.from_id));
    run(db, "UPDATE objects SET linked_count = MAX(0, linked_count - 1), updated_at = ? WHERE id = ?", now, String(link.to_id));
    res.json({ data: { ok: true } });
  }
);

function deser(r: Row) {
  return { id: r.id, from: r.from_id, to: r.to_id, type: r.type, confidence: r.confidence, method: r.method, sourceId: r.source_id, sourceLabel: r.source_label, observed: r.observed, matchedAttributes: JSON.parse(String(r.matched_attributes ?? "[]")) };
}

export default router;
