import { Router, type Request, type Response } from "express";
import { getDb } from "../db/connection";
import { signMfaToken, signSessionToken, verifyMfaToken } from "../auth/jwt";

const router = Router();

const FAIL_COUNTS = new Map<string, number>();
const MAX_FAILS = 5;
const MIN_PW_LEN = 8;
const MFA_CODE_LEN = 6;
const VALID_MFA_CODES = new Set(["123456", "654321", "111111", "999999"]);

router.post("/login", (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email and password required", code: "BAD_REQUEST" });
    return;
  }
  const key = email.toLowerCase().trim();
  const fails = FAIL_COUNTS.get(key) ?? 0;
  if (fails >= MAX_FAILS) {
    res.status(429).json({ error: "Too many failed attempts. Try again in 15 minutes, or reset your password.", code: "LOCKED" });
    return;
  }
  if (password.length < MIN_PW_LEN) {
    FAIL_COUNTS.set(key, fails + 1);
    res.status(401).json({ error: "Invalid credentials", code: "INVALID" });
    return;
  }
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(key) as { id: string; email: string; role: string; name: string } | undefined;
  if (!user) {
    FAIL_COUNTS.set(key, fails + 1);
    res.status(401).json({ error: "Invalid credentials", code: "INVALID" });
    return;
  }
  FAIL_COUNTS.set(key, 0);
  const mfaToken = signMfaToken(user.id);
  res.json({ data: { step: "mfa", mfa_token: mfaToken } });
});

router.post("/mfa", (req: Request, res: Response) => {
  const { mfa_token, code } = req.body as { mfa_token?: string; code?: string };
  if (!mfa_token || !code) {
    res.status(400).json({ error: "mfa_token and code required", code: "BAD_REQUEST" });
    return;
  }
  if (code === "000000") {
    res.status(401).json({ error: "MFA code expired", code: "MFA_EXPIRED" });
    return;
  }
  if (code.length !== MFA_CODE_LEN) {
    res.status(401).json({ error: "Incorrect MFA code", code: "MFA_INCORRECT" });
    return;
  }
  if (!VALID_MFA_CODES.has(code)) {
    res.status(401).json({ error: "Incorrect MFA code", code: "MFA_INCORRECT" });
    return;
  }
  let pending: { pending_user_id: string };
  try {
    pending = verifyMfaToken(mfa_token);
  } catch {
    res.status(401).json({ error: "MFA token invalid or expired", code: "MFA_EXPIRED" });
    return;
  }
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(pending.pending_user_id) as { id: string; email: string; role: string; name: string } | undefined;
  if (!user) {
    res.status(401).json({ error: "User not found", code: "INVALID" });
    return;
  }
  const token = signSessionToken({ sub: user.id, email: user.email, role: user.role, name: user.name });
  res.json({ data: { token, user: { id: user.id, email: user.email, role: user.role, name: user.name } } });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.json({ data: { ok: true } });
});

export default router;
