import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  claimLock,
  renewLock,
  releaseLock,
  requestTakeover,
  readLockState,
} from "../../data/supabase/boardRepository";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A minimal Supabase mock whose only surface is `.rpc(name, params)` → resolved `{ data, error }`.
 * The lock wrappers all go through `client.rpc(...)` (see 0002_board_locks.sql), so unlike the
 * table-query tests we don't need the chainable builder — just a configurable `rpc` spy.
 * Configure the terminal result per test via `__resolve`.
 */
const createRpcMock = (
  initial: { data: any; error: any } = { data: null, error: null },
) => {
  let result = initial;
  const rpc = vi.fn(() => Promise.resolve(result));
  const mockClient = {
    __resolve: (r: { data: any; error: any }) => {
      result = r;
    },
    rpc,
  };
  return mockClient;
};

const SESSION_ID = "session-abc";
const OTHER_SESSION_ID = "session-xyz";

describe("boardRepository.claimLock", () => {
  let client: ReturnType<typeof createRpcMock>;

  beforeEach(() => {
    client = createRpcMock();
  });

  it("calls claim_board_lock with p_session_id and maps the acquired row", async () => {
    client.__resolve({
      data: [
        {
          acquired: true,
          writer_id: "uid-1",
          writer_session_id: SESSION_ID,
          writer_heartbeat_at: "2026-06-16T00:00:00Z",
          lock_expires_at: "2026-06-16T00:00:25Z",
          version: 3,
        },
      ],
      error: null,
    });

    const result = await claimLock(
      client as unknown as SupabaseClient,
      SESSION_ID,
    );

    expect(client.rpc).toHaveBeenCalledWith("claim_board_lock", {
      p_session_id: SESSION_ID,
    });
    expect(result).toEqual({
      acquired: true,
      holder: { writerId: "uid-1", writerSessionId: SESSION_ID },
      lockExpiresAt: "2026-06-16T00:00:25Z",
      version: 3,
    });
  });

  it("maps acquired=false when another session holds the lock", async () => {
    client.__resolve({
      data: [
        {
          acquired: false,
          writer_id: "uid-2",
          writer_session_id: OTHER_SESSION_ID,
          writer_heartbeat_at: "2026-06-16T00:00:00Z",
          lock_expires_at: "2026-06-16T00:00:25Z",
          version: 9,
        },
      ],
      error: null,
    });

    const result = await claimLock(
      client as unknown as SupabaseClient,
      SESSION_ID,
    );

    expect(result.acquired).toBe(false);
    expect(result.holder).toEqual({
      writerId: "uid-2",
      writerSessionId: OTHER_SESSION_ID,
    });
    expect(result.version).toBe(9);
  });

  it("surfaces an rpc error by throwing", async () => {
    client.__resolve({ data: null, error: new Error("boom") });

    await expect(
      claimLock(client as unknown as SupabaseClient, SESSION_ID),
    ).rejects.toThrow("boom");
  });
});

describe("boardRepository.renewLock", () => {
  let client: ReturnType<typeof createRpcMock>;

  beforeEach(() => {
    client = createRpcMock();
  });

  it("calls renew_board_lock with p_session_id and maps stillWriter + takeover signal", async () => {
    client.__resolve({
      data: [
        {
          still_writer: true,
          takeover_requested_by: null,
          takeover_requested_at: null,
          version: 5,
        },
      ],
      error: null,
    });

    const result = await renewLock(
      client as unknown as SupabaseClient,
      SESSION_ID,
    );

    expect(client.rpc).toHaveBeenCalledWith("renew_board_lock", {
      p_session_id: SESSION_ID,
    });
    expect(result).toEqual({
      stillWriter: true,
      takeoverRequestedBy: null,
      version: 5,
    });
  });

  it("surfaces a pending takeover request from another session", async () => {
    client.__resolve({
      data: [
        {
          still_writer: true,
          takeover_requested_by: OTHER_SESSION_ID,
          takeover_requested_at: "2026-06-16T00:00:00Z",
          version: 6,
        },
      ],
      error: null,
    });

    const result = await renewLock(
      client as unknown as SupabaseClient,
      SESSION_ID,
    );

    expect(result.stillWriter).toBe(true);
    expect(result.takeoverRequestedBy).toBe(OTHER_SESSION_ID);
  });

  it("maps stillWriter=false when the lease was lost", async () => {
    client.__resolve({
      data: [
        {
          still_writer: false,
          takeover_requested_by: null,
          takeover_requested_at: null,
          version: 7,
        },
      ],
      error: null,
    });

    const result = await renewLock(
      client as unknown as SupabaseClient,
      SESSION_ID,
    );

    expect(result.stillWriter).toBe(false);
  });

  it("surfaces an rpc error by throwing", async () => {
    client.__resolve({ data: null, error: new Error("renew failed") });

    await expect(
      renewLock(client as unknown as SupabaseClient, SESSION_ID),
    ).rejects.toThrow("renew failed");
  });
});

describe("boardRepository.releaseLock", () => {
  let client: ReturnType<typeof createRpcMock>;

  beforeEach(() => {
    client = createRpcMock();
  });

  it("calls release_board_lock with p_session_id and resolves void", async () => {
    client.__resolve({ data: null, error: null });

    const result = await releaseLock(
      client as unknown as SupabaseClient,
      SESSION_ID,
    );

    expect(client.rpc).toHaveBeenCalledWith("release_board_lock", {
      p_session_id: SESSION_ID,
    });
    expect(result).toBeUndefined();
  });

  it("surfaces an rpc error by throwing", async () => {
    client.__resolve({ data: null, error: new Error("release failed") });

    await expect(
      releaseLock(client as unknown as SupabaseClient, SESSION_ID),
    ).rejects.toThrow("release failed");
  });
});

describe("boardRepository.requestTakeover", () => {
  let client: ReturnType<typeof createRpcMock>;

  beforeEach(() => {
    client = createRpcMock();
  });

  it("calls request_takeover with p_session_id and maps the response", async () => {
    client.__resolve({
      data: [
        {
          immediately_claimable: false,
          writer_session_id: OTHER_SESSION_ID,
          lock_expires_at: "2026-06-16T00:00:25Z",
        },
      ],
      error: null,
    });

    const result = await requestTakeover(
      client as unknown as SupabaseClient,
      SESSION_ID,
    );

    expect(client.rpc).toHaveBeenCalledWith("request_takeover", {
      p_session_id: SESSION_ID,
    });
    expect(result).toEqual({
      immediatelyClaimable: false,
      writerSessionId: OTHER_SESSION_ID,
      lockExpiresAt: "2026-06-16T00:00:25Z",
    });
  });

  it("maps immediatelyClaimable=true when the lock is already free", async () => {
    client.__resolve({
      data: [
        {
          immediately_claimable: true,
          writer_session_id: null,
          lock_expires_at: null,
        },
      ],
      error: null,
    });

    const result = await requestTakeover(
      client as unknown as SupabaseClient,
      SESSION_ID,
    );

    expect(result.immediatelyClaimable).toBe(true);
    expect(result.writerSessionId).toBeNull();
    expect(result.lockExpiresAt).toBeNull();
  });

  it("surfaces an rpc error by throwing", async () => {
    client.__resolve({ data: null, error: new Error("takeover failed") });

    await expect(
      requestTakeover(client as unknown as SupabaseClient, SESSION_ID),
    ).rejects.toThrow("takeover failed");
  });
});

describe("boardRepository.readLockState", () => {
  let client: ReturnType<typeof createRpcMock>;

  beforeEach(() => {
    client = createRpcMock();
  });

  it("calls read_lock_state with no params and maps lock_live -> lockLive (DB-clock verdict)", async () => {
    client.__resolve({
      data: [
        {
          version: 11,
          writer_id: "uid-3",
          writer_session_id: OTHER_SESSION_ID,
          lock_live: true,
          takeover_requested_by: null,
          server_now: "2026-06-16T00:00:10Z",
        },
      ],
      error: null,
    });

    const result = await readLockState(client as unknown as SupabaseClient);

    expect(client.rpc).toHaveBeenCalledWith("read_lock_state");
    expect(result).toEqual({
      version: 11,
      writerId: "uid-3",
      writerSessionId: OTHER_SESSION_ID,
      lockLive: true,
      takeoverRequestedBy: null,
      serverNow: "2026-06-16T00:00:10Z",
    });
  });

  it("maps lockLive=false (free/expired) and a pending takeover signal", async () => {
    client.__resolve({
      data: [
        {
          version: 12,
          writer_id: null,
          writer_session_id: null,
          lock_live: false,
          takeover_requested_by: SESSION_ID,
          server_now: "2026-06-16T00:00:20Z",
        },
      ],
      error: null,
    });

    const result = await readLockState(client as unknown as SupabaseClient);

    expect(result.lockLive).toBe(false);
    expect(result.writerId).toBeNull();
    expect(result.takeoverRequestedBy).toBe(SESSION_ID);
  });

  it("surfaces an rpc error by throwing", async () => {
    client.__resolve({ data: null, error: new Error("read failed") });

    await expect(
      readLockState(client as unknown as SupabaseClient),
    ).rejects.toThrow("read failed");
  });
});
