import { Router, type Request, type Response } from "express";
import { getDb, q, qOne } from "../db/connection";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", requireRole("auditor", "admin"),
  (req: Request, res: Response) => {
    const db = getDb();
    const { action, actor, from, to, limit = "100", offset = "0" } = req.query as Record<string, string>;
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (action) { where.push("action = ?"); params.push(action); }
    if (actor) { where.push("actor LIKE ?"); params.push(`%${actor}%`); }
    if (from) { where.push("timestamp >= ?"); params.push(from); }
    if (to) { where.push("timestamp <= ?"); params.push(to); }
    const sql = `SELECT * FROM audit_log${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    const rows = q(db, sql, ...params, Number(limit), Number(offset));
    const total = (qOne(db, "SELECT COUNT(*) as cnt FROM audit_log") as { cnt: number }).cnt;
    res.json({ data: rows, meta: { total } });
  }
);

router.get("/agencies", (_req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: q(db, "SELECT * FROM agencies") });
});

router.get("/users", (_req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: q(db, "SELECT id, name, email, initials, role FROM users") });
});

export default router;
