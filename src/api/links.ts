import { get, post, del } from "./client";
import type { Link } from "../types";

export const linksApi = {
  list: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return get<Link[]>(`/api/v1/links${qs ? `?${qs}` : ""}`);
  },
  create: (payload: {
    from: string; to: string; type: string; confidence?: number;
    method?: string; sourceId?: string; sourceLabel?: string;
    observed?: string; matchedAttributes?: string[];
  }) => post<Link>("/api/v1/links", payload),
  delete: (id: string) => del<{ ok: boolean }>(`/api/v1/links/${id}`),
};
