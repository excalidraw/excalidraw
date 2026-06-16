import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

import type {
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../../app_constants";

import { Provider, appJotaiStore } from "../../app-jotai";

import { sessionAtom } from "../../data/supabase/sessionAtom";
import { syncStatusAtom } from "../../data/supabase/syncStatusAtom";
import { lockAtom } from "../../data/supabase/lockAtom";

import { useSupabaseSync } from "../../data/supabase/useSupabaseSync";

import { SyncEngine } from "../../data/supabase/syncEngine";

import {
  claimLock,
  pullBoard,
  pushBoard,
  readLockState,
  releaseLock,
  renewLock,
  requestTakeover,
  serializeScene,
} from "../../data/supabase/boardRepository";

import { createSupabaseFileManager } from "../../data/supabase/supabaseFiles";

import { getSupabaseClient } from "../../data/supabase/client";

import { getSession } from "../../data/supabase/auth";

import type { Session, SupabaseClient } from "@supabase/supabase-js";

import type {
  BoardRow,
  ClaimLockResult,
  LockStateResult,
  PushResult,
  RenewLockResult,
  RequestTakeoverResult,
} from "../../data/supabase/boardRepository";
import type {
  SyncEngineDeps,
  SyncLockState,
} from "../../data/supabase/syncEngine";
import type { FileManager } from "../../data/FileManager";

// ===========================================================================
// W05 — single-writer / multi-reader CONSOLIDATED behavioral safety net.
//
// This file is the cross-cutting verification pass for the single-writer feature
// (design `07-single-writer-design.md` §3 state machine, §4 handoff, §6 edge cases).
// It deliberately re-asserts the load-bearing invariants at the INTEGRATION SEAM,
// at the right level for each:
//   • role / viewModeEnabled / reader-gate / takeOver / server-clock-liveness
//     → HOOK level (renderHook), mirroring useSupabaseSync.test.tsx — this is where
//       the role atom, the reader poll, and takeOver actually live.
//   • flush-success-on-handoff (M1, both branches) → ENGINE level (direct SyncEngine
//     + fake timers), mirroring syncEngine.test.ts — the handoff is engine-owned and
//     the success/fail flush branch is only observable there.
//
// The mock harness is reused verbatim from the two existing tests (proven setup):
// the client / boardRepository (incl. the lock RPC wrappers) / supabaseFiles / auth
// modules are mocked, env is stubbed on, getSessionId is stubbed, and the lock
// poll/ack constants are shrunk so the hook-level flows resolve under waitFor with
// REAL timers.
// ===========================================================================

// The client is a STABLE non-null object — the real network calls go through the
// mocked boardRepository / fileManager. Stable identity keeps the hook's effect deps
// from churning across renders.
const stableClient = { __supabaseMockClient: true };
vi.mock("../../data/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => stableClient as unknown),
}));

// The engine + hook import these directly. serializeScene is real-ish so the engine's
// dirty-check snapshot behaves; the lock RPC wrappers are mocked so the claim-on-start,
// reader poll, takeover, and handoff flows are driven without a real Supabase.
vi.mock("../../data/supabase/boardRepository", () => ({
  pullBoard: vi.fn(),
  pushBoard: vi.fn(),
  claimLock: vi.fn(),
  renewLock: vi.fn(),
  releaseLock: vi.fn(),
  requestTakeover: vi.fn(),
  readLockState: vi.fn(),
  serializeScene: vi.fn(
    (elements: readonly OrderedExcalidrawElement[], appState: unknown) => ({
      document: elements.filter((el) => !el.isDeleted),
      app_state: appState ?? {},
    }),
  ),
}));

// Shrink the lock poll / ack-grace intervals so the reader-poll + takeover tests
// resolve under waitFor's window with REAL timers (the rest of app_constants —
// notably the 5s heartbeat used by the engine-level fake-timer block — is preserved
// via importActual).
vi.mock("../../app_constants", async () => {
  const actual = await vi.importActual<typeof import("../../app_constants")>(
    "../../app_constants",
  );
  return {
    ...actual,
    SUPABASE_LOCK_POLL_MS: 20,
    SUPABASE_TAKEOVER_ACK_GRACE_MS: 60,
  };
});

// The hook builds its FileManager via this factory. Return a mock with
// getFiles/saveFiles/reset.
const fileManagerMock = {
  getFiles: vi.fn(),
  saveFiles: vi.fn(async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  })),
  reset: vi.fn(),
} as unknown as FileManager & {
  getFiles: Mock;
  saveFiles: Mock;
  reset: Mock;
};

vi.mock("../../data/supabase/supabaseFiles", () => ({
  createSupabaseFileManager: vi.fn(() => fileManagerMock),
}));

// `useInitSupabaseSession` boots the session from getSession() and subscribes via
// onAuthStateChange. We drive login through getSession's resolved session.
vi.mock("../../data/supabase/auth", () => ({
  getSession: vi.fn(async () => null),
  onAuthStateChange: vi.fn(() => () => {}),
  signInWithMagicLink: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({ error: null })),
}));

const pullBoardMock = pullBoard as unknown as Mock;
const pushBoardMock = pushBoard as unknown as Mock;
const claimLockMock = claimLock as unknown as Mock;
const renewLockMock = renewLock as unknown as Mock;
const releaseLockMock = releaseLock as unknown as Mock;
const readLockStateMock = readLockState as unknown as Mock;
const requestTakeoverMock = requestTakeover as unknown as Mock;
const serializeSceneMock = serializeScene as unknown as Mock;
const createSupabaseFileManagerMock =
  createSupabaseFileManager as unknown as Mock;
const getSupabaseClientMock = getSupabaseClient as unknown as Mock;
const getSessionMock = getSession as unknown as Mock;

const USER_ID = "user-123";
const FILE_ID = "file-1" as FileId;
const SESSION_ID = "session-self";
const OTHER_SESSION = "session-other";
const HEARTBEAT_MS = 5000;
const DEBOUNCE_MS = 2000;

// Stub the per-tab session id so claim/poll holder comparisons are deterministic.
vi.mock("../../data/supabase/lockAtom", async () => {
  const actual = await vi.importActual<
    typeof import("../../data/supabase/lockAtom")
  >("../../data/supabase/lockAtom");
  return {
    ...actual,
    getSessionId: vi.fn(() => SESSION_ID),
  };
});

const writerClaim = (): ClaimLockResult => ({
  acquired: true,
  holder: { writerId: USER_ID, writerSessionId: SESSION_ID },
  lockExpiresAt: "2026-01-01T00:00:25Z",
  version: 1,
});

const readerClaim = (): ClaimLockResult => ({
  acquired: false,
  holder: { writerId: "other-user", writerSessionId: OTHER_SESSION },
  lockExpiresAt: "2026-01-01T00:00:25Z",
  version: 3,
});

const lockState = (over: Partial<LockStateResult> = {}): LockStateResult => ({
  version: 3,
  writerId: "other-user",
  writerSessionId: OTHER_SESSION,
  lockLive: true,
  takeoverRequestedBy: null,
  serverNow: "2026-01-01T00:00:10Z",
  ...over,
});

const takeoverResult = (
  over: Partial<RequestTakeoverResult> = {},
): RequestTakeoverResult => ({
  immediatelyClaimable: false,
  writerSessionId: OTHER_SESSION,
  lockExpiresAt: "2026-01-01T00:00:25Z",
  ...over,
});

const renewOk = (
  takeoverRequestedBy: string | null = null,
): RenewLockResult => ({
  stillWriter: true,
  takeoverRequestedBy,
  version: 1,
});

const makeSession = (): Session =>
  ({
    user: { id: USER_ID, email: "a@b.co" },
  } as unknown as Session);

const makeRect = (id: string): OrderedExcalidrawElement =>
  ({
    id,
    type: "rectangle",
    isDeleted: false,
  } as unknown as OrderedExcalidrawElement);

const makeImageRow = (): BoardRow => ({
  id: "board-1",
  user_id: USER_ID,
  name: "Untitled",
  document: [
    {
      id: "img-1",
      type: "image",
      fileId: FILE_ID,
      isDeleted: false,
    },
  ] as unknown as BoardRow["document"],
  app_state: { theme: "dark" },
  version: 5,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
});

const makeExcalidrawAPI = () =>
  ({
    updateScene: vi.fn(),
    addFiles: vi.fn(),
    getAppState: vi.fn(() => ({ theme: "light" })),
    getFiles: vi.fn(() => ({})),
    getSceneElements: vi.fn(() => []),
    getSceneElementsIncludingDeleted: vi.fn(() => []),
  } as unknown as ExcalidrawImperativeAPI & Record<string, Mock>);

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(Provider, { store: appJotaiStore }, children);

// ===========================================================================
// PART A — HOOK-LEVEL invariants (renderHook + REAL timers).
//   1. Two-session roles (claim won → writer / claim lost → reader).
//   2. Reader gate (a reader edit never pushes).
//   4. Takeover happy path (request → claim freed lock → writer + pulled scene).
//   5. Server-clock liveness (role follows readLockState.lockLive, no client math).
// ===========================================================================

describe("singleWriter (hook seam)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "true");
    vi.stubEnv("VITE_APP_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_APP_SUPABASE_ANON_KEY", "anon-test-key");

    // clear persisted localMeta so a prior test's version doesn't suppress the reader-poll pull.
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META);

    pullBoardMock.mockReset();
    pullBoardMock.mockResolvedValue(null);
    pushBoardMock.mockReset();
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);
    // lock RPC defaults: a fresh session wins the claim (writer); the poll sees a live holder.
    claimLockMock.mockReset();
    claimLockMock.mockResolvedValue(writerClaim());
    renewLockMock.mockReset();
    renewLockMock.mockResolvedValue(renewOk());
    releaseLockMock.mockReset();
    releaseLockMock.mockResolvedValue(undefined);
    readLockStateMock.mockReset();
    readLockStateMock.mockResolvedValue(lockState());
    requestTakeoverMock.mockReset();
    requestTakeoverMock.mockResolvedValue(takeoverResult());
    serializeSceneMock.mockClear();
    fileManagerMock.getFiles.mockReset();
    fileManagerMock.getFiles.mockResolvedValue({
      loadedFiles: [],
      erroredFiles: new Map<FileId, true>(),
    });
    fileManagerMock.saveFiles.mockClear();
    createSupabaseFileManagerMock.mockClear();
    getSupabaseClientMock.mockReturnValue(stableClient);
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue(null);

    // reset shared atoms between tests
    appJotaiStore.set(sessionAtom, null);
    appJotaiStore.set(syncStatusAtom, {
      status: "idle",
      lastSyncedAt: null,
      error: null,
    });
    appJotaiStore.set(lockAtom, {
      role: "reader",
      writerId: null,
      writerSessionId: null,
      lockLive: false,
      takeoverRequested: false,
      holderIsMe: false,
      takeoverInFlight: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("INVARIANT 1a: a session that WINS the claim becomes writer with viewModeEnabled === false", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(writerClaim()); // acquired:true → writer
    getSessionMock.mockResolvedValue(makeSession());

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
      expect(result.current.role).toBe("writer");
    });
    // a writer is NOT view-only and is reported as holding a live lock.
    expect(result.current.viewModeEnabled).toBe(false);
    expect(result.current.lock.lockLive).toBe(true);
    expect(result.current.lock.holderIsMe).toBe(true);

    // a writer never runs the reader poll (it heartbeats inside the engine instead).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(readLockStateMock).not.toHaveBeenCalled();
  });

  it("INVARIANT 1b: a session that LOSES the claim becomes reader with viewModeEnabled === true", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(readerClaim()); // acquired:false → reader
    getSessionMock.mockResolvedValue(makeSession());

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    // wait until start()'s claim resolved and published the OTHER holder (not just the reader default).
    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
      expect(result.current.lock.writerSessionId).toBe(OTHER_SESSION);
    });
    expect(result.current.role).toBe("reader");
    // a reader is HARD read-only (the prop the app passes to <Excalidraw>).
    expect(result.current.viewModeEnabled).toBe(true);
    expect(result.current.lock.holderIsMe).toBe(false);
  });

  it("INVARIANT 2: a reader's notifyChange does NOT push (no pushBoard, no saveFiles) and stays view-only", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(readerClaim());
    getSessionMock.mockResolvedValue(makeSession());

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
      expect(result.current.lock.writerSessionId).toBe(OTHER_SESSION);
    });
    expect(result.current.role).toBe("reader");

    // a reader's notifyChange must never reach the push pipeline (engine reader-gate at the
    // notifyChange/flush/syncNow/runPush chokepoints). Simulate a programmatic scene change.
    pushBoardMock.mockClear();
    fileManagerMock.saveFiles.mockClear();
    (excalidrawAPI.getSceneElementsIncludingDeleted as Mock).mockReturnValue([
      makeRect("reader-edit"),
    ]);

    await act(async () => {
      result.current.notifyChange();
      // also try to force a push from the UI — also gated.
      await result.current.syncNow();
      // give the debounce window a chance to (not) fire.
      await new Promise((r) => setTimeout(r, DEBOUNCE_MS + 60));
    });

    expect(pushBoardMock).not.toHaveBeenCalled();
    expect(fileManagerMock.saveFiles).not.toHaveBeenCalled();
    // still a reader / view-only — the gate did not change role.
    expect(result.current.role).toBe("reader");
    expect(result.current.viewModeEnabled).toBe(true);
  });

  it("INVARIANT 4: takeOver() → requestTakeover written, then a freed lock is claimed → role writer + flushed scene pulled", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValueOnce(readerClaim()); // start: lose the claim → reader
    getSessionMock.mockResolvedValue(makeSession());

    // while the writer still holds it, the poll reports a LIVE lock (so no premature claim).
    readLockStateMock.mockResolvedValue(lockState({ lockLive: true }));
    requestTakeoverMock.mockResolvedValue(
      takeoverResult({ immediatelyClaimable: false }),
    );

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    // settled as a reader before requesting takeover.
    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
      expect(result.current.lock.writerSessionId).toBe(OTHER_SESSION);
    });
    expect(result.current.role).toBe("reader");

    // click "Take over": writes the request + arms the pending claim.
    await act(async () => {
      await result.current.takeOver();
    });
    expect(requestTakeoverMock).toHaveBeenCalledWith(
      expect.anything(),
      SESSION_ID,
    );
    expect(result.current.lock.takeoverInFlight).toBe(true);

    // the previous writer flushes + releases → the next poll sees the lock FREE with a NEWER
    // version → the hook claims it (acquired) AND pulls the just-flushed scene.
    readLockStateMock.mockResolvedValue(
      lockState({
        lockLive: false,
        writerId: null,
        writerSessionId: null,
        version: 5,
      }),
    );
    claimLockMock.mockResolvedValue(writerClaim());
    // the claim's version (1) is < polled version (5), so the poll's version-advance path pulls
    // the flushed scene. Return an image row so applyRemoteScene → updateScene fires.
    pullBoardMock.mockResolvedValue(makeImageRow());

    await waitFor(
      () => {
        expect(claimLockMock).toHaveBeenCalledWith(
          expect.anything(),
          SESSION_ID,
        );
        expect(result.current.role).toBe("writer");
      },
      { timeout: 2000 },
    );
    // promoted: no longer view-only, the in-flight flag cleared, and the flushed scene was applied.
    expect(result.current.viewModeEnabled).toBe(false);
    expect(result.current.lock.takeoverInFlight).toBe(false);
    expect(excalidrawAPI.updateScene).toHaveBeenCalled();
  });

  it("INVARIANT 5a: role follows the SERVER lockLive verdict — lockLive:true (other writer) keeps a reader a reader", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(readerClaim());
    getSessionMock.mockResolvedValue(makeSession());

    // The server reports the lock LIVE (another session holds it). NO client-time math: even a
    // wildly skewed lockExpiresAt in the past must not promote us — only lockLive matters.
    readLockStateMock.mockResolvedValue(lockState({ lockLive: true }));

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.lock.writerSessionId).toBe(OTHER_SESSION);
    });

    // let several poll cycles run; lockLive:true ⇒ the reader never claims, stays view-only.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });
    await waitFor(() => {
      expect(readLockStateMock).toHaveBeenCalled();
    });
    expect(result.current.role).toBe("reader");
    expect(result.current.viewModeEnabled).toBe(true);
    expect(result.current.lock.lockLive).toBe(true);
    // crucially, with NO takeover requested a reader's poll never auto-claims (decision #1).
    expect(claimLockMock).toHaveBeenCalledTimes(1); // only the start() claim
  });

  it("INVARIANT 5b: role follows the SERVER lockLive verdict — after a takeover request, lockLive:false (lock dead) lets the requester claim", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValueOnce(readerClaim()); // start: reader
    getSessionMock.mockResolvedValue(makeSession());

    // request_takeover does NOT short-circuit (live writer at click time); the requester waits and
    // claims only when the SERVER says lockLive:false (the lease is dead), never via client math.
    requestTakeoverMock.mockResolvedValue(
      takeoverResult({ immediatelyClaimable: false }),
    );
    readLockStateMock.mockResolvedValue(
      lockState({ lockLive: false, writerId: null, writerSessionId: null }),
    );
    claimLockMock.mockResolvedValue(writerClaim());

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
    });
    expect(result.current.role).toBe("reader");

    await act(async () => {
      await result.current.takeOver();
    });

    // the dead-lock (lockLive:false) server verdict drives the claim → writer.
    await waitFor(
      () => {
        expect(result.current.role).toBe("writer");
      },
      { timeout: 2000 },
    );
    expect(result.current.viewModeEnabled).toBe(false);
  });
});

// ===========================================================================
// PART B — ENGINE-LEVEL invariant (direct SyncEngine + FAKE timers).
//   3. Flush-success on handoff (M1): a writer with a pending takeover demotes ONLY
//      after a flush that SUCCEEDS; a FAILED flush keeps it writer (no lost-edit window).
//
// This is asserted at the engine level (not the hook) because the handoff —
// renew sees takeover → flush → gate release/demote on the flush boolean — is
// entirely engine-owned and the success/fail branch is only observable here.
// ===========================================================================

interface EngineHarness {
  engine: SyncEngine;
  setLock: Mock;
  scene: {
    elements: OrderedExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  };
  locks: () => SyncLockState[];
}

const createdEngines: SyncEngine[] = [];

const createEngineHarness = (
  elements: OrderedExcalidrawElement[] = [],
): EngineHarness => {
  const scene = {
    elements,
    appState: { theme: "light" } as Partial<AppState>,
    files: {} as BinaryFiles,
  };
  const setStatus = vi.fn();
  const setLock = vi.fn();
  const applyRemoteScene = vi.fn(async () => {});
  const saveFiles = vi.fn(async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  }));
  const reset = vi.fn();
  const fileManager = { saveFiles, reset } as unknown as FileManager;

  const deps: SyncEngineDeps = {
    client: {} as SupabaseClient,
    getUserId: () => USER_ID,
    fileManager,
    getScene: () => scene,
    setStatus,
    applyRemoteScene,
    getSessionId: () => SESSION_ID,
    setLock,
  };
  const engine = new SyncEngine(deps);
  createdEngines.push(engine);

  return {
    engine,
    setLock,
    scene,
    locks: () => setLock.mock.calls.map((c) => c[0] as SyncLockState),
  };
};

const lastLock = (h: EngineHarness): SyncLockState | undefined => {
  const all = h.locks();
  return all[all.length - 1];
};

describe("singleWriter (engine handoff — M1 flush-success gate)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pullBoardMock.mockReset();
    pullBoardMock.mockResolvedValue(null);
    pushBoardMock.mockReset();
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);
    claimLockMock.mockReset();
    claimLockMock.mockResolvedValue(writerClaim()); // start() wins the claim → writer
    renewLockMock.mockReset();
    renewLockMock.mockResolvedValue(renewOk());
    releaseLockMock.mockReset();
    releaseLockMock.mockResolvedValue(undefined);
    serializeSceneMock.mockReset();
    serializeSceneMock.mockImplementation(
      (elements: readonly OrderedExcalidrawElement[], appState: unknown) => ({
        document: elements.filter((el) => !el.isDeleted),
        app_state: appState ?? {},
      }),
    );
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META);
  });

  afterEach(() => {
    // dispose every engine so its heartbeat interval / window listeners don't leak across tests.
    while (createdEngines.length > 0) {
      createdEngines.pop()?.dispose();
    }
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it("INVARIANT 3a: a pending takeover whose final flush SUCCEEDS → releaseLock called + demoted to reader", async () => {
    const h = createEngineHarness([]);
    await h.engine.start(USER_ID);
    expect(lastLock(h)).toMatchObject({ role: "writer" });

    // an unsynced edit (dirty; debounce NOT yet fired) so the handoff's OWN flush is what commits it.
    h.scene.elements = [makeRect("final-edit")];
    h.engine.notifyChange();
    pushBoardMock.mockClear();
    pushBoardMock.mockResolvedValue({ ok: true, version: 2 } as PushResult);

    // next heartbeat sees a takeover request from ANOTHER session → graceful handoff:
    // flush (commits the final edit) → release → demote.
    renewLockMock.mockResolvedValueOnce(renewOk("requester-session"));
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    // the final edit committed (a push happened) BEFORE the release, then we demoted to reader.
    expect(pushBoardMock).toHaveBeenCalled();
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
    expect(releaseLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
    expect(lastLock(h)).toMatchObject({ role: "reader", lockLive: false });
  });

  it("INVARIANT 3b: a pending takeover whose final flush FAILS → releaseLock NOT called, stays writer (no lost-edit window)", async () => {
    const h = createEngineHarness([]);
    await h.engine.start(USER_ID);
    expect(lastLock(h)).toMatchObject({ role: "writer" });

    // an unsynced edit + a push that FAILS (network) when the handoff flush runs.
    h.scene.elements = [makeRect("unsynced")];
    h.engine.notifyChange();
    pushBoardMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renewLockMock.mockResolvedValueOnce(renewOk("requester-session"));
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    // M1: the flush returned false → NO release, NO demote. The writer keeps the lock + its dirty
    // edits — a requester can never pull a pre-flush scene from a still-recoverable writer.
    expect(releaseLockMock).not.toHaveBeenCalled();
    expect(lastLock(h)).toMatchObject({ role: "writer" });

    // and the handoff is retried: once connectivity returns, the NEXT heartbeat completes it.
    pushBoardMock.mockResolvedValue({ ok: true, version: 2 } as PushResult);
    renewLockMock.mockResolvedValueOnce(renewOk("requester-session"));
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(releaseLockMock).toHaveBeenCalledTimes(1);
    expect(lastLock(h)).toMatchObject({ role: "reader" });
  });
});
