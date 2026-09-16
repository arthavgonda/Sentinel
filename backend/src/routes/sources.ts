import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getDb, q, qOne, run, type Row } from "../db/connection";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", (_req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: q(db, "SELECT * FROM data_sources ORDER BY created_at DESC").map(deser) });
});

router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const row = qOne(db, "SELECT * FROM data_sources WHERE id = ?", req.params.id);
  if (!row) { res.status(404).json({ error: "Source not found", code: "NOT_FOUND" }); return; }
  res.json({ data: deser(row) });
});

router.post("/", requireRole("steward", "admin"),
  (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as AuthRequest).user;
    const { name, classification, legalBasis, type, syncWarning } = req.body as {
      name: string; classification: string; legalBasis: string; type: string; syncWarning?: string;
    };
    if (!name || !classification || !legalBasis || !type) {
      res.status(400).json({ error: "name, classification, legalBasis, type required", code: "BAD_REQUEST" }); return;
    }
    const id = `src-${randomUUID()}`;
    const now = new Date().toISOString();
    run(db, "INSERT INTO data_sources (id, name, classification, legal_basis, owner, records_ingested, last_sync, type, sync_warning, created_at) VALUES (?, ?, ?, ?, ?, 0, 'Never', ?, ?, ?)",
      id, name, classification, legalBasis, user.name, type, syncWarning ?? null, now);
    res.status(201).json({ data: deser(qOne(db, "SELECT * FROM data_sources WHERE id = ?", id)!) });
  }
);

function deser(r: Row) {
  return { id: r.id, name: r.name, classification: r.classification, legalBasis: r.legal_basis, owner: r.owner, recordsIngested: r.records_ingested, lastSync: r.last_sync, type: r.type, syncWarning: r.sync_warning ?? undefined };
}

export default router;
