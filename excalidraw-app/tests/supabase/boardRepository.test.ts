import { describe, it, expect, vi, beforeEach } from "vitest";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  pullBoard,
  pushBoard,
  serializeScene,
  type BoardRow,
} from "../../data/supabase/boardRepository";
import { EPHEMERAL_APPSTATE_KEYS } from "../../data/supabase/ephemeralAppState";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A chainable Postgrest-style query builder (adapted from 04-lld-part2-ui-tests.md §F).
 * Every method returns the builder; `single()` / `maybeSingle()` resolve to the configured
 * terminal `{ data, error }`. Configure per-test via `__resolve`.
 */
const createQueryBuilder = (
  initial: { data: any; error: any } = { data: null, error: null },
) => {
  let result = initial;
  const builder: any = {
    __resolve: (r: { data: any; error: any }) => {
      result = r;
      return builder;
    },
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
};

const createSupabaseMock = (
  fromResult: { data: any; error: any } = { data: null, error: null },
) => {
  const queryBuilder = createQueryBuilder(fromResult);
  const mockClient = {
    from: vi.fn(() => queryBuilder),
    __queryBuilder: queryBuilder,
  };
  return mockClient;
};

// Minimal element factory — we only need `id` + `isDeleted` for the serialize boundary.
const makeElement = (id: string, isDeleted = false): OrderedExcalidrawElement =>
  ({
    id,
    type: "rectangle",
    isDeleted,
  } as unknown as OrderedExcalidrawElement);

const USER_ID = "user-123";

describe("boardRepository.serializeScene", () => {
  it("strips every ephemeral appState key", () => {
    // build an appState that contains every ephemeral key plus a kept document-flavored pref
    const appState = {
      theme: "dark",
      viewBackgroundColor: "#fff",
    } as unknown as Partial<AppState>;
    for (const key of EPHEMERAL_APPSTATE_KEYS) {
      (appState as any)[key] = "ephemeral-value";
    }

    const { app_state } = serializeScene([], appState);

    for (const key of EPHEMERAL_APPSTATE_KEYS) {
      expect(app_state).not.toHaveProperty(key);
    }
    // document-flavored prefs survive
    expect(app_state).toHaveProperty("theme", "dark");
    expect(app_state).toHaveProperty("viewBackgroundColor", "#fff");
  });

  it("drops deleted elements from the document", () => {
    const live = makeElement("live-1", false);
    const deleted = makeElement("deleted-1", true);

    const { document } = serializeScene(
      [live, deleted],
      {} as Partial<AppState>,
    );

    const ids = document.map((el) => el.id);
    expect(ids).toContain("live-1");
    expect(ids).not.toContain("deleted-1");
    expect(document).toHaveLength(1);
  });
});

describe("boardRepository.pushBoard", () => {
  let client: ReturnType<typeof createSupabaseMock>;
  const scene = { document: [], app_state: {} };

  beforeEach(() => {
    client = createSupabaseMock();
  });

  it("INSERTs and returns { ok: true, version: 1 } when expectedVersion is null", async () => {
    client.__queryBuilder.__resolve({
      data: { id: "b1", version: 1 },
      error: null,
    });

    const result = await pushBoard(
      client as unknown as SupabaseClient,
      USER_ID,
      scene,
      null,
    );

    expect(client.from).toHaveBeenCalledWith("boards");
    expect(client.__queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        document: scene.document,
        app_state: scene.app_state,
        version: 1,
      }),
    );
    expect(client.__queryBuilder.update).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, version: 1 });
  });

  it("issues a version-guarded UPDATE (version 4, .eq version 3) and returns { ok: true, version: 4 }", async () => {
    client.__queryBuilder.__resolve({
      data: { id: "b1", version: 4 },
      error: null,
    });

    const result = await pushBoard(
      client as unknown as SupabaseClient,
      USER_ID,
      scene,
      3,
    );

    expect(client.__queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4 }),
    );
    expect(client.__queryBuilder.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(client.__queryBuilder.eq).toHaveBeenCalledWith("version", 3);
    expect(client.__queryBuilder.insert).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, version: 4 });
  });

  it("returns { ok: false, conflict: true } when the guarded update matches 0 rows", async () => {
    client.__queryBuilder.__resolve({ data: null, error: null });

    const result = await pushBoard(
      client as unknown as SupabaseClient,
      USER_ID,
      scene,
      3,
    );

    expect(result).toEqual({ ok: false, conflict: true });
  });
});

describe("boardRepository.pullBoard", () => {
  it("maps a returned row to BoardRow", async () => {
    const row = {
      id: "b1",
      user_id: USER_ID,
      name: "My board",
      document: [{ id: "el-1" }],
      app_state: { theme: "dark" },
      version: 7,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    const client = createSupabaseMock({ data: row, error: null });

    const result = await pullBoard(
      client as unknown as SupabaseClient,
      USER_ID,
    );

    expect(client.from).toHaveBeenCalledWith("boards");
    expect(client.__queryBuilder.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(result).toEqual<BoardRow>({
      id: "b1",
      user_id: USER_ID,
      name: "My board",
      document: [{ id: "el-1" }] as unknown as BoardRow["document"],
      app_state: { theme: "dark" } as Partial<AppState>,
      version: 7,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });
  });

  it("returns null when no row exists", async () => {
    const client = createSupabaseMock({ data: null, error: null });

    const result = await pullBoard(
      client as unknown as SupabaseClient,
      USER_ID,
    );

    expect(result).toBeNull();
  });
});
