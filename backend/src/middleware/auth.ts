import type { Request, Response, NextFunction } from "express";
import { verifySessionToken, type TokenPayload } from "../auth/jwt";

export interface AuthRequest extends Request {
  user: TokenPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing token", code: "UNAUTHORIZED" });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = verifySessionToken(token);
    (req as AuthRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token", code: "UNAUTHORIZED" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}
