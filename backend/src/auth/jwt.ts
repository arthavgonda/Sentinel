import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET ?? "sentinel-local-fallback";
const JWT_MFA_SECRET = process.env.JWT_MFA_SECRET ?? "sentinel-mfa-fallback";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";
const JWT_MFA_EXPIRES_IN = process.env.JWT_MFA_EXPIRES_IN ?? "5m";

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
}

export interface MfaPendingPayload {
  pending_user_id: string;
}

export function signSessionToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function signMfaToken(userId: string): string {
  return jwt.sign({ pending_user_id: userId }, JWT_MFA_SECRET, { expiresIn: JWT_MFA_EXPIRES_IN } as jwt.SignOptions);
}

export function verifySessionToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function verifyMfaToken(token: string): MfaPendingPayload {
  return jwt.verify(token, JWT_MFA_SECRET) as MfaPendingPayload;
}
