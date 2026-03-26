import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { getSupabase } from "./supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  name: string;
  elements: ExcalidrawElement[];
  app_state: Partial<AppState> | null;
  created_at: string;
  updated_at: string;
}

export type SessionListItem = Pick<
  Session,
  "id" | "name" | "created_at" | "updated_at"
>;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export const fetchSessions = async (): Promise<SessionListItem[]> => {
  const { data, error } = await getSupabase()
    .from("sessions")
    .select("id, name, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data ?? [];
};

export const fetchSession = async (id: string): Promise<Session | null> => {
  const { data, error } = await getSupabase()
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

export const createSession = async (
  name: string,
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
): Promise<Session> => {
  const { data, error } = await getSupabase()
    .from("sessions")
    .insert({
      name,
      elements: JSON.parse(JSON.stringify(elements)),
      app_state: clearAppStateForLocalStorage(appState as AppState),
    })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data;
};

export const updateSession = async (
  id: string,
  updates: {
    name?: string;
    elements?: readonly ExcalidrawElement[];
    app_state?: Partial<AppState>;
  },
): Promise<void> => {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) {
    payload.name = updates.name;
  }
  if (updates.elements !== undefined) {
    payload.elements = JSON.parse(JSON.stringify(updates.elements));
  }
  if (updates.app_state !== undefined) {
    payload.app_state = clearAppStateForLocalStorage(
      updates.app_state as AppState,
    );
  }
  const { error } = await getSupabase()
    .from("sessions")
    .update(payload)
    .eq("id", id);
  if (error) {
    throw error;
  }
};

export const deleteSession = async (id: string): Promise<void> => {
  const { error } = await getSupabase().from("sessions").delete().eq("id", id);
  if (error) {
    throw error;
  }
};

export const renameSession = async (
  id: string,
  name: string,
): Promise<void> => {
  await updateSession(id, { name });
};
