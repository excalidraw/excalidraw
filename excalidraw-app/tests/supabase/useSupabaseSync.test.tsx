import { CaptureUpdateAction } from "@excalidraw/excalidraw";
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
  BinaryFileData,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../../app_constants";

import { Provider, appJotaiStore } from "../../app-jotai";

import { sessionAtom, userIdAtom } from "../../data/supabase/sessionAtom";
import { syncStatusAtom } from "../../data/supabase/syncStatusAtom";
import { lockAtom } from "../../data/supabase/lockAtom";

import { useSupabaseSync } from "../../data/supabase/useSupabaseSync";

import {
  claimLock,
  pullBoard,
  readLockState,
  requestTakeover,
  serializeScene,
} from "../../data/supabase/boardRepository";

import { createSupabaseFileManager } from "../../data/supabase/supabaseFiles";

import { getSupabaseClient } from "../../data/supabase/client";

import { getSession } from "../../data/supabase/auth";

import type { Session } from "@supabase/supabase-js";

import type {
  BoardRow,
  ClaimLockResult,
  LockStateResult,
  RequestTakeoverResult,
} from "../../data/supabase/boardRepository";
import type { FileManager } from "../../data/FileManager";

// ---------------------------------------------------------------------------
// Module mocks (mirrors the engine test's vi.mock style)
// ---------------------------------------------------------------------------

// The client only needs to be a non-null, STABLE object — the engine's network calls go through
// the mocked boardRepository / fileManager below. A stable identity keeps the hook's
// useMemo/effect deps from churning across renders.
const stableClient = { __supabaseMockClient: true };
vi.mock("../../data/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => stableClient as unknown),
}));

// The engine imports these directly. pullBoard is the login-pull seam; serializeScene is real-ish
// so the engine's dirty-check snapshot behaves. The lock RPC wrappers (W03) are mocked so the
// claim-on-start, reader poll, and takeover flows are driven without a real Supabase.
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

// Shrink the lock poll / ack-grace intervals so the reader-poll + takeover tests resolve under
// waitFor's window with REAL timers (the rest of app_constants is preserved via importActual).
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

// The hook builds its FileManager via this factory (M2). Return a mock with getFiles/saveFiles/reset.
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
// onAuthStateChange. We drive login through these (the realistic path); per-test we set
// getSession's resolved session so the boot does not clobber a signed-in state.
vi.mock("../../data/supabase/auth", () => ({
  getSession: vi.fn(async () => null),
  onAuthStateChange: vi.fn(() => () => {}),
  signInWithMagicLink: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({ error: null })),
}));

const pullBoardMock = pullBoard as unknown as Mock;
const claimLockMock = claimLock as unknown as Mock;
const readLockStateMock = readLockState as unknown as Mock;
const requestTakeoverMock = requestTakeover as unknown as Mock;
const createSupabaseFileManagerMock =
  createSupabaseFileManager as unknown as Mock;
const getSupabaseClientMock = getSupabaseClient as unknown as Mock;
const getSessionMock = getSession as unknown as Mock;

const USER_ID = "user-123";
const FILE_ID = "file-1" as FileId;
const SESSION_ID = "session-self";
const OTHER_SESSION = "session-other";

// stub the per-tab session id so claim/poll holder comparisons are deterministic.
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

const makeSession = (): Session =>
  ({
    user: { id: USER_ID, email: "a@b.co" },
  } as unknown as Session);

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

const makeLoadedFile = (): BinaryFileData =>
  ({
    id: FILE_ID,
    dataURL: "data:image/png;base64,AAAA",
    mimeType: "image/png",
    created: Date.now(),
    lastRetrieved: Date.now(),
  } as unknown as BinaryFileData);

// A non-default local viewport so tests can assert that applying a remote scene
// preserves the reader's own pan/zoom (it must NOT be reset to the cloud/default).
const LOCAL_VIEWPORT = { scrollX: 123, scrollY: 456, zoom: { value: 2.5 } };

const makeExcalidrawAPI = () =>
  ({
    updateScene: vi.fn(),
    addFiles: vi.fn(),
    getAppState: vi.fn(() => ({ theme: "light", ...LOCAL_VIEWPORT })),
    getFiles: vi.fn(() => ({})),
    getSceneElements: vi.fn(() => []),
    getSceneElementsIncludingDeleted: vi.fn(() => []),
  } as unknown as ExcalidrawImperativeAPI & Record<string, Mock>);

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(Provider, { store: appJotaiStore }, children);

describe("useSupabaseSync", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "true");
    vi.stubEnv("VITE_APP_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_APP_SUPABASE_ANON_KEY", "anon-test-key");

    // clear persisted localMeta so a prior test's version doesn't suppress the reader-poll pull.
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META);

    pullBoardMock.mockReset();
    pullBoardMock.mockResolvedValue(null);
    // lock RPC defaults: a fresh session wins the claim (writer) and the poll sees a live holder.
    claimLockMock.mockReset();
    claimLockMock.mockResolvedValue(writerClaim());
    readLockStateMock.mockReset();
    readLockStateMock.mockResolvedValue(lockState());
    requestTakeoverMock.mockReset();
    requestTakeoverMock.mockResolvedValue(takeoverResult());
    fileManagerMock.getFiles.mockReset();
    fileManagerMock.getFiles.mockResolvedValue({
      loadedFiles: [],
      erroredFiles: new Map<FileId, true>(),
    });
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

  it("on login pulls the cloud board and applies it to the editor (updateScene NEVER + addFiles + getFiles)", async () => {
    const excalidrawAPI = makeExcalidrawAPI();

    // cloud has a newer board with an image → cloud-wins apply path.
    pullBoardMock.mockResolvedValue(makeImageRow());
    const loadedFile = makeLoadedFile();
    fileManagerMock.getFiles.mockResolvedValue({
      loadedFiles: [loadedFile],
      erroredFiles: new Map<FileId, true>(),
    });

    // a signed-in session is present at boot (useInitSupabaseSession seeds it from getSession)
    getSessionMock.mockResolvedValue(makeSession());

    renderHook(() => useSupabaseSync({ excalidrawAPI }), { wrapper });

    // serializeScene seam exists (the engine imports it directly)
    expect(serializeScene).toBeDefined();

    // login resolves → userId becomes non-null → the engine is constructed with the composed
    // Supabase FileManager (M2) and start() runs the pull.
    await waitFor(() => {
      expect(appJotaiStore.get(userIdAtom)).toBe(USER_ID);
    });
    await waitFor(() => {
      expect(createSupabaseFileManagerMock).toHaveBeenCalledWith(
        expect.anything(),
        USER_ID,
      );
      expect(pullBoardMock).toHaveBeenCalledWith(expect.anything(), USER_ID);
      expect(excalidrawAPI.updateScene).toHaveBeenCalled();
    });

    // the pull-apply must NOT pollute undo history
    const applyCall = (excalidrawAPI.updateScene as Mock).mock.calls.find(
      (c) => c[0]?.captureUpdate === CaptureUpdateAction.NEVER,
    );
    expect(applyCall).toBeTruthy();
    expect(applyCall![0]).toEqual(
      expect.objectContaining({ captureUpdate: CaptureUpdateAction.NEVER }),
    );

    // applying a remote scene must PRESERVE the local viewport (no zoom-out / jump)
    expect(applyCall![0].appState).toEqual(
      expect.objectContaining({
        scrollX: LOCAL_VIEWPORT.scrollX,
        scrollY: LOCAL_VIEWPORT.scrollY,
        zoom: LOCAL_VIEWPORT.zoom,
      }),
    );

    // the post-pull file load: getFiles(fileIds) → addFiles(loadedFiles)
    await waitFor(() => {
      expect(fileManagerMock.getFiles).toHaveBeenCalledWith([FILE_ID]);
      expect(excalidrawAPI.addFiles).toHaveBeenCalledWith([loadedFile]);
    });
  });

  it("mirrors the engine status into the returned status", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    expect(result.current.status).toBe("idle");

    // a status transition pushed into the atom (as the engine does via setStatus) drives the hook
    await act(async () => {
      appJotaiStore.set(syncStatusAtom, {
        status: "syncing",
        lastSyncedAt: null,
        error: null,
      });
    });
    expect(result.current.status).toBe("syncing");

    await act(async () => {
      appJotaiStore.set(syncStatusAtom, {
        status: "synced",
        lastSyncedAt: 1234,
        error: null,
      });
    });
    // The displayed status floors the visible "syncing" duration, so it does
    // not flip to "synced" instantly — but lastSyncedAt updates immediately.
    expect(result.current.status).toBe("syncing");
    expect(result.current.lastSyncedAt).toBe(1234);

    // …and after the spinner's minimum visible window (~1.5s) it settles to
    // "synced". waitFor's default 1000ms timeout is shorter than that window,
    // so allow up to 2500ms.
    await waitFor(
      () => {
        expect(result.current.status).toBe("synced");
      },
      { timeout: 2500 },
    );
  });

  it("is a safe no-op when the feature flag is OFF (no engine, idle status, no updateScene)", async () => {
    vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "false");
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(makeImageRow());
    // even a signed-in session must not trigger any sync work when the flag is off
    getSessionMock.mockResolvedValue(makeSession());

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    // give the boot's getSession()/effects a chance to run; nothing should fire
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // no FileManager / engine is constructed under the flag
    expect(createSupabaseFileManagerMock).not.toHaveBeenCalled();
    expect(pullBoardMock).not.toHaveBeenCalled();
    expect(excalidrawAPI.updateScene).not.toHaveBeenCalled();
    expect(excalidrawAPI.addFiles).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");

    // syncNow / notifyChange are inert no-ops (don't throw, resolve)
    await act(async () => {
      result.current.notifyChange();
      await expect(result.current.syncNow()).resolves.toBeUndefined();
    });

    // role defaults to reader, but viewModeEnabled MUST be false when the flag is off (so the app
    // renders exactly as today — no view-only). No poll either.
    expect(result.current.role).toBe("reader");
    expect(result.current.viewModeEnabled).toBe(false);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(readLockStateMock).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // W03 — lock role / viewMode / reader poll / takeOver wiring.
  // ===========================================================================

  it("fresh session that wins the claim becomes WRITER with viewModeEnabled false (no poll)", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(writerClaim());
    getSessionMock.mockResolvedValue(makeSession());

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
      expect(result.current.role).toBe("writer");
    });
    expect(result.current.viewModeEnabled).toBe(false);
    expect(result.current.lock.lockLive).toBe(true);

    // a writer never runs the reader poll (it heartbeats inside the engine).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(readLockStateMock).not.toHaveBeenCalled();
  });

  it("second session that loses the claim becomes READER (viewModeEnabled true) and a reader edit does not push", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValue(readerClaim());
    getSessionMock.mockResolvedValue(makeSession());

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    // wait until start()'s claim has resolved (it publishes the holder), not just the reader default.
    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
      expect(result.current.lock.writerSessionId).toBe(OTHER_SESSION);
    });
    expect(result.current.role).toBe("reader");
    expect(result.current.viewModeEnabled).toBe(true);

    // a reader's notifyChange must never reach the push pipeline (engine reader-gate).
    const { pushBoard } = await import("../../data/supabase/boardRepository");
    const pushBoardMock = pushBoard as unknown as Mock;
    pushBoardMock.mockClear();
    (excalidrawAPI.getSceneElementsIncludingDeleted as Mock).mockReturnValue([
      { id: "r1", type: "rectangle", isDeleted: false },
    ]);
    await act(async () => {
      result.current.notifyChange();
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(pushBoardMock).not.toHaveBeenCalled();
    // still a reader / view-only.
    expect(result.current.role).toBe("reader");
    expect(result.current.viewModeEnabled).toBe(true);
  });

  it("reader poll: a higher cloud version triggers a pull + applyRemoteScene and updates lockAtom", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    // start as a reader (lost claim). claim returns version 3 → that becomes our baseline after the
    // start reconcile? No: start pull is null, claim does not pull. So localVersion stays null and
    // the first poll (version 5) pulls.
    pullBoardMock.mockResolvedValueOnce(null); // start() pull: empty
    claimLockMock.mockResolvedValue(readerClaim());
    getSessionMock.mockResolvedValue(makeSession());

    // the poll returns a NEWER version → the hook pulls that row and applies it.
    readLockStateMock.mockResolvedValue(
      lockState({ version: 5, takeoverRequestedBy: null }),
    );
    const polledRow = makeImageRow(); // version 5, has an image → applyRemoteScene path
    pullBoardMock.mockResolvedValue(polledRow);

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    // wait until start()'s claim resolved → we're genuinely a reader (the poll only runs as reader).
    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
      expect(result.current.lock.writerSessionId).toBe(OTHER_SESSION);
    });

    // the poll fires (short interval), sees version 5 > local (null) → pullBoard + applyRemoteScene.
    await waitFor(() => {
      expect(readLockStateMock).toHaveBeenCalled();
      expect(excalidrawAPI.updateScene).toHaveBeenCalled();
    });

    // lockAtom mirrors the polled holder/liveness.
    await waitFor(() => {
      expect(result.current.lock.lockLive).toBe(true);
      expect(result.current.lock.writerSessionId).toBe(OTHER_SESSION);
    });
  });

  it("takeOver(): requests a handoff, then claims when the poll sees the lock freed → role becomes WRITER", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValueOnce(readerClaim()); // start: lose the claim → reader
    getSessionMock.mockResolvedValue(makeSession());

    // while the writer still holds it, the poll reports a LIVE lock.
    readLockStateMock.mockResolvedValue(lockState({ lockLive: true }));
    // request_takeover records the request; not immediately claimable (a live writer holds it).
    requestTakeoverMock.mockResolvedValue(
      takeoverResult({ immediatelyClaimable: false }),
    );

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    // wait until start()'s lost claim settled us as a reader before requesting takeover.
    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
      expect(result.current.lock.writerSessionId).toBe(OTHER_SESSION);
    });
    expect(result.current.role).toBe("reader");

    // click "Take over": writes the request + arms the pending claim. takeoverInFlight goes true.
    await act(async () => {
      await result.current.takeOver();
    });
    expect(requestTakeoverMock).toHaveBeenCalledWith(
      expect.anything(),
      SESSION_ID,
    );

    // the writer releases → the next poll sees the lock FREE → the hook claims it (acquired) →
    // the engine promotes us to writer.
    readLockStateMock.mockResolvedValue(
      lockState({ lockLive: false, writerId: null, writerSessionId: null }),
    );
    claimLockMock.mockResolvedValue(writerClaim());

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
    expect(result.current.viewModeEnabled).toBe(false);
    expect(result.current.lock.takeoverInFlight).toBe(false);
  });

  it("takeOver(): a crashed/gone writer (immediatelyClaimable) is claimed at once → WRITER", async () => {
    const excalidrawAPI = makeExcalidrawAPI();
    pullBoardMock.mockResolvedValue(null);
    claimLockMock.mockResolvedValueOnce(readerClaim()); // start: reader
    getSessionMock.mockResolvedValue(makeSession());
    readLockStateMock.mockResolvedValue(
      lockState({ lockLive: false, writerId: null, writerSessionId: null }),
    );
    // the writer is already gone → request_takeover says claim immediately.
    requestTakeoverMock.mockResolvedValue(
      takeoverResult({ immediatelyClaimable: true }),
    );
    claimLockMock.mockResolvedValue(writerClaim());

    const { result } = renderHook(() => useSupabaseSync({ excalidrawAPI }), {
      wrapper,
    });

    // wait until start()'s lost claim ran (engine settled as a reader).
    await waitFor(() => {
      expect(claimLockMock).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
    });
    expect(result.current.role).toBe("reader");

    await act(async () => {
      await result.current.takeOver();
    });

    await waitFor(() => {
      expect(result.current.role).toBe("writer");
    });
    expect(result.current.viewModeEnabled).toBe(false);
  });
});
