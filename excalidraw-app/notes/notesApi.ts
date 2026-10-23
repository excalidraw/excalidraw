import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { LibraryPersistedData } from "@excalidraw/excalidraw/data/library";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

const API_URL = "/api";

export type NoteSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  hasThumbnail: boolean;
};

export type Note = NoteSummary & {
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};

export type NoteUpdate = {
  title?: string;
  elements?: readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
  /** only files not yet stored for the note need to be sent */
  files?: BinaryFiles;
  /** PNG data URL, or `null` to clear */
  thumbnail?: string | null;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!response.ok) {
    const { error } = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
};

export const notesApi = {
  list: () => request<NoteSummary[]>("/notes"),
  get: (id: string) => request<Note>(`/notes/${id}`),
  create: (title = "") =>
    request<NoteSummary>("/notes", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  update: (id: string, update: NoteUpdate) =>
    request<NoteSummary>(`/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(update),
    }),
  duplicate: (id: string) =>
    request<NoteSummary>(`/notes/${id}/duplicate`, { method: "POST" }),
  remove: (id: string) => request<void>(`/notes/${id}`, { method: "DELETE" }),
  thumbnailURL: (note: NoteSummary) =>
    `${API_URL}/notes/${note.id}/thumbnail?v=${note.updatedAt}`,
};

export const libraryApi = {
  load: () => request<LibraryPersistedData | null>("/library"),
  save: (data: LibraryPersistedData) =>
    request<void>("/library", { method: "PUT", body: JSON.stringify(data) }),
};
