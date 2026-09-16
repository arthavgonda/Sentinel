import { get } from "./client";
import type { AuditEntry, Agency, User } from "../types";

export const auditApi = {
  list: (params?: { action?: string; actor?: string; from?: string; to?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return get<AuditEntry[]>(`/api/v1/audit${qs ? `?${qs}` : ""}`);
  },
  agencies: () => get<Agency[]>("/api/v1/audit/agencies"),
  users: () => get<User[]>("/api/v1/audit/users"),
};
