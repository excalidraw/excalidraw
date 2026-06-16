import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { isInitializedImageElement } from "@excalidraw/element";
import { EVENT } from "@excalidraw/common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FileId } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtomValue, useSetAtom } from "../../app-jotai";

import {
  SUPABASE_LOCK_POLL_MS,
  SUPABASE_TAKEOVER_ACK_GRACE_MS,
} from "../../app_constants";

import { updateStaleImageStatuses } from "../FileManager";

import { readLockState } from "./boardRepository";
import { getSupabaseClient } from "./client";
import { isSupabaseSyncEnabled } from "./featureFlags";
import { getSessionId, lockAtom } from "./lockAtom";
import { useInitSupabaseSession, userIdAtom } from "./sessionAtom";
import { createSupabaseFileManager } from "./supabaseFiles";
import { SyncEngine } from "./syncEngine";
import { syncStatusAtom } from "./syncStatusAtom";

import type { BoardRow } from "./boardRepository";
import type { LockState, SyncRole } from "./lockAtom";
import type { SyncStatus } from "./syncStatusAtom";

const DEFAULT_LOCK_STATE: LockState = {
  role: "reader",
  writerId: null,
  writerSessionId: null,
  lockLive: false,
  takeoverRequested: false,
  holderIsMe: false,
  takeoverInFlight: false,
};

export interface UseSupabaseSyncResult {
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** flush the pending debounce + push immediately (button / menu "Sync now") */
  syncNow: () => Promise<void>;
  /** called from App.tsx onChange; no-op when flag off / signed-out */
  notifyChange: () => void;
  /** the single-writer/multi-reader role this session holds (`reader` when flag off). */
  role: SyncRole;
  /**
   * `true` ⇒ pass `viewModeEnabled` to `<Excalidraw>` (HARD read-only). Only ever true when the flag
   * is on + signed in + this session is a reader; `false` when the flag is off so the app is
   * unaffected.
   */
  viewModeEnabled: boolean;
  /** the full lock/presence state for the UI (banner / status button). */
  lock: LockState;
  /** reader action: request the current writer hand off the lock (decision #2). */
  takeOver: () => Promise<void>;
}

/**
 * Thin React adapter owning one framework-free {@link SyncEngine}. It is the seam between the
 * editor (`excalidrawAPI`) and the engine: it builds the Supabase `FileManager`, implements
 * `applyRemoteScene` (the only DOM-mutating step — `updateScene` + file load), wires the engine's
 * status into `syncStatusAtom`, starts/stops on login/logout, and flushes on unload/unmount.
 *
 * Holds NO debounce / status / retry logic itself — that all lives in the engine. When the feature
 * flag is off (or the client/user is absent) the hook is a safe no-op: no engine is constructed,
 * the status stays `idle`, and `syncNow`/`notifyChange` do nothing. All hooks are still called
 * unconditionally (Rules of Hooks); gating happens inside the effects.
 */
export const useSupabaseSync = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}): UseSupabaseSyncResult => {
  // Boot the auth listener (no-ops when the flag is off / client null).
  useInitSupabaseSession();

  const userId = useAtomValue(userIdAtom);
  const statusState = useAtomValue(syncStatusAtom);
  const setStatus = useSetAtom(syncStatusAtom);
  const lock = useAtomValue(lockAtom);
  const setLockState = useSetAtom(lockAtom);

  // Spinner visibility is purely presentational and does NOT delay the actual
  // sync — the engine completes immediately. On each transition INTO "syncing"
  // we run the loader for ~1.5s so a fast push doesn't make it flash. The timer
  // lives in a ref so a later status change (e.g. syncing→synced) does NOT
  // cancel it; otherwise the spinner could get stuck on. A real error/offline
  // status always supersedes the spinner immediately.
  const [spinnerVisible, setSpinnerVisible] = useState(false);
  const prevStatusRef = useRef<SyncStatus>(statusState.status);
  const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const enteredSyncing =
      statusState.status === "syncing" && prevStatusRef.current !== "syncing";
    prevStatusRef.current = statusState.status;
    if (!enteredSyncing) {
      return;
    }
    setSpinnerVisible(true);
    if (spinnerTimerRef.current) {
      clearTimeout(spinnerTimerRef.current);
    }
    spinnerTimerRef.current = setTimeout(() => {
      spinnerTimerRef.current = null;
      setSpinnerVisible(false);
    }, 1500);
  }, [statusState.status]);

  // Clear any pending spinner timer on unmount.
  useEffect(
    () => () => {
      if (spinnerTimerRef.current) {
        clearTimeout(spinnerTimerRef.current);
      }
    },
    [],
  );

  const displayStatus: SyncStatus =
    spinnerVisible &&
    statusState.status !== "error" &&
    statusState.status !== "offline"
      ? "syncing"
      : statusState.status;

  // The supabase client is a stable singleton (memoized in client.ts); null when flag off / env
  // missing. Resolve it once per render so effects can key on it.
  const client = getSupabaseClient();

  // Compose the Supabase FileManager internally (M2: factory wires onFileStatusChange so image
  // status renders). Rebuilt only when the client or signed-in user changes.
  const fileManager = useMemo(() => {
    if (!isSupabaseSyncEnabled() || !client || !userId) {
      return null;
    }
    return createSupabaseFileManager(client, userId);
  }, [client, userId]);

  // Keep the latest excalidrawAPI / userId in refs so the engine's getScene/getUserId callbacks
  // (created once at construction) never read stale values.
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(
    excalidrawAPI,
  );
  excalidrawAPIRef.current = excalidrawAPI;
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  // The hook IMPLEMENTS applyRemoteScene; the engine CALLS it (B1). Applies a pulled cloud row to
  // the live editor: scene first (background pull → CaptureUpdateAction.NEVER, no undo entry), then
  // the file load mirroring App.tsx's local initial-load path (fileIds reduce + getFiles → addFiles
  // → updateStaleImageStatuses).
  const applyRemoteScene = useCallback(
    async (row: BoardRow) => {
      if (!excalidrawAPI || !fileManager) {
        return;
      }

      // Applying a remote scene must NOT move the local viewport: a reader
      // watching the writer's changes (or a writer pulling on login) should keep
      // their own pan/zoom. restoreAppState normalizes viewport fields (e.g.
      // zoom→default, scroll→0) from the cloud row, which would yank the camera,
      // so overlay the current scrollX/scrollY/zoom back on.
      const currentAppState = excalidrawAPI.getAppState();
      const restoredAppState = restoreAppState(row.app_state, currentAppState);
      excalidrawAPI.updateScene({
        elements: restoreElements(row.document, null),
        appState: {
          ...restoredAppState,
          scrollX: currentAppState.scrollX,
          scrollY: currentAppState.scrollY,
          zoom: currentAppState.zoom,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      // mirrors App.tsx:463-469 (fileIds reduce) + App.tsx:496-509 (getFiles → addFiles →
      // updateStaleImageStatuses)
      const fileIds = row.document.reduce((acc, element) => {
        if (isInitializedImageElement(element)) {
          return acc.concat(element.fileId);
        }
        return acc;
      }, [] as FileId[]);

      if (!fileIds.length) {
        return;
      }

      const { loadedFiles, erroredFiles } = await fileManager.getFiles(fileIds);
      if (loadedFiles.length) {
        excalidrawAPI.addFiles(loadedFiles);
      }
      updateStaleImageStatuses({
        excalidrawAPI,
        erroredFiles,
        elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
      });
    },
    [excalidrawAPI, fileManager],
  );

  const engineRef = useRef<SyncEngine | null>(null);

  // Takeover bookkeeping for the reader poll (refs so the poll interval reads live values without
  // re-arming): `pending` ⇒ this session clicked Take over and is waiting to claim a freed lock;
  // `deadline` ⇒ the ACK_GRACE epoch-ms after which a still-live writer is reported as "couldn't take
  // over" (a live lease is never forcibly stolen — §4 timeout terminal).
  const takeoverPendingRef = useRef(false);
  const takeoverDeadlineRef = useRef<number | null>(null);

  // Construct the engine once (per client + fileManager). The getScene/getUserId callbacks read the
  // refs so they always see the latest editor + user without re-creating the engine.
  useEffect(() => {
    if (!isSupabaseSyncEnabled() || !client || !fileManager) {
      return;
    }

    const engine = new SyncEngine({
      client,
      getUserId: () => userIdRef.current,
      fileManager,
      getScene: () => ({
        elements:
          excalidrawAPIRef.current?.getSceneElementsIncludingDeleted() ?? [],
        appState: excalidrawAPIRef.current?.getAppState() ?? {},
        files: excalidrawAPIRef.current?.getFiles() ?? {},
      }),
      setStatus,
      applyRemoteScene,
      getSessionId,
      // The engine owns role/holder/liveness; the hook decorates each push with the two UI bits the
      // engine doesn't track. `holderIsMe` is derived from our session id; `takeoverInFlight` is
      // hook-owned and cleared the moment we become the writer (the takeover completed), otherwise
      // preserved (functional update reads the previous value so this stays dependency-free/stable).
      setLock: (next) =>
        setLockState((prev) => ({
          ...next,
          holderIsMe:
            next.writerSessionId !== null &&
            next.writerSessionId === getSessionId(),
          takeoverInFlight:
            next.role === "writer" ? false : prev.takeoverInFlight,
        })),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      // reset role/presence so a torn-down engine never leaves the UI in reader/view-only.
      setLockState(DEFAULT_LOCK_STATE);
    };
    // setStatus / setLockState are stable jotai setters; getSessionId is a stable module fn;
    // applyRemoteScene is re-created with excalidrawAPI which is read via the ref, so it is
    // intentionally excluded to avoid needless engine churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, fileManager]);

  // Pull-on-login / stop-on-logout. start() runs the initial pull + reconcile and applies via the
  // injected applyRemoteScene.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }
    if (userId) {
      void engine.start(userId);
    } else {
      engine.stop();
    }
    // engineRef.current is set by the construction effect above; re-run when either changes.
  }, [userId, fileManager]);

  // Reader poll loop (§2): while signed in + flag on + this session is a READER, poll
  // `read_lock_state` every SUPABASE_LOCK_POLL_MS. Each tick: (1) mirror the holder/liveness into
  // lockAtom (role stays reader — only the engine's start()/tryClaim() flips role to writer); (2) if
  // the cloud `version` advanced beyond our applied baseline, pull + apply the newer scene; (3) drive
  // the pending takeover claim (lock free/expired → claim; ACK_GRACE elapsed but still live → give
  // up). A writer never polls here — it heartbeats inside the engine — so the effect re-arms on role
  // changes and the interval body re-checks the engine's live role.
  useEffect(() => {
    if (!isSupabaseSyncEnabled() || !client || !userId) {
      return;
    }
    if (lock.role !== "reader") {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const engine = engineRef.current;
      if (!engine || engine.getRole() !== "reader") {
        return;
      }
      let state;
      try {
        state = await readLockState(client);
      } catch {
        // transient poll failure (offline / RPC error): keep the last-known role + scene; the next
        // tick retries. No role change on a failed poll (the server lease is the source of truth).
        return;
      }
      if (cancelled || engineRef.current !== engine) {
        return;
      }

      // (1) mirror presence/liveness into the atom (role stays reader; the engine owns promotion).
      setLockState((prev) => ({
        ...prev,
        role: "reader",
        writerId: state.writerId,
        writerSessionId: state.writerSessionId,
        lockLive: state.lockLive,
        takeoverRequested: state.takeoverRequestedBy !== null,
        holderIsMe:
          state.writerSessionId !== null &&
          state.writerSessionId === getSessionId(),
      }));

      // (2) version advanced in the cloud → pull + apply the newer scene (reuses applyRemoteScene).
      const localVersion = engine.getLocalVersion();
      if (
        state.version !== null &&
        (localVersion === null || state.version > localVersion)
      ) {
        await engine.pullLatest();
      }

      // (3) drive a pending takeover (the user clicked Take over and we're waiting to claim).
      if (takeoverPendingRef.current) {
        if (!state.lockLive) {
          // lock is free/expired (graceful release OR crashed-writer lease expiry) → claim now.
          takeoverPendingRef.current = false;
          takeoverDeadlineRef.current = null;
          await engine.tryClaim(); // on `acquired` the engine flips role → writer + clears the flag
        } else if (
          takeoverDeadlineRef.current !== null &&
          Date.now() >= takeoverDeadlineRef.current
        ) {
          // ACK_GRACE elapsed but the writer is still renewing (lease live) — do NOT steal a live
          // lease (§4 timeout terminal). Surface the give-up by clearing the in-flight flag.
          takeoverPendingRef.current = false;
          takeoverDeadlineRef.current = null;
          setLockState((prev) => ({ ...prev, takeoverInFlight: false }));
        }
      }
    };

    const interval = setInterval(() => {
      void poll();
    }, SUPABASE_LOCK_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // setLockState / getSessionId are stable; the poll reads the engine + refs imperatively. Re-arm
    // when sign-in or role changes (role flip to writer tears the poll down).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, userId, lock.role]);

  // Best-effort network flush on unload / tab-hidden / blur (mirrors LocalData.flushSave events).
  useEffect(() => {
    if (!isSupabaseSyncEnabled()) {
      return;
    }
    const flush = () => {
      void engineRef.current?.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, flush);
    window.addEventListener(EVENT.BLUR, flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, flush);
      window.removeEventListener(EVENT.BLUR, flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

  const syncNow = useCallback(
    () => engineRef.current?.syncNow() ?? Promise.resolve(),
    [],
  );
  const notifyChange = useCallback(() => {
    engineRef.current?.notifyChange();
  }, []);

  // Reader action: request a graceful handoff (decision #2). Mark in-flight, write the request
  // column via the engine. If the lock is ALREADY free/expired (crashed/gone writer fast path),
  // claim immediately; otherwise arm the ACK_GRACE deadline + pending flag and let the poll loop
  // claim the moment the writer releases (or its lease lapses). The engine flips role → writer on a
  // won claim (which clears `takeoverInFlight` via the setLock adapter).
  const takeOver = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || engine.getRole() !== "reader") {
      return;
    }
    setLockState((prev) => ({ ...prev, takeoverInFlight: true }));
    takeoverPendingRef.current = true;
    takeoverDeadlineRef.current = Date.now() + SUPABASE_TAKEOVER_ACK_GRACE_MS;

    const immediatelyClaimable = await engine.takeOver();
    if (engineRef.current !== engine) {
      return;
    }
    if (immediatelyClaimable) {
      // no live writer to wait on — claim on the spot (the poll would also catch this next tick).
      takeoverPendingRef.current = false;
      takeoverDeadlineRef.current = null;
      await engine.tryClaim();
    }
    // else: the poll loop drives the claim once `read_lock_state` reports the lock free/expired.
    // setLockState / getSessionId are stable; the refs are read imperatively by the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // viewModeEnabled drives the controlled `<Excalidraw viewModeEnabled>` prop (HARD read-only).
  // Only meaningful with the flag ON + signed in; when the flag is off the engine is never built so
  // lockAtom stays at its reader default — gate on the flag so the app is identical to today.
  const viewModeEnabled =
    isSupabaseSyncEnabled() && !!userId && lock.role === "reader";

  return {
    // displayStatus floors the visible "syncing" duration (see effect above);
    // lastSyncedAt/error still come straight from the atom.
    status: displayStatus,
    lastSyncedAt: statusState.lastSyncedAt,
    syncNow,
    notifyChange,
    role: lock.role,
    viewModeEnabled,
    lock,
    takeOver,
  };
};
