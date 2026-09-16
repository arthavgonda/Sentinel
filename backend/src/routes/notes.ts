import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getDb, q, qOne, run } from "../db/connection";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { auditWrite } from "../middleware/audit";

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get("/cases/:id/notes", (req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: q(db, "SELECT * FROM notes WHERE case_id = ? ORDER BY created_at DESC", req.params.id) });
});

router.post("/cases/:id/notes",
  auditWrite("WRITE", (req) => `Case #${req.params.id} / note`),
  (req: Request, res: Response) => {
    const db = getDb();
    const user = (req as AuthRequest).user;
    const { body } = req.body as { body: string };
    if (!body?.trim()) { res.status(400).json({ error: "body required", code: "BAD_REQUEST" }); return; }
    const id = `n-${randomUUID()}`;
    const now = new Date().toISOString();
    run(db, "INSERT INTO notes (id, case_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)", id, req.params.id, user.sub, body.trim(), now);
    run(db, "UPDATE cases SET updated_at = ? WHERE id = ?", now, req.params.id);
    res.status(201).json({ data: qOne(db, "SELECT * FROM notes WHERE id = ?", id) });
  }
);

export default router;
