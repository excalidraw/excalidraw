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

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { SUPABASE_SYNC_DEBOUNCE_MS, STORAGE_KEYS } from "../../app_constants";

import {
  claimLock,
  pullBoard,
  pushBoard,
  releaseLock,
  renewLock,
  serializeScene,
} from "../../data/supabase/boardRepository";

import { SyncEngine } from "../../data/supabase/syncEngine";

import type {
  BoardRow,
  ClaimLockResult,
  PushResult,
  RenewLockResult,
} from "../../data/supabase/boardRepository";
import type {
  SyncEngineDeps,
  SyncLockState,
} from "../../data/supabase/syncEngine";
import type { SyncStatusState } from "../../data/supabase/syncStatusAtom";
import type { FileManager } from "../../data/FileManager";

import type { SupabaseClient } from "@supabase/supabase-js";

// Import AFTER the mock so the engine binds to the mocked module.

// Mock the boardRepository: spyable pullBoard/pushBoard + the lock RPC wrappers + a real-ish
// serializeScene so the engine's dirty-check / snapshot logic behaves (JSON of {document, app_state}).
vi.mock("../../data/supabase/boardRepository", () => ({
  pullBoard: vi.fn(),
  pushBoard: vi.fn(),
  claimLock: vi.fn(),
  renewLock: vi.fn(),
  releaseLock: vi.fn(),
  requestTakeover: vi.fn(),
  readLockState: vi.fn(),
  serializeScene: vi.fn(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: Partial<AppState>,
    ) => ({
      document: elements.filter((el) => !el.isDeleted),
      app_state: appState ?? {},
    }),
  ),
}));

const pullBoardMock = pullBoard as unknown as Mock;
const pushBoardMock = pushBoard as unknown as Mock;
const claimLockMock = claimLock as unknown as Mock;
const renewLockMock = renewLock as unknown as Mock;
const releaseLockMock = releaseLock as unknown as Mock;
const serializeSceneMock = serializeScene as unknown as Mock;

const USER_ID = "user-123";
const SESSION_ID = "session-abc";
const HEARTBEAT_MS = 5000;

const writerClaim = (): ClaimLockResult => ({
  acquired: true,
  holder: { writerId: USER_ID, writerSessionId: SESSION_ID },
  lockExpiresAt: "2026-01-01T00:00:25Z",
  version: 1,
});

const readerClaim = (holderSessionId = "other-session"): ClaimLockResult => ({
  acquired: false,
  holder: { writerId: "other-user", writerSessionId: holderSessionId },
  lockExpiresAt: "2026-01-01T00:00:25Z",
  version: 3,
});

const renewOk = (
  takeoverRequestedBy: string | null = null,
): RenewLockResult => ({
  stillWriter: true,
  takeoverRequestedBy,
  version: 1,
});

const makeRect = (id: string): OrderedExcalidrawElement =>
  ({
    id,
    type: "rectangle",
    isDeleted: false,
  } as unknown as OrderedExcalidrawElement);

const makeImage = (id: string, fileId: string): OrderedExcalidrawElement =>
  ({
    id,
    type: "image",
    fileId: fileId as FileId,
    isDeleted: false,
  } as unknown as OrderedExcalidrawElement);

const makeFileManager = (
  saveFilesImpl?: () => Promise<{
    savedFiles: Map<FileId, unknown>;
    erroredFiles: Map<FileId, unknown>;
  }>,
) => {
  const saveFiles = vi.fn(
    saveFilesImpl ??
      (async () => ({
        savedFiles: new Map(),
        erroredFiles: new Map(),
      })),
  );
  const reset = vi.fn();
  return { saveFiles, reset } as unknown as FileManager & {
    saveFiles: Mock;
    reset: Mock;
  };
};

interface Harness {
  engine: SyncEngine;
  setStatus: Mock;
  setLock: Mock;
  applyRemoteScene: Mock;
  fileManager: FileManager & { saveFiles: Mock; reset: Mock };
  getUserId: Mock;
  getSessionId: Mock;
  scene: {
    elements: OrderedExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  };
  statuses: () => SyncStatusState[];
  locks: () => SyncLockState[];
}

const createHarness = (
  opts: {
    elements?: OrderedExcalidrawElement[];
    userId?: string | null;
    fileManager?: FileManager & { saveFiles: Mock; reset: Mock };
    /**
     * Establish the writer precondition the push-pipeline tests assume (before the reader-gate
     * existed, every test was implicitly a writer). Default `true`. Set `false` to test the
     * reader-gate / role-transition paths, which drive the role through `start()`/the lock mocks.
     */
    asWriter?: boolean;
  } = {},
): Harness => {
  const scene = {
    elements: opts.elements ?? [makeRect("a")],
    appState: { theme: "light" } as Partial<AppState>,
    files: {} as BinaryFiles,
  };
  const setStatus = vi.fn();
  const setLock = vi.fn();
  const applyRemoteScene = vi.fn(async () => {});
  const fileManager = opts.fileManager ?? makeFileManager();
  const getUserId = vi.fn(() =>
    opts.userId === undefined ? USER_ID : opts.userId,
  );
  const getSessionId = vi.fn(() => SESSION_ID);
  const client = {} as SupabaseClient;

  const deps: SyncEngineDeps = {
    client,
    getUserId,
    fileManager,
    getScene: () => scene,
    setStatus,
    applyRemoteScene,
    getSessionId,
    setLock,
  };
  const engine = new SyncEngine(deps);
  createdEngines.push(engine);

  if (opts.asWriter !== false) {
    // Promote to writer directly: the precondition the push-pipeline tests assume. Equivalent to
    // a start() that won a claim, but without start()'s pull/insert side effects polluting the
    // mock-call counts those tests assert on. The role transitions themselves are exercised
    // separately via start()/the lock mocks in the dedicated role tests below.
    (engine as unknown as { role: "writer" | "reader" }).role = "writer";
  }

  return {
    engine,
    setStatus,
    setLock,
    applyRemoteScene,
    fileManager,
    getUserId,
    getSessionId,
    scene,
    statuses: () => setStatus.mock.calls.map((c) => c[0] as SyncStatusState),
    locks: () => setLock.mock.calls.map((c) => c[0] as SyncLockState),
  };
};

const lastLock = (h: Harness): SyncLockState | undefined => {
  const all = h.locks();
  return all[all.length - 1];
};

/** engines created this test, disposed in afterEach so no heartbeat interval leaks across tests. */
const createdEngines: SyncEngine[] = [];

const lastStatus = (h: Harness): SyncStatusState | undefined => {
  const all = h.statuses();
  return all[all.length - 1];
};

describe("SyncEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pullBoardMock.mockReset();
    pushBoardMock.mockReset();
    claimLockMock.mockReset();
    renewLockMock.mockReset();
    releaseLockMock.mockReset();
    // restore the default serialize behaviour (mockReset wipes the implementation)
    serializeSceneMock.mockReset();
    serializeSceneMock.mockImplementation(
      (
        elements: readonly OrderedExcalidrawElement[],
        appState: Partial<AppState>,
      ) => ({
        document: elements.filter((el) => !el.isDeleted),
        app_state: appState ?? {},
      }),
    );
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);
    pullBoardMock.mockResolvedValue(null);
    // default lock behaviour: start() wins the claim (writer) and heartbeats stay writer.
    claimLockMock.mockResolvedValue(writerClaim());
    renewLockMock.mockResolvedValue(renewOk());
    releaseLockMock.mockResolvedValue(undefined);
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META);
  });

  afterEach(() => {
    // dispose every engine so its heartbeat interval / window listeners don't leak across tests.
    while (createdEngines.length > 0) {
      createdEngines.pop()?.dispose();
    }
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    // ensure onLine is back to a sane default
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  it("debounces notifyChange() and runs the push after SUPABASE_SYNC_DEBOUNCE_MS", async () => {
    const h = createHarness();

    h.engine.notifyChange();

    // not yet — debounce hasn't elapsed
    expect(pushBoardMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SUPABASE_SYNC_DEBOUNCE_MS);

    expect(h.fileManager.saveFiles).toHaveBeenCalledTimes(1);
    expect(h.fileManager.saveFiles).toHaveBeenCalledWith({
      elements: h.scene.elements,
      files: h.scene.files,
    });
    expect(pushBoardMock).toHaveBeenCalledTimes(1);
    // first push: expectedVersion === null (never synced)
    expect(pushBoardMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({ document: h.scene.elements }),
      null,
    );
  });

  it("does NOT arm the debounce when the serialized scene is unchanged", async () => {
    const h = createHarness();
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);

    // a first sync establishes lastSyncedSnapshot as the baseline
    await h.engine.syncNow();
    expect(pushBoardMock).toHaveBeenCalledTimes(1);

    pushBoardMock.mockClear();
    h.fileManager.saveFiles.mockClear();
    const setStatusBefore = h.setStatus.mock.calls.length;

    // the scene is identical (serializeScene returns the same snapshot) -> notify is a no-op:
    // no debounce armed, no status churn, and advancing time triggers no network.
    h.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(SUPABASE_SYNC_DEBOUNCE_MS * 2);

    expect(h.setStatus.mock.calls.length).toBe(setStatusBefore);
    expect(pushBoardMock).not.toHaveBeenCalled();
    expect(h.fileManager.saveFiles).not.toHaveBeenCalled();
  });

  it("file-error path: a current-scene file error sets error status, skips the row write, resets, stays dirty", async () => {
    const fileId = "file-err" as FileId;
    const erroredFiles = new Map<FileId, unknown>([[fileId, { id: fileId }]]);
    const fm = makeFileManager(async () => ({
      savedFiles: new Map(),
      erroredFiles,
    }));

    const h = createHarness({
      elements: [makeImage("img-1", "file-err")],
      fileManager: fm,
    });

    h.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(SUPABASE_SYNC_DEBOUNCE_MS);

    // row never written
    expect(pushBoardMock).not.toHaveBeenCalled();
    // reset() called to clear the no-retry latch
    expect(fm.reset).toHaveBeenCalledTimes(1);
    // status is error (we are online)
    expect(lastStatus(h)?.status).toBe("error");
    expect(lastStatus(h)?.error).toMatch(/couldn't upload image/i);

    // still dirty -> a subsequent flush retries (proves dirty was NOT cleared on the file error).
    // retry: clean upload this time.
    fm.saveFiles.mockResolvedValueOnce({
      savedFiles: new Map(),
      erroredFiles: new Map(),
    });
    await h.engine.flush();
    expect(pushBoardMock).toHaveBeenCalledTimes(1);
  });

  it("offline path: notifyChange while offline sets status offline, makes NO network call, arms one online listener", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    const addSpy = vi.spyOn(window, "addEventListener");

    const h = createHarness();

    h.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(SUPABASE_SYNC_DEBOUNCE_MS * 2);

    expect(lastStatus(h)?.status).toBe("offline");
    expect(pushBoardMock).not.toHaveBeenCalled();
    expect(h.fileManager.saveFiles).not.toHaveBeenCalled();

    const onlineRegistrations = addSpy.mock.calls.filter(
      (c) => c[0] === "online",
    );
    expect(onlineRegistrations.length).toBe(1);

    // a second offline notify must NOT stack another online listener
    h.engine.notifyChange();
    const onlineRegistrations2 = addSpy.mock.calls.filter(
      (c) => c[0] === "online",
    );
    expect(onlineRegistrations2.length).toBe(1);

    addSpy.mockRestore();
  });

  it("syncNow() cancels the debounce and pushes immediately, bumping the persisted version", async () => {
    const h = createHarness();
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);

    await h.engine.syncNow();

    // pushed without advancing the full debounce window
    expect(pushBoardMock).toHaveBeenCalledTimes(1);
    expect(lastStatus(h)?.status).toBe("synced");

    const meta = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META) ?? "null",
    );
    expect(meta).toMatchObject({ version: 1 });
  });

  it("conflict path: pushBoard {ok:false,conflict} triggers a repull + applyRemoteScene (no clobber)", async () => {
    const h = createHarness();
    pushBoardMock.mockResolvedValue({
      ok: false,
      conflict: true,
    } as PushResult);

    const cloudRow: BoardRow = {
      id: "b1",
      user_id: USER_ID,
      name: "Untitled",
      document: [makeRect("remote")] as unknown as BoardRow["document"],
      app_state: { theme: "dark" } as Partial<AppState>,
      version: 9,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    pullBoardMock.mockResolvedValue(cloudRow);

    h.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(SUPABASE_SYNC_DEBOUNCE_MS);

    expect(pushBoardMock).toHaveBeenCalledTimes(1);
    expect(pullBoardMock).toHaveBeenCalledTimes(1);
    expect(h.applyRemoteScene).toHaveBeenCalledTimes(1);
    expect(h.applyRemoteScene).toHaveBeenCalledWith(cloudRow);
    expect(lastStatus(h)?.status).toBe("synced");
    // localMeta now reflects the cloud version (no clobber of the cloud)
    const meta = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META) ?? "null",
    );
    expect(meta).toMatchObject({ version: 9 });
  });

  it("first-insert uniqueness race: pushBoard throws 23505 -> repull + applyRemoteScene (no hard error)", async () => {
    const h = createHarness();
    const raceError = Object.assign(new Error("duplicate key value"), {
      code: "23505",
    });
    pushBoardMock.mockRejectedValue(raceError);

    const cloudRow: BoardRow = {
      id: "b1",
      user_id: USER_ID,
      name: "Untitled",
      document: [] as unknown as BoardRow["document"],
      app_state: {} as Partial<AppState>,
      version: 3,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    pullBoardMock.mockResolvedValue(cloudRow);

    await h.engine.syncNow();

    expect(pullBoardMock).toHaveBeenCalledTimes(1);
    expect(h.applyRemoteScene).toHaveBeenCalledWith(cloudRow);
    // not surfaced as a hard error
    expect(lastStatus(h)?.status).toBe("synced");
  });

  it("success path: first push (expectedVersion null) persists meta + sets status synced", async () => {
    const h = createHarness();
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);

    h.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(SUPABASE_SYNC_DEBOUNCE_MS);

    expect(pushBoardMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.anything(),
      null,
    );

    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META);
    expect(raw).not.toBeNull();
    const meta = JSON.parse(raw!);
    expect(meta).toMatchObject({ version: 1 });
    expect(typeof meta.lastSyncedAt).toBe("number");

    expect(lastStatus(h)?.status).toBe("synced");
    expect(lastStatus(h)?.error).toBeNull();

    // not dirty after a clean success: a subsequent flush() is a no-op (no second push).
    pushBoardMock.mockClear();
    await h.engine.flush();
    expect(pushBoardMock).not.toHaveBeenCalled();
  });

  it("notifyChange is a no-op when signed out", async () => {
    const h = createHarness({ userId: null });

    h.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(SUPABASE_SYNC_DEBOUNCE_MS);

    expect(pushBoardMock).not.toHaveBeenCalled();
    expect(h.fileManager.saveFiles).not.toHaveBeenCalled();
  });

  it("start(): cloud row newer than local applies the remote scene (cloud wins)", async () => {
    const cloudRow: BoardRow = {
      id: "b1",
      user_id: USER_ID,
      name: "Untitled",
      document: [makeRect("remote")] as unknown as BoardRow["document"],
      app_state: { theme: "dark" } as Partial<AppState>,
      version: 5,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    pullBoardMock.mockResolvedValue(cloudRow);

    // asWriter:false → role is driven purely by start()'s claim (which wins by default).
    const h = createHarness({ asWriter: false });
    await h.engine.start(USER_ID);

    expect(pullBoardMock).toHaveBeenCalledTimes(1);
    expect(h.applyRemoteScene).toHaveBeenCalledWith(cloudRow);
    expect(lastStatus(h)?.status).toBe("synced");
    const meta = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META) ?? "null",
    );
    expect(meta).toMatchObject({ version: 5 });
  });

  it("start(): empty cloud with a non-empty local scene pushes local up (INSERT)", async () => {
    pullBoardMock.mockResolvedValue(null);
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);

    const h = createHarness({
      asWriter: false,
      elements: [makeRect("local-1")],
    });
    await h.engine.start(USER_ID);

    expect(pushBoardMock).toHaveBeenCalledTimes(1);
    expect(pushBoardMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.anything(),
      null,
    );
    expect(lastStatus(h)?.status).toBe("synced");
  });

  // ===========================================================================
  // W02 — lock lifecycle: claim, heartbeat, reader-gate, handoff, lost-lock.
  // ===========================================================================

  it("start() writer path: a won claim makes us writer + heartbeat fires renewLock", async () => {
    pullBoardMock.mockResolvedValue(null); // empty cloud, empty local scene -> no bootstrap push
    claimLockMock.mockResolvedValue(writerClaim());

    const h = createHarness({ asWriter: false, elements: [] });
    await h.engine.start(USER_ID);

    expect(claimLockMock).toHaveBeenCalledTimes(1);
    expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
    // published as writer
    expect(lastLock(h)).toMatchObject({ role: "writer", lockLive: true });

    // heartbeat fires renewLock after HEARTBEAT_MS
    expect(renewLockMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(renewLockMock).toHaveBeenCalledTimes(1);
    expect(renewLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(renewLockMock).toHaveBeenCalledTimes(2);
  });

  it("start() reader path: a lost claim makes us reader; notifyChange/flush never push", async () => {
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(readerClaim("other-session"));

    const h = createHarness({ asWriter: false, elements: [] });
    await h.engine.start(USER_ID);

    expect(lastLock(h)).toMatchObject({
      role: "reader",
      lockLive: true,
      writerSessionId: "other-session",
    });

    // reader must NEVER push: notifyChange arms nothing, flush is a benign no-op.
    pushBoardMock.mockClear();
    h.fileManager.saveFiles.mockClear();

    h.scene.elements = [makeRect("reader-edit")]; // simulate a programmatic scene change
    h.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(SUPABASE_SYNC_DEBOUNCE_MS * 2);
    expect(pushBoardMock).not.toHaveBeenCalled();
    expect(h.fileManager.saveFiles).not.toHaveBeenCalled();

    const flushed = await h.engine.flush();
    expect(flushed).toBe(true); // benign — a reader is "in sync" (nothing to push)
    expect(pushBoardMock).not.toHaveBeenCalled();
    expect(h.fileManager.saveFiles).not.toHaveBeenCalled();

    // no heartbeat is armed for a reader
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
    expect(renewLockMock).not.toHaveBeenCalled();
  });

  it("reader-gate: syncNow() is a no-op for a reader (no push)", async () => {
    const h = createHarness({ asWriter: false });

    await h.engine.syncNow();

    expect(pushBoardMock).not.toHaveBeenCalled();
    expect(h.fileManager.saveFiles).not.toHaveBeenCalled();
  });

  it("flush-success contract: a successful push resolves true and clears dirty", async () => {
    const h = createHarness(); // writer
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);

    h.engine.notifyChange();
    await vi.advanceTimersByTimeAsync(SUPABASE_SYNC_DEBOUNCE_MS);
    expect(pushBoardMock).toHaveBeenCalledTimes(1);

    // dirty cleared on success -> a follow-up flush() is a true no-op (no second push).
    pushBoardMock.mockClear();
    const ok = await h.engine.flush();
    expect(ok).toBe(true);
    expect(pushBoardMock).not.toHaveBeenCalled();
  });

  it("flush-success contract: a failing push (file error) resolves false and stays dirty", async () => {
    const fileId = "file-err" as FileId;
    const fm = makeFileManager(async () => ({
      savedFiles: new Map(),
      erroredFiles: new Map<FileId, unknown>([[fileId, { id: fileId }]]),
    }));
    const h = createHarness({
      elements: [makeImage("img-1", "file-err")],
      fileManager: fm,
    });

    h.engine.notifyChange();
    const ok = await h.engine.flush();

    expect(ok).toBe(false);
    expect(pushBoardMock).not.toHaveBeenCalled();

    // still dirty: a retry with a clean upload now succeeds AND reports true.
    fm.saveFiles.mockResolvedValueOnce({
      savedFiles: new Map(),
      erroredFiles: new Map(),
    });
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);
    const retry = await h.engine.flush();
    expect(retry).toBe(true);
    expect(pushBoardMock).toHaveBeenCalledTimes(1);
  });

  it("flush-success contract: a network throw on the row write resolves false, stays dirty", async () => {
    const h = createHarness();
    pushBoardMock.mockRejectedValue(new TypeError("Failed to fetch"));

    h.engine.notifyChange();
    const ok = await h.engine.flush();

    expect(ok).toBe(false);
    expect(lastStatus(h)?.status).toBe("offline");

    // dirty preserved: a later successful flush reports true.
    pushBoardMock.mockResolvedValue({ ok: true, version: 1 } as PushResult);
    const retry = await h.engine.flush();
    expect(retry).toBe(true);
  });

  it("handoff success: a pending takeover + a clean flush commits, releases the lock, demotes to reader", async () => {
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(writerClaim());
    pushBoardMock.mockResolvedValue({ ok: true, version: 2 } as PushResult);

    const h = createHarness({ asWriter: false, elements: [] });
    await h.engine.start(USER_ID);
    expect(lastLock(h)).toMatchObject({ role: "writer" });

    // an unsynced edit (dirty, debounce NOT yet fired) so the handoff's own flush is what commits it.
    h.scene.elements = [makeRect("final-edit")];
    h.engine.notifyChange();
    pushBoardMock.mockClear();

    // next heartbeat (the SAME tick the debounce would NOT yet fire if we kept the window tight) sees
    // a takeover request from ANOTHER session -> graceful handoff: flush -> release -> demote.
    renewLockMock.mockResolvedValueOnce(renewOk("requester-session"));
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    // the final edit was committed (a push happened) BEFORE release, then we demoted to reader.
    expect(pushBoardMock).toHaveBeenCalled();
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
    expect(releaseLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
    expect(lastLock(h)).toMatchObject({ role: "reader", lockLive: false });
  });

  it("handoff failed-flush (M1): a failing final flush does NOT release the lock and stays writer", async () => {
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(writerClaim());

    const h = createHarness({ asWriter: false, elements: [] });
    await h.engine.start(USER_ID);
    expect(lastLock(h)).toMatchObject({ role: "writer" });

    // an unsynced edit + the push will FAIL (network) when the handoff flush runs.
    h.scene.elements = [makeRect("unsynced")];
    h.engine.notifyChange();
    pushBoardMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renewLockMock.mockResolvedValueOnce(renewOk("requester-session"));
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    // M1: flush returned false -> NO release, NO demote. Still the writer.
    expect(releaseLockMock).not.toHaveBeenCalled();
    expect(lastLock(h)).toMatchObject({ role: "writer" });

    // the next heartbeat (connectivity restored) completes the handoff.
    pushBoardMock.mockResolvedValue({ ok: true, version: 2 } as PushResult);
    renewLockMock.mockResolvedValueOnce(renewOk("requester-session"));
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(releaseLockMock).toHaveBeenCalledTimes(1);
    expect(lastLock(h)).toMatchObject({ role: "reader" });
  });

  it("lost lock: renewLock still_writer:false demotes to reader and stops the heartbeat", async () => {
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(writerClaim());

    const h = createHarness({ asWriter: false, elements: [] });
    await h.engine.start(USER_ID);
    expect(lastLock(h)).toMatchObject({ role: "writer" });

    // server says we lost it (taken over / lease expired while away).
    renewLockMock.mockResolvedValueOnce({
      stillWriter: false,
      takeoverRequestedBy: null,
      version: 2,
    } as RenewLockResult);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(renewLockMock).toHaveBeenCalledTimes(1);
    expect(lastLock(h)).toMatchObject({ role: "reader", lockLive: false });

    // heartbeat stopped: no further renewLock calls.
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3);
    expect(renewLockMock).toHaveBeenCalledTimes(1);
  });

  it("heartbeat network failure does NOT demote (stays writer, retries next tick)", async () => {
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(writerClaim());

    const h = createHarness({ asWriter: false, elements: [] });
    await h.engine.start(USER_ID);

    // the renew RPC THROWS (network) — must NOT demote.
    renewLockMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(lastLock(h)).toMatchObject({ role: "writer" });

    // still writer -> heartbeat keeps firing; next (successful) renew keeps us writer.
    renewLockMock.mockResolvedValueOnce(renewOk());
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(renewLockMock).toHaveBeenCalledTimes(2);
    expect(lastLock(h)).toMatchObject({ role: "writer" });
  });

  it("stop(): a writer releases the lock and stops the heartbeat", async () => {
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(writerClaim());

    const h = createHarness({ asWriter: false, elements: [] });
    await h.engine.start(USER_ID);

    h.engine.stop();
    expect(releaseLockMock).toHaveBeenCalledTimes(1);
    expect(releaseLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);

    // heartbeat stopped.
    renewLockMock.mockClear();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
    expect(renewLockMock).not.toHaveBeenCalled();
  });
});
