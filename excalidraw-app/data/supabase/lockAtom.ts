import { atom } from "../../app-jotai";

import { STORAGE_KEYS } from "../../app_constants";

import type { SyncLockState } from "./syncEngine";

// Re-export the engine's role type so the UI imports a single canonical `SyncRole`.
export type { SyncRole } from "./syncEngine";

/**
 * The lock/role state the UI reads. Extends the engine's {@link SyncLockState} (role + holder +
 * liveness + takeover signal — the facts the lock RPCs report) with two hook-owned UI bits:
 *
 * - `holderIsMe` — convenience derived from `writerSessionId === getSessionId()` (the engine reports
 *   raw holder ids; the hook knows "us").
 * - `takeoverInFlight` — set by the hook's `takeOver()` action while it waits for the writer to hand
 *   off; cleared once this session becomes the writer (or the attempt resolves). The engine's
 *   `setLock` pushes never set this — the hook's adapter preserves it.
 */
export interface LockState extends SyncLockState {
  /** the current writer is THIS session (`writerSessionId === getSessionId()`). */
  holderIsMe: boolean;
  /** this session clicked "Take over" and is waiting to become the writer. */
  takeoverInFlight: boolean;
}

/**
 * Initial state: reader / nothing held — the safe default (a reader can never push until promoted,
 * mirroring the engine's `role = "reader"` default). When the flag is off this atom never changes,
 * so `viewModeEnabled = role === "reader"` must be combined with the flag/sign-in check by the hook
 * (the hook returns `viewModeEnabled = false` when the flag is off so the app is unaffected).
 */
export const lockAtom = atom<LockState>({
  role: "reader",
  writerId: null,
  writerSessionId: null,
  lockLive: false,
  takeoverRequested: false,
  holderIsMe: false,
  takeoverInFlight: false,
});

let cachedSessionId: string | null = null;

/** Generate an opaque session id; `crypto.randomUUID` where available, else a random fallback. */
const mintSessionId = (): string => {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // crypto unavailable (very old / locked-down env) — fall through to the random fallback.
  }
  return `sess-${Math.random().toString(36).slice(2)}-${Date.now().toString(
    36,
  )}`;
};

/**
 * The per-TAB writer/reader session id, minted once and cached at module level. Backed by
 * `sessionStorage` (NOT `localStorage`) so two tabs of the same user are distinct sessions and a
 * duplicated tab gets a fresh value — this is what lets the lock distinguish "my writer tab" from
 * "my reader tab" (both share one `auth.uid()`). Opaque to RLS; only distinguishes same-user tabs.
 */
export const getSessionId = (): string => {
  if (cachedSessionId !== null) {
    return cachedSessionId;
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      const existing = sessionStorage.getItem(
        STORAGE_KEYS.SESSION_STORAGE_SUPABASE_SESSION_ID,
      );
      if (existing) {
        cachedSessionId = existing;
        return existing;
      }
      const minted = mintSessionId();
      sessionStorage.setItem(
        STORAGE_KEYS.SESSION_STORAGE_SUPABASE_SESSION_ID,
        minted,
      );
      cachedSessionId = minted;
      return minted;
    }
  } catch {
    // sessionStorage unavailable (private mode / quota) — fall back to an in-memory id (still
    // stable for the tab's lifetime via the module-level cache).
  }
  cachedSessionId = mintSessionId();
  return cachedSessionId;
};
