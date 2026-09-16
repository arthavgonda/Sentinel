import { get, post, patch } from "./client";
import type { OntologyObject, Link, ProvenanceRow } from "../types";

export const objectsApi = {
  list: (params?: { type?: string; q?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return get<OntologyObject[]>(`/api/v1/objects${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => get<OntologyObject>(`/api/v1/objects/${id}`),
  create: (payload: {
    type: string; display: string; properties: Record<string, string>;
    firstSeen?: string; imageUrl?: string;
  }) => post<OntologyObject>("/api/v1/objects", payload),
  update: (id: string, body: { display?: string; properties?: Record<string, string> }) =>
    patch<OntologyObject>(`/api/v1/objects/${id}`, body),
  links: (id: string) => get<Link[]>(`/api/v1/objects/${id}/links`),
  provenance: (id: string) => get<ProvenanceRow[]>(`/api/v1/objects/${id}/provenance`),
};
