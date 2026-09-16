import { get, post } from "./client";
import type { Note } from "../types";

export const notesApi = {
  list: (caseId: string) => get<Note[]>(`/api/v1/cases/${caseId}/notes`),
  post: (caseId: string, body: string) =>
    post<Note>(`/api/v1/cases/${caseId}/notes`, { body }),
};
