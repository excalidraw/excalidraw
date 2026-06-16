import { atom } from "../../app-jotai";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

export interface SyncStatusState {
  status: SyncStatus;
  /** epoch ms of the last successful push/pull, or null if never synced */
  lastSyncedAt: number | null;
  /** human-readable message for the tooltip (RLS / network / file), or null */
  error: string | null;
}

/**
 * The sync status the UI renders. The engine mutates it imperatively via
 * `appJotaiStore.set(syncStatusAtom, ...)`; the UI reads it via `useAtomValue`.
 * Offline is a status value here (not a separate atom).
 */
export const syncStatusAtom = atom<SyncStatusState>({
  status: "idle",
  lastSyncedAt: null,
  error: null,
});
