import { isInitializedImageElement } from "@excalidraw/element";

import type {
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import {
  STORAGE_KEYS,
  SUPABASE_LOCK_HEARTBEAT_MS,
  SUPABASE_SYNC_DEBOUNCE_MS,
} from "../../app_constants";

import {
  claimLock,
  pullBoard,
  pushBoard,
  releaseLock,
  renewLock,
  requestTakeover,
  serializeScene,
  type BoardRow,
} from "./boardRepository";

import type { SyncStatusState } from "./syncStatusAtom";
import type { FileManager } from "../FileManager";

import type { SupabaseClient } from "@supabase/supabase-js";

/** The single-writer/multi-reader role this engine currently holds. */
export type SyncRole = "writer" | "reader";

/**
 * The lock/role state the engine pushes out to the UI (via the {@link SyncEngineDeps.setLock} dep).
 * Minimal by design: W03 owns the richer `lockAtom` (`holderIsMe`, `takeoverInFlight`, presence
 * cosmetics) and aligns to/extends this shape. The engine only ever reports the facts it knows from
 * the lock RPCs — who holds it, whether the lease is live, and whether a takeover is pending.
 */
export interface SyncLockState {
  role: SyncRole;
  /** `auth.uid()` of the current writer (from the row), or null when free. */
  writerId: string | null;
  /** the writer's per-tab `session_id`, or null when free. */
  writerSessionId: string | null;
  /** writer present AND lease not expired (server-clock verdict). */
  lockLive: boolean;
  /** a `takeover_requested_by` is set on the row. */
  takeoverRequested: boolean;
}

/**
 * Writer heartbeat interval. The lease TTL (server-side, in `0002_board_locks.sql`) is 25s, so a
 * 5s renew tolerates 1–4 missed beats (a GC pause / brief blip) without dropping the lease. Sourced
 * from the shared `app_constants.ts` (W03 added the lock tunables there); the engine test mirrors
 * the same value.
 */
const HEARTBEAT_MS = SUPABASE_LOCK_HEARTBEAT_MS;

/**
 * Construction dependencies for the framework-free {@link SyncEngine}. The engine never touches
 * `excalidrawAPI`, jotai, or the collab layer directly — those seams are injected so the orchestrator
 * stays unit-testable with fake timers + a mocked client.
 */
export interface SyncEngineDeps {
  client: SupabaseClient;
  /** reads `userIdAtom` imperatively; null ⇒ signed out (engine drops to local-only) */
  getUserId: () => string | null;
  /** the composed Supabase FileManager */
  fileManager: FileManager;
  getScene: () => {
    elements: readonly OrderedExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  };
  /** mirrors a status transition into `syncStatusAtom` (wired by the hook) */
  setStatus: (next: SyncStatusState) => void;
  /** applies a pulled cloud row to the live editor (the hook supplies this) */
  applyRemoteScene: (row: BoardRow) => Promise<void>;
  /**
   * The per-tab `session_id` (a `sessionStorage` UUID minted by the hook in W03). Distinguishes
   * tabs of the same user for the lock RPCs. Optional for back-compat: without it the engine cannot
   * claim a lock and stays a reader (the safe default — nobody can push until promoted).
   */
  getSessionId?: () => string;
  /**
   * Mirrors a lock/role transition out to the UI (`lockAtom`, wired by the hook in W03) — the role
   * peer of {@link setStatus}. Optional for back-compat with callers that don't yet wire it.
   */
  setLock?: (lock: SyncLockState) => void;
}

interface LocalMeta {
  version: number;
  lastSyncedAt: number;
}

/** Best-effort classification: network-class failures map to the `offline` status. */
const isNetworkError = (error: unknown): boolean => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  if (error instanceof TypeError) {
    // fetch() throws a TypeError on a network failure
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "";
  return (
    /failed to fetch/i.test(message) ||
    /networkerror/i.test(message) ||
    /network request failed/i.test(message)
  );
};

const isPermissionError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  if (
    code === "42501" ||
    code === "PGRST301" ||
    code === "PGRST302" ||
    code === "401" ||
    code === "403"
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /permission denied|not authorized|jwt|row-level security/i.test(
    message,
  );
};

/** Maps an arbitrary thrown error to a human-readable tooltip message. */
const mapMessage = (error: unknown): string => {
  if (isPermissionError(error)) {
    return "Sync failed: permission denied";
  }
  if (isNetworkError(error)) {
    return "Sync failed: you appear to be offline";
  }
  const message = error instanceof Error ? error.message : String(error);
  return message ? `Sync failed: ${message}` : "Sync failed";
};

/**
 * A first-time INSERT that throws because a racing device already inserted a row (e.g. a unique
 * violation on the `user_id` index) is NOT a hard failure — it just means we should re-pull and
 * reconcile rather than surfacing an error.
 */
const isUniquenessRace = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "23505") {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /duplicate key|already exists|unique constraint|conflict/i.test(
    message,
  );
};

/**
 * The cheap dirty-check snapshot: the JSON of the serialized (deleted-stripped + ephemeral-stripped)
 * scene. Comparing this string against the last-synced one means pan/zoom/selection/tool churn never
 * marks the board dirty.
 */
const sceneSnapshot = (
  elements: readonly OrderedExcalidrawElement[],
  appState: Partial<AppState>,
): string => JSON.stringify(serializeScene(elements, appState));

const collectSceneFileIds = (
  elements: readonly OrderedExcalidrawElement[],
): Set<FileId> => {
  const ids = new Set<FileId>();
  for (const element of elements) {
    if (isInitializedImageElement(element) && !element.isDeleted) {
      ids.add(element.fileId);
    }
  }
  return ids;
};

/**
 * Framework-free orchestrator owning the push debounce, the dirty flag, the persisted
 * `localMeta {version,lastSyncedAt}`, the status machine, online/offline listeners, and the
 * push/pull pipelines. Local-first + fire-and-forget + version-driven LWW.
 */
export class SyncEngine {
  private readonly deps: SyncEngineDeps;
  private readonly debounceMs = SUPABASE_SYNC_DEBOUNCE_MS;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private localMeta: LocalMeta | null = null;
  private lastSyncedSnapshot: string | null = null;

  /**
   * The single-writer/multi-reader role. Starts `reader` (the safe default — every write path is
   * gated, so an engine that never claims the lock can never push). Promoted to `writer` only by a
   * successful `claim_board_lock` in {@link start} (or a future takeover claim, W03).
   */
  private role: SyncRole = "reader";
  /** writer-only heartbeat timer (renew_board_lock every {@link HEARTBEAT_MS}). */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** serializes pushes so we never have two overlapping uploads */
  private inFlight = false;
  /** set when a flush is requested while another is in flight */
  private rerunRequested = false;

  private onlineListenerArmed = false;
  private readonly onOnline: () => void;
  private readonly onOffline: () => void;

  constructor(deps: SyncEngineDeps) {
    this.deps = deps;
    this.localMeta = this.loadMeta();

    this.onOnline = () => {
      this.onlineListenerArmed = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", this.onOnline);
      }
      if (this.dirty) {
        void this.flush();
      }
    };
    this.onOffline = () => {
      // only meaningful when we have pending work
      if (this.dirty) {
        this.deps.setStatus({
          status: "offline",
          lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
          error: null,
        });
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("offline", this.onOffline);
    }
  }

  // ---------------------------------------------------------------------------
  // localMeta persistence
  // ---------------------------------------------------------------------------

  private loadMeta(): LocalMeta | null {
    try {
      const raw =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META)
          : null;
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.version === "number" &&
        typeof parsed.lastSyncedAt === "number"
      ) {
        return { version: parsed.version, lastSyncedAt: parsed.lastSyncedAt };
      }
      return null;
    } catch {
      return null;
    }
  }

  private saveMeta(): void {
    try {
      if (typeof localStorage === "undefined") {
        return;
      }
      if (this.localMeta) {
        localStorage.setItem(
          STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META,
          JSON.stringify(this.localMeta),
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META);
      }
    } catch {
      // localStorage may be unavailable (private mode / quota) — non-fatal
    }
  }

  // ---------------------------------------------------------------------------
  // timer helpers
  // ---------------------------------------------------------------------------

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private armOnlineListener(): void {
    if (this.onlineListenerArmed || typeof window === "undefined") {
      return;
    }
    this.onlineListenerArmed = true;
    window.addEventListener("online", this.onOnline);
  }

  // ---------------------------------------------------------------------------
  // public API
  // ---------------------------------------------------------------------------

  /**
   * Runs the initial pull + reconcile (the LWW decision table), THEN attempts to claim the writer
   * lock. The role decision (writer | reader) is made only after the scene is settled, so the
   * winner pushes against the correct baseline.
   */
  async start(_userId: string): Promise<void> {
    const userId = this.deps.getUserId();
    if (!userId) {
      return;
    }

    let reconciled = false;
    try {
      await this.pullAndReconcile(userId);
      reconciled = true;
    } catch (error) {
      this.deps.setStatus({
        status: isNetworkError(error) ? "offline" : "error",
        lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
        error: mapMessage(error),
      });
    }

    // Only claim once the scene is settled. A failed pull leaves us a reader (the safe default) —
    // the engine never pushes a scene it couldn't first reconcile.
    if (reconciled) {
      await this.claimWriterLock();
    }
  }

  /** The original pull + reconcile body (the LWW decision table). Throws on a real pull error. */
  private async pullAndReconcile(userId: string): Promise<void> {
    const cloud = await pullBoard(this.deps.client, userId);

    if (cloud === null) {
      // first login / empty cloud: push the local scene up (INSERT) if there is one.
      const { elements, appState } = this.deps.getScene();
      const { document } = serializeScene(elements, appState);
      if (document.length > 0) {
        this.dirty = true;
        // This bootstrap INSERT runs BEFORE the claim (§6.8: the row must exist for the claim to
        // find) while the engine is still a reader — so it must bypass the reader-gate. `pushScene()`
        // is the ungated pipeline; `runPush()`/`flush()` are the gated entries. One establishing push.
        await this.pushScene();
      } else {
        // nothing local, nothing remote — already in sync
        this.lastSyncedSnapshot = sceneSnapshot(elements, appState);
        this.deps.setStatus({
          status: "idle",
          lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
          error: null,
        });
      }
      return;
    }

    // cloud row exists.
    if (this.localMeta === null || cloud.version > this.localMeta.version) {
      // cloud wins (newer version or we've never synced this device)
      await this.applyCloud(cloud);
      return;
    }

    // same version (or, defensively, a stale cloud) — leave any local edits for the normal
    // push path; reflect synced state.
    if (cloud.version === this.localMeta.version) {
      if (!this.dirty) {
        this.deps.setStatus({
          status: "synced",
          lastSyncedAt: this.localMeta.lastSyncedAt,
          error: null,
        });
      }
      return;
    }

    // cloud.version < localMeta.version: should not happen (monotonic); no-op.
    // eslint-disable-next-line no-console
    console.warn(
      "[supabase-sync] cloud version is behind local meta; skipping apply",
    );
  }

  /** Logout: release the lock if writer, cancel timers + stop pushing. */
  stop(): void {
    void this.releaseIfWriter();
    this.clearTimer();
    this.clearHeartbeat();
    this.role = "reader";
    this.dirty = false;
    this.localMeta = null;
    this.lastSyncedSnapshot = null;
  }

  /** Called from `onChange` (fire-and-forget). Reads the current scene via `getScene()`. */
  notifyChange(): void {
    // READER-GATE (M-critical): a reader must never arm the push debounce. A reader can't draw
    // (viewMode), but a programmatic updateScene must not slip through either.
    if (this.role !== "writer") {
      return;
    }
    if (this.deps.getUserId() == null) {
      return;
    }

    const { elements, appState } = this.deps.getScene();
    const next = sceneSnapshot(elements, appState);

    // nothing meaningful changed (pan/zoom/selection/tool/menu) — do not arm the debounce
    if (next === this.lastSyncedSnapshot) {
      return;
    }

    this.dirty = true;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.deps.setStatus({
        status: "offline",
        lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
        error: null,
      });
      this.armOnlineListener();
      return;
    }

    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  /** Manual sync: cancel the debounce + push immediately (forces a push). */
  async syncNow(): Promise<void> {
    // READER-GATE (M-critical): a reader can't force a push from the UI.
    if (this.role !== "writer") {
      return;
    }
    this.clearTimer();
    this.dirty = true;
    await this.flush();
  }

  /**
   * The role the engine currently holds. The hook reads this to gate its reader poll (only a reader
   * polls; a writer heartbeats inside the engine) and to short-circuit `takeOver()` when already a
   * writer.
   */
  getRole(): SyncRole {
    return this.role;
  }

  /**
   * The last-synced/applied `version` (from the persisted `localMeta`), or null if never synced. The
   * hook's reader poll compares the polled `read_lock_state.version` against this to decide whether
   * to pull the newer cloud scene.
   */
  getLocalVersion(): number | null {
    return this.localMeta?.version ?? null;
  }

  /**
   * Reader-poll companion (W03): pull the cloud row and apply it via the existing `applyCloud` path
   * (records it as the synced baseline + bumps `localMeta`). Used when the poll sees a `version`
   * newer than {@link getLocalVersion}. Best-effort: a pull error surfaces offline/error on the
   * status atom and is swallowed (the next poll retries). Reuses {@link repullAndReconcile} so the
   * pull/apply machinery is not duplicated.
   */
  async pullLatest(): Promise<void> {
    const userId = this.deps.getUserId();
    if (!userId) {
      return;
    }
    await this.repullAndReconcile(userId);
  }

  /**
   * The become-writer seam for the takeover flow (W03). Runs one `claim_board_lock`; on `acquired`
   * it promotes to writer (arming the heartbeat) and pulls the latest cloud scene if the claim's
   * `version` is newer than our baseline (§4 step 8 — the new writer must not push a stale scene
   * over the previous writer's just-flushed edits). Returns whether we won. On a lost claim it stays
   * reader; on an RPC error it stays reader and surfaces offline/error. Idempotent for a writer
   * (re-affirms the lock). The hook calls this after `request_takeover` once its poll sees the lock
   * free/expired (or immediately when the lock was already claimable).
   */
  async tryClaim(): Promise<boolean> {
    const getSessionId = this.deps.getSessionId;
    if (!getSessionId) {
      return false;
    }
    let result;
    try {
      result = await claimLock(this.deps.client, getSessionId());
    } catch (error) {
      this.deps.setStatus({
        status: isNetworkError(error) ? "offline" : "error",
        lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
        error: mapMessage(error),
      });
      return false;
    }

    if (!result.acquired) {
      // another session won the freed lock (decision #2 / §6.2): stay reader.
      this.becomeReader(
        result.holder.writerId,
        result.holder.writerSessionId,
        true,
        false,
      );
      return false;
    }

    // we won the lock. Pull the previous writer's flushed scene if it is newer than our baseline,
    // so our first push guards against the correct version (§4 step 8 / §6.5).
    if (
      result.version !== null &&
      (this.localMeta === null || result.version > this.localMeta.version)
    ) {
      await this.pullLatest();
    }
    this.becomeWriter(getSessionId(), result.holder.writerId);
    return true;
  }

  /**
   * Reader action: request the current writer hand off the lock (decision #2). Records the request
   * via `request_takeover` and returns whether the lock is *already* free/expired (the crashed- or
   * gone-writer fast path) — in which case the caller can claim immediately. The actual claim is
   * driven by the hook's poll loop (it owns the timers), so this method does NOT claim itself; it
   * only writes the request column. No-op (returns `false`) for a writer or without a session id.
   */
  async takeOver(): Promise<boolean> {
    if (this.role !== "reader") {
      return false;
    }
    const getSessionId = this.deps.getSessionId;
    if (!getSessionId) {
      return false;
    }
    try {
      const result = await requestTakeover(this.deps.client, getSessionId());
      return result.immediatelyClaimable;
    } catch (error) {
      this.deps.setStatus({
        status: isNetworkError(error) ? "offline" : "error",
        lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
        error: mapMessage(error),
      });
      return false;
    }
  }

  /**
   * Push now IF dirty (unload / unmount / handoff). Not gated by `LocalData.isSavePaused()`.
   *
   * Returns the flush-success boolean (M1): `true` only when the scene is committed and
   * `this.dirty === false` afterward (or there was nothing to push); `false` on any push failure.
   * The handoff (`performHandoff`) gates release/demote on this; fire-and-forget callers ignore it.
   */
  async flush(): Promise<boolean> {
    // READER-GATE (M-critical): a reader's unload/blur flush is a benign no-op. Returning `true`
    // (rather than false) so callers don't treat "I'm a reader, nothing to push" as a failure.
    if (this.role !== "writer") {
      return true;
    }
    if (!this.dirty) {
      // already in sync — nothing to commit, treated as success.
      return true;
    }
    if (this.inFlight) {
      // coalesce: let the in-flight push finish, then run once more and report ITS outcome so a
      // caller awaiting flush() during a concurrent push still learns the real result.
      this.rerunRequested = true;
      return true;
    }

    this.clearTimer();
    this.inFlight = true;
    let ok: boolean;
    try {
      ok = await this.pushScene();
    } finally {
      this.inFlight = false;
    }
    if (this.rerunRequested && this.dirty) {
      this.rerunRequested = false;
      ok = await this.flush();
    } else {
      this.rerunRequested = false;
    }
    return ok;
  }

  /** Release the lock (if writer), remove window listeners + clear all timers. */
  dispose(): void {
    void this.releaseIfWriter();
    this.clearTimer();
    this.clearHeartbeat();
    this.role = "reader";
    if (typeof window !== "undefined") {
      window.removeEventListener("offline", this.onOffline);
      window.removeEventListener("online", this.onOnline);
    }
    this.onlineListenerArmed = false;
  }

  // ---------------------------------------------------------------------------
  // pipelines
  // ---------------------------------------------------------------------------

  /** Applies a pulled cloud row + records it as the synced baseline. */
  private async applyCloud(cloud: BoardRow): Promise<void> {
    await this.deps.applyRemoteScene(cloud);
    this.localMeta = {
      version: cloud.version,
      lastSyncedAt: Date.now(),
    };
    this.saveMeta();
    // baseline the dirty-check against the just-applied cloud scene
    this.lastSyncedSnapshot = sceneSnapshot(cloud.document, cloud.app_state);
    this.deps.setStatus({
      status: "synced",
      lastSyncedAt: this.localMeta.lastSyncedAt,
      error: null,
    });
  }

  /**
   * The gated public push entry. READER-GATE (M-critical, belt-and-suspenders): a reader must never
   * reach the push pipeline. Returns `true` (benign no-op — nothing to push as a reader) so a
   * caller awaiting it doesn't treat the gate as a failure. Writers delegate to {@link pushScene}.
   */
  private async runPush(): Promise<boolean> {
    if (this.role !== "writer") {
      return true;
    }
    return this.pushScene();
  }

  /**
   * The push pipeline: files FIRST, then the version-guarded row write. UNGATED — callers
   * (`runPush`/`flush` via the gate, and the start() bootstrap insert before the claim) decide who
   * may reach it.
   *
   * Flush-success contract (M1): returns `true` ONLY on the success path (after `this.dirty = false`
   * and the `synced` status); `false` on every failure / no-commit branch (signed out, file upload
   * error, current-scene image errored, version conflict, thrown push error, first-insert
   * uniqueness race). Leaves `dirty` true on any failure so the next change / reconnect / syncNow
   * retries.
   */
  private async pushScene(): Promise<boolean> {
    const userId = this.deps.getUserId();
    if (!userId) {
      // signed out: drop to local-only, keep dirty for the next sign-in
      return false;
    }

    this.deps.setStatus({
      status: "syncing",
      lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
      error: null,
    });

    const { elements, appState, files } = this.deps.getScene();

    // 1) FILES FIRST
    let erroredFiles: Map<FileId, unknown>;
    try {
      const res = await this.deps.fileManager.saveFiles({ elements, files });
      erroredFiles = res.erroredFiles;
    } catch (error) {
      this.deps.setStatus({
        status: isNetworkError(error) ? "offline" : "error",
        lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
        error: mapMessage(error),
      });
      // clear the no-retry latch so a later flush can re-attempt the upload
      this.deps.fileManager.reset();
      return false;
    }

    const sceneFileIds = collectSceneFileIds(elements);
    const currentSceneErrored = [...erroredFiles.keys()].filter((id) =>
      sceneFileIds.has(id),
    );

    if (currentSceneErrored.length > 0) {
      this.deps.setStatus({
        status:
          typeof navigator !== "undefined" && navigator.onLine === false
            ? "offline"
            : "error",
        lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
        error: "Sync failed: couldn't upload image",
      });
      // do NOT bump version, do NOT clear dirty — stay dirty for retry.
      // reset() clears `erroredFiles_save` so the retry isn't blocked (FileManager.ts:107).
      this.deps.fileManager.reset();
      return false;
    }

    // 2) ROW SECOND
    const expectedVersion = this.localMeta?.version ?? null;
    let result: { ok: true; version: number } | { ok: false; conflict: true };
    try {
      result = await pushBoard(
        this.deps.client,
        userId,
        serializeScene(elements, appState),
        expectedVersion,
      );
    } catch (error) {
      // first-insert race: another device inserted the row first → repull + reconcile.
      if (expectedVersion === null && isUniquenessRace(error)) {
        await this.repullAndReconcile(userId);
        // nothing of OURS committed this pass — not a flush success.
        return false;
      }
      this.deps.setStatus({
        status: isNetworkError(error) ? "offline" : "error",
        lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
        error: mapMessage(error),
      });
      return false;
    }

    if (result.ok === false) {
      // version conflict: a racing writer advanced the version → repull + reconcile (no clobber).
      await this.repullAndReconcile(userId);
      return false;
    }

    // success
    this.localMeta = { version: result.version, lastSyncedAt: Date.now() };
    this.saveMeta();
    this.lastSyncedSnapshot = sceneSnapshot(elements, appState);
    this.dirty = false;
    this.deps.setStatus({
      status: "synced",
      lastSyncedAt: this.localMeta.lastSyncedAt,
      error: null,
    });
    return true;
  }

  /**
   * Re-pull on conflict and reconcile via LWW. The cloud row has a newer version, so we apply it
   * and record it as the baseline. We deliberately leave `dirty` untouched: if there were local
   * edits, the next `notifyChange()` re-pushes them against the now-current version (avoiding both
   * a clobber and a recursive re-push loop).
   */
  private async repullAndReconcile(userId: string): Promise<void> {
    try {
      const cloud = await pullBoard(this.deps.client, userId);
      if (cloud === null) {
        // the row vanished (deleted elsewhere) — fall back to re-inserting our local scene
        this.localMeta = null;
        this.saveMeta();
        return;
      }
      await this.applyCloud(cloud);
    } catch (error) {
      this.deps.setStatus({
        status: isNetworkError(error) ? "offline" : "error",
        lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
        error: mapMessage(error),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // lock lifecycle (single-writer / multi-reader)
  // ---------------------------------------------------------------------------

  /**
   * One `claim_board_lock` attempt at start() (decision #1: open with a free lock → auto-writer;
   * open with a live holder → reader; no claim-retry loop). Without a `getSessionId` dep the engine
   * cannot claim and stays a reader (the safe default). A failed RPC stays a reader, never throws
   * out of start().
   */
  private async claimWriterLock(): Promise<void> {
    const getSessionId = this.deps.getSessionId;
    if (!getSessionId) {
      // no session identity wired (e.g. back-compat caller) — cannot hold a lock; stay reader.
      this.becomeReader(null, null, false, false);
      return;
    }

    try {
      const result = await claimLock(this.deps.client, getSessionId());
      if (result.acquired) {
        this.becomeWriter(getSessionId(), result.holder.writerId);
      } else {
        // a live holder owns it → reader. (The reader poll loop is W03's hook; the engine just
        // stays a reader and never pushes.)
        this.becomeReader(
          result.holder.writerId,
          result.holder.writerSessionId,
          true,
          false,
        );
      }
    } catch (error) {
      // a failed claim RPC (network / permission) — don't optimistically promote; stay reader and
      // surface offline/error. A reader that can't claim simply cannot push.
      this.deps.setStatus({
        status: isNetworkError(error) ? "offline" : "error",
        lastSyncedAt: this.localMeta?.lastSyncedAt ?? null,
        error: mapMessage(error),
      });
      this.becomeReader(null, null, false, false);
    }
  }

  /** Promote to writer: arm the heartbeat + publish the lock state. */
  private becomeWriter(writerSessionId: string, writerId: string | null): void {
    this.role = "writer";
    this.startHeartbeat();
    this.pushLockState({
      role: "writer",
      writerId,
      writerSessionId,
      lockLive: true,
      takeoverRequested: false,
    });
  }

  /** Demote to / stay reader: stop the heartbeat + publish the lock state. */
  private becomeReader(
    writerId: string | null,
    writerSessionId: string | null,
    lockLive: boolean,
    takeoverRequested: boolean,
  ): void {
    this.role = "reader";
    this.clearHeartbeat();
    this.pushLockState({
      role: "reader",
      writerId,
      writerSessionId,
      lockLive,
      takeoverRequested,
    });
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      void this.heartbeat();
    }, HEARTBEAT_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Writer heartbeat (every {@link HEARTBEAT_MS}). Calls `renew_board_lock`:
   * - RPC throws (network) → do NOT demote; keep role optimistically (the server lease is the
   *   source of truth; if we're truly offline it expires server-side). Retry next tick. Only a
   *   *successful* RPC returning `still_writer === false` is a real loss.
   * - `still_writer === false` → we lost the lock (taken over / lease expired while away) → demote.
   * - a LIVE `takeover_requested_by` (not our own session) → run the graceful handoff.
   * - otherwise → still writer; refresh the lock state (carry any takeover flag for the UI).
   */
  private async heartbeat(): Promise<void> {
    if (this.role !== "writer") {
      return;
    }
    const getSessionId = this.deps.getSessionId;
    if (!getSessionId) {
      return;
    }
    const sessionId = getSessionId();

    let result;
    try {
      result = await renewLock(this.deps.client, sessionId);
    } catch {
      // network failure — never demote on a single failed renew (don't thrash a flaky network).
      return;
    }

    if (result.stillWriter === false) {
      // lost the lock (someone took over / the lease expired while we were away). Demote and stop
      // pushing — the version guard in pushBoard also protects, but we stop clobbering here.
      this.becomeReader(null, null, false, false);
      return;
    }

    const takeoverBy = result.takeoverRequestedBy;
    if (takeoverBy !== null && takeoverBy !== sessionId) {
      // a reader requested a graceful handoff.
      await this.performHandoff();
      return;
    }

    // still the writer — refresh the published state (carry the takeover flag for the UI, if any).
    this.pushLockState({
      role: "writer",
      writerId: this.deps.getUserId(),
      writerSessionId: sessionId,
      lockLive: true,
      takeoverRequested: takeoverBy !== null,
    });
  }

  /**
   * Graceful handoff (writer saw a takeover request) — M1, flush-success gated.
   * Runs while still `role === "writer"`, so the reader-gate does NOT block the final flush.
   * - `flush()` returns `true` (final edits committed, `dirty === false`) → `release_board_lock`
   *   → demote to reader. The requester (W03 hook) then claims + pulls the just-flushed scene.
   * - `flush()` returns `false` (push failed: network/file/conflict) → do NOT release, do NOT
   *   demote: stay writer + dirty, leave `takeover_requested_by` set, and let the next heartbeat
   *   re-enter and retry. (The status atom already shows error/offline from the failed push.)
   */
  private async performHandoff(): Promise<void> {
    const getSessionId = this.deps.getSessionId;
    if (!getSessionId) {
      return;
    }

    const ok = await this.flush();
    if (!ok) {
      // failed-flush branch (M1): scene did NOT commit. Stay writer + dirty; retry next heartbeat.
      return;
    }

    try {
      await releaseLock(this.deps.client, getSessionId());
    } catch {
      // couldn't release (network) — stay writer; the next heartbeat retries the handoff. The
      // lease (un-renewable while the request stands) decays to expiry as the safety net.
      return;
    }

    // flush committed + lock released → demote to reader.
    this.becomeReader(null, null, false, false);
  }

  /** Best-effort `release_board_lock` if we currently hold it (stop/dispose). Swallows errors. */
  private async releaseIfWriter(): Promise<void> {
    if (this.role !== "writer") {
      return;
    }
    const getSessionId = this.deps.getSessionId;
    if (!getSessionId) {
      return;
    }
    try {
      await releaseLock(this.deps.client, getSessionId());
    } catch {
      // best-effort — the server lease expires as the fallback.
    }
  }

  /** Mirror the lock/role state out to the UI (no-op if no `setLock` dep wired). */
  private pushLockState(lock: SyncLockState): void {
    this.deps.setLock?.(lock);
  }
}
