import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getDb, q, qOne, run, type Row } from "../db/connection";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { auditWrite } from "../middleware/audit";

const router = Router();
router.use(requireAuth);

router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const { type, q: term } = req.query as { type?: string; q?: string };
  const where: string[] = [];
  const params: (string | number | null)[] = [];
  if (type) { where.push("type = ?"); params.push(type); }
  if (term) { where.push("(LOWER(display) LIKE ? OR LOWER(properties) LIKE ?)"); params.push(`%${term.toLowerCase()}%`, `%${term.toLowerCase()}%`); }
  const sql = `SELECT * FROM objects${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC`;
  res.json({ data: q(db, sql, ...params).map(deserObj) });
});

router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const row = qOne(db, "SELECT * FROM objects WHERE id = ?", req.params.id);
  if (!row) { res.status(404).json({ error: "Object not found", code: "NOT_FOUND" }); return; }
  res.json({ data: deserObj(row) });
});

router.post("/",
  requireRole("analyst", "steward", "admin", "case_lead"),
  auditWrite("WRITE", (req) => `Object / ${String((req.body as Row).display ?? "new")}`),
  (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as AuthRequest).user;
    const { type, display, properties, firstSeen, imageUrl } = req.body as {
      type: string; display: string; properties: Record<string, string>;
      firstSeen?: string; imageUrl?: string;
    };
    if (!type || !display) { res.status(400).json({ error: "type and display required", code: "BAD_REQUEST" }); return; }
    const id = `obj-${randomUUID()}`;
    const now = new Date().toISOString();
    run(db, "INSERT INTO objects (id, type, display, linked_count, first_seen, image_url, properties, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)",
      id, type, display, firstSeen ?? now.slice(0, 10), imageUrl ?? null, JSON.stringify(properties ?? {}), now, now);
    run(db, "INSERT INTO provenance (id, object_id, field, source, observed, method) VALUES (?, ?, ?, ?, ?, ?)",
      `prov-${randomUUID()}`, id, "display", "Manual Entry", now.slice(0, 10), `manual_entry:${user.name}`);
    res.status(201).json({ data: deserObj(qOne(db, "SELECT * FROM objects WHERE id = ?", id)!) });
  }
);

router.patch("/:id",
  requireRole("analyst", "steward", "admin", "case_lead"),
  auditWrite("WRITE", (req) => `Object/${req.params.id}`),
  (req: Request, res: Response) => {
    const db = getDb();
    const existing = qOne(db, "SELECT * FROM objects WHERE id = ?", req.params.id);
    if (!existing) { res.status(404).json({ error: "Object not found", code: "NOT_FOUND" }); return; }
    const { display, properties } = req.body as { display?: string; properties?: Record<string, string> };
    const now = new Date().toISOString();
    run(db, "UPDATE objects SET display = ?, properties = ?, updated_at = ? WHERE id = ?",
      display ?? String(existing.display), JSON.stringify(properties ?? JSON.parse(String(existing.properties))), now, req.params.id);
    res.json({ data: deserObj(qOne(db, "SELECT * FROM objects WHERE id = ?", req.params.id)!) });
  }
);

router.get("/:id/links", (req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: q(db, "SELECT * FROM links WHERE from_id = ? OR to_id = ? ORDER BY created_at DESC", req.params.id, req.params.id).map(deserLink) });
});

router.get("/:id/provenance", (req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: q(db, "SELECT * FROM provenance WHERE object_id = ?", req.params.id) });
});

function deserObj(r: Row) {
  return { id: r.id, type: r.type, display: r.display, linkedCount: r.linked_count, firstSeen: r.first_seen ?? undefined, imageUrl: r.image_url ?? undefined, properties: JSON.parse(String(r.properties ?? "{}")) };
}

function deserLink(r: Row) {
  return { id: r.id, from: r.from_id, to: r.to_id, type: r.type, confidence: r.confidence, method: r.method, sourceId: r.source_id, sourceLabel: r.source_label, observed: r.observed, matchedAttributes: JSON.parse(String(r.matched_attributes ?? "[]")) };
}

export default router;
