import { getNonDeletedElements } from "@excalidraw/element";

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { stripEphemeral } from "./ephemeralAppState";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface BoardRow {
  id: string;
  user_id: string;
  name: string;
  document: OrderedExcalidrawElement[];
  app_state: Partial<AppState>;
  version: number;
  created_at: string; // ISO string from Postgres timestamptz
  updated_at: string;
}

export interface SerializedScene {
  document: OrderedExcalidrawElement[];
  app_state: Partial<AppState>;
}

export type PushResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true };

/**
 * Pure, synchronous scene → row payload boundary. Drops deleted elements and strips every
 * ephemeral (viewport / selection / transient-UI) key so pan/zoom/selection/menu/tool churn
 * never produces a meaningful diff. Returns plain JSON-serializable objects.
 */
export const serializeScene = (
  elements: readonly OrderedExcalidrawElement[],
  appState: Partial<AppState>,
): SerializedScene => {
  const document = [...getNonDeletedElements(elements)];
  const app_state = stripEphemeral(clearAppStateForLocalStorage(appState));
  return { document, app_state };
};

const mapRowToBoard = (data: any): BoardRow => ({
  id: data.id,
  user_id: data.user_id,
  name: data.name,
  document: data.document,
  app_state: data.app_state,
  version: data.version,
  created_at: data.created_at,
  updated_at: data.updated_at,
});

/**
 * Reads the caller's single board row. Returns `null` when no row exists (never-synced),
 * which is NOT an error. Throws on a real Postgrest error.
 */
export const pullBoard = async (
  client: SupabaseClient,
  userId: string,
): Promise<BoardRow | null> => {
  const { data, error } = await client
    .from("boards")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle(); // 0 rows -> data === null (NOT an error)

  if (error) {
    throw error;
  }

  return data ? mapRowToBoard(data) : null;
};

/**
 * Writes the scene to the caller's board row.
 *
 * - `expectedVersion === null` ⇒ first-time INSERT (version 1).
 * - otherwise ⇒ version-guarded UPDATE that only matches when the row's version still equals
 *   `expectedVersion`; a 0-row result means a racing writer advanced the version ⇒ conflict.
 *
 * Non-conflict errors are surfaced by throwing.
 */
export const pushBoard = async (
  client: SupabaseClient,
  userId: string,
  scene: SerializedScene,
  expectedVersion: number | null,
): Promise<PushResult> => {
  if (expectedVersion === null) {
    // FIRST-TIME INSERT
    const { error } = await client
      .from("boards")
      .insert({
        user_id: userId,
        document: scene.document,
        app_state: scene.app_state,
        version: 1,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { ok: true, version: 1 };
  }

  // VERSION-GUARDED UPDATE
  const nextVersion = expectedVersion + 1;

  const { data, error } = await client
    .from("boards")
    .update({
      document: scene.document,
      app_state: scene.app_state,
      version: nextVersion,
    })
    .eq("user_id", userId)
    .eq("version", expectedVersion) // optimistic guard
    .select()
    .maybeSingle(); // 0 rows updated -> data === null

  if (error) {
    throw error;
  }

  if (data === null) {
    // someone advanced the version between our pull and this write
    return { ok: false, conflict: true };
  }

  return { ok: true, version: nextVersion };
};

// ---------------------------------------------------------------------------
// Lock RPC wrappers (single-writer / multi-reader — see 0002_board_locks.sql).
//
// All five are thin wrappers over `client.rpc("<fn>", { ...params })`. The RPCs are
// SECURITY DEFINER and read the caller's identity via `auth.uid()` server-side, so NONE takes a
// userId argument — only the per-tab `sessionId` (and, for takeover, the same id). All lease/expiry
// timing is the SERVER clock (`now()` inside each function); the client never compares timestamps to
// `Date.now()` — it consumes the RPC-computed `lockLive` / `stillWriter` / `acquired` verdicts.
//
// `returns table (...)` RPCs resolve to an ARRAY of rows (here always 0 or 1 row, keyed on the
// caller's single board); `returns void` resolves to `data === null`.
// ---------------------------------------------------------------------------

/** Result of {@link claimLock} — whether we became the writer + the resulting authoritative state. */
export interface ClaimLockResult {
  acquired: boolean;
  holder: {
    writerId: string | null;
    writerSessionId: string | null;
  };
  lockExpiresAt: string | null;
  version: number | null;
}

/** Result of {@link renewLock} — whether we still hold the lock + any live takeover signal. */
export interface RenewLockResult {
  stillWriter: boolean;
  takeoverRequestedBy: string | null;
  version: number | null;
}

/** Result of {@link requestTakeover} — whether the lock was already free to claim immediately. */
export interface RequestTakeoverResult {
  immediatelyClaimable: boolean;
  writerSessionId: string | null;
  lockExpiresAt: string | null;
}

/** Result of {@link readLockState} — the reader/writer poll snapshot (DB-clock liveness verdict). */
export interface LockStateResult {
  version: number | null;
  writerId: string | null;
  writerSessionId: string | null;
  lockLive: boolean;
  takeoverRequestedBy: string | null;
  serverNow: string;
}

/**
 * Atomically attempts to become the writer via `claim_board_lock`. Wins iff the lock is
 * free / lease-expired / already ours. Returns the resulting authoritative lock state so the caller
 * can decide its role. Throws on a real Postgrest error.
 */
export const claimLock = async (
  client: SupabaseClient,
  sessionId: string,
): Promise<ClaimLockResult> => {
  const { data, error } = await client.rpc("claim_board_lock", {
    p_session_id: sessionId,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    acquired: Boolean(row?.acquired),
    holder: {
      writerId: row?.writer_id ?? null,
      writerSessionId: row?.writer_session_id ?? null,
    },
    lockExpiresAt: row?.lock_expires_at ?? null,
    version: row?.version ?? null,
  };
};

/**
 * Writer heartbeat via `renew_board_lock`. Renews the lease only if we still hold the lock and no
 * live takeover is pending (the RPC self-heals a stale request first). Returns whether we still hold
 * the lock + the post-cleanup takeover signal. Throws on a real Postgrest error.
 */
export const renewLock = async (
  client: SupabaseClient,
  sessionId: string,
): Promise<RenewLockResult> => {
  const { data, error } = await client.rpc("renew_board_lock", {
    p_session_id: sessionId,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    stillWriter: Boolean(row?.still_writer),
    takeoverRequestedBy: row?.takeover_requested_by ?? null,
    version: row?.version ?? null,
  };
};

/**
 * Releases the lock via `release_board_lock` (clean close or completing a handoff). Idempotent and
 * only clears the lock if we still hold it. Throws on a real Postgrest error.
 */
export const releaseLock = async (
  client: SupabaseClient,
  sessionId: string,
): Promise<void> => {
  const { error } = await client.rpc("release_board_lock", {
    p_session_id: sessionId,
  });

  if (error) {
    throw error;
  }
};

/**
 * Signals the current writer to hand off via `request_takeover`. Records the request only; does NOT
 * steal the lock. If the lock is already free/expired, `immediatelyClaimable` is true so the caller's
 * next {@link claimLock} wins with no waiting. Throws on a real Postgrest error.
 */
export const requestTakeover = async (
  client: SupabaseClient,
  sessionId: string,
): Promise<RequestTakeoverResult> => {
  const { data, error } = await client.rpc("request_takeover", {
    p_session_id: sessionId,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    immediatelyClaimable: Boolean(row?.immediately_claimable),
    writerSessionId: row?.writer_session_id ?? null,
    lockExpiresAt: row?.lock_expires_at ?? null,
  };
};

/**
 * The reader/writer poll via `read_lock_state` (m5: an RPC, NOT a plain select — liveness is a
 * DB-clock verdict). Returns `lockLive` (writer present AND lease not expired, per server `now()`)
 * plus `serverNow` for cosmetic presence text. No userId arg — the RPC reads `auth.uid()` itself.
 * Throws on a real Postgrest error.
 */
export const readLockState = async (
  client: SupabaseClient,
): Promise<LockStateResult> => {
  const { data, error } = await client.rpc("read_lock_state");

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    version: row?.version ?? null,
    writerId: row?.writer_id ?? null,
    writerSessionId: row?.writer_session_id ?? null,
    lockLive: Boolean(row?.lock_live),
    takeoverRequestedBy: row?.takeover_requested_by ?? null,
    serverNow: row?.server_now,
  };
};
