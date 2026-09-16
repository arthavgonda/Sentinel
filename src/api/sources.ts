import { get, post } from "./client";
import type { DataSource } from "../types";

export const sourcesApi = {
  list: () => get<DataSource[]>("/api/v1/sources"),
  get: (id: string) => get<DataSource>(`/api/v1/sources/${id}`),
  create: (payload: {
    name: string; classification: string; legalBasis: string;
    type: string; syncWarning?: string;
  }) => post<DataSource>("/api/v1/sources", payload),
};
