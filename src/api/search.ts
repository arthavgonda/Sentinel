import { get } from "./client";
import type { OntologyObject } from "../types";

export const searchApi = {
  query: (q: string, params?: { type?: string; limit?: number }) => {
    const qs = new URLSearchParams({ q, ...(params as Record<string, string> ?? {}) }).toString();
    return get<OntologyObject[]>(`/api/v1/search?${qs}`);
  },
};
