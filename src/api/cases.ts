import { get, post, patch, del } from "./client";
import type { CaseRecord, CaseStatus } from "../types";

export const casesApi = {
  list: (params?: { status?: CaseStatus }) => {
    const qs = params?.status ? `?status=${params.status}` : "";
    return get<CaseRecord[]>(`/api/v1/cases${qs}`);
  },
  get: (id: string) => get<CaseRecord>(`/api/v1/cases/${id}`),
  create: (payload: { title: string; leadId: string; firstObjectId?: string }) =>
    post<CaseRecord>("/api/v1/cases", payload),
  update: (id: string, payload: { title?: string; status?: CaseStatus }) =>
    patch<CaseRecord>(`/api/v1/cases/${id}`, payload),
  addObject: (caseId: string, objectId: string) =>
    post<{ ok: boolean }>(`/api/v1/cases/${caseId}/objects`, { objectId }),
  removeObject: (caseId: string, objectId: string) =>
    del<{ ok: boolean }>(`/api/v1/cases/${caseId}/objects/${objectId}`),
  proposeEscalation: (caseId: string, agencyId: string) =>
    post<{ ok: boolean }>(`/api/v1/cases/${caseId}/escalate`, { agencyId }),
  resolveEscalation: (caseId: string, approve: boolean, reason?: string) =>
    post<{ ok: boolean }>(`/api/v1/cases/${caseId}/escalate/resolve`, { approve, reason }),
};
