import { get, post } from "./client";
import type { ErMatch } from "../types";

export type ModelStatus = "candidate" | "live" | "archived";

export interface ModelVersion {
  id: string;
  version: string;
  objectType: "Person" | "Organization";
  useLogistic: boolean;
  weights: Record<string, number>;
  intercept: number | null;
  nTrain: number | null;
  nTest: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  trainingFrom: string | null;
  trainingTo: string | null;
  status: ModelStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  shadowSummary?: { avg_delta: number | null; n: number } | null;
}

export interface RetrainResult {
  object_type: string;
  status: "ok" | "skipped" | "error";
  version?: string;
  modelId?: string;
  precision?: number;
  recall?: number;
  f1?: number;
  n_train?: number;
  n_test?: number;
  n?: number;
  required?: number;
  reason?: string;
  error?: string;
}

export const erApi = {
  listMatches: () => get<ErMatch[]>("/api/v1/er/matches"),
  resolveMatch: (id: string, merge: boolean, purpose?: string) =>
    post<{ ok: boolean; action: string }>(`/api/v1/er/matches/${id}/resolve`, { merge, purpose }),
  runCheck: () => post<{ queued: number }>("/api/v1/er/run", {}),
  retrain: (objectType?: "Person" | "Organization") =>
    post<RetrainResult[]>("/api/v1/er/retrain", objectType ? { object_type: objectType } : {}),
  listModelRegistry: () => get<ModelVersion[]>("/api/v1/er/model-registry"),
  getModelVersion: (id: string) => get<ModelVersion>(`/api/v1/er/model-registry/${id}`),
  promoteModel: (id: string, purpose: string) =>
    post<{ ok: boolean; version: string }>(`/api/v1/er/model-registry/${id}/promote`, { purpose }),
  rejectModel: (id: string, purpose: string) =>
    post<{ ok: boolean }>(`/api/v1/er/model-registry/${id}/reject`, { purpose }),
  rollbackModel: (id: string, purpose: string) =>
    post<{ ok: boolean; rolledBackTo: string }>(`/api/v1/er/model-registry/${id}/rollback`, { purpose }),
};
