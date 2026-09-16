import { Router, type Request, type Response } from "express";
import { getDb, q } from "../db/connection";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const { q: term, type, limit = "50" } = req.query as { q?: string; type?: string; limit?: string };
  if (!term?.trim()) { res.json({ data: [], meta: { count: 0 } }); return; }
  const t = term.trim().toLowerCase();
  const where: string[] = ["(LOWER(display) LIKE ? OR LOWER(properties) LIKE ?)"];
  const params: (string | number)[] = [`%${t}%`, `%${t}%`];
  if (type) { where.push("type = ?"); params.push(type); }
  const sql = `SELECT * FROM objects WHERE ${where.join(" AND ")} ORDER BY display ASC LIMIT ?`;
  const rows = q(db, sql, ...params, Number(limit));
  res.json({
    data: rows.map((r) => ({ id: r.id, type: r.type, display: r.display, linkedCount: r.linked_count, firstSeen: r.first_seen, properties: JSON.parse(String(r.properties ?? "{}")) })),
    meta: { query: term, count: rows.length },
  });
});

export default router;
