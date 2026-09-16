import type { Request, Response, NextFunction } from "express";
import { getDb, run } from "../db/connection";
import type { AuthRequest } from "./auth";

export function auditWrite(action: string, referenceFn: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const user = (req as AuthRequest).user;
      if (user && res.statusCode < 400) {
        try {
          const db = getDb();
          const id = `au-${crypto.randomUUID()}`;
          const purpose = String((req.body as Record<string, unknown>)?.purpose ?? action.toLowerCase());
          run(db, "INSERT INTO audit_log (id, timestamp, actor, action, reference, result, purpose) VALUES (?, ?, ?, ?, ?, ?, ?)",
            id, new Date().toISOString(), user.name, action, referenceFn(req), "SUCCESS", purpose);
        } catch { }
      }
      return originalJson(body);
    };
    next();
  };
}
