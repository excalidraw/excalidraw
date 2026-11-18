import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { getNonDeletedElements, syncInvalidIndices } from "@excalidraw/element";

import type { AppState } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import { LocalScene } from "../data/LocalScene";
import {
  importFromLocalStorage,
  withBrowserStorageLock,
} from "../data/localStorage";
import { DELETED_ELEMENT_TIMEOUT, STORAGE_KEYS } from "../app_constants";

const snapshot = (
  elements: readonly OrderedExcalidrawElement[],
  appState: Partial<AppState> = {},
) => ({
  elements,
  appState: {
    ...getDefaultAppState(),
    isLoading: false,
    ...appState,
  } as AppState,
  files: {},
});

const makeElements = (...ids: string[]) =>
  syncInvalidIndices(
    ids.map((id) => API.createElement({ type: "rectangle", id })),
  );

const write = (
  elements: readonly OrderedExcalidrawElement[],
  appState: Partial<AppState> = {},
) => {
  localStorage.setItem(
    STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
    JSON.stringify(elements),
  );
  localStorage.setItem(
    STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
    JSON.stringify(appState),
  );
};

const makeClient = () => {
  const client = new LocalScene();
  client.load(importFromLocalStorage());
  return client;
};

const persist = (
  client: LocalScene,
  local: ReturnType<typeof snapshot>,
  replace = false,
) =>
  withBrowserStorageLock(() => {
    const result = client.reconcile(local, importFromLocalStorage(), replace);
    write(result.persistedElements, result.appState);
    client.accept(result.persistedElements, result.appState);
    return result;
  });

describe("baseline-aware local scene reconciliation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(1000);
  });

  afterEach(() => vi.restoreAllMocks());

  it("does not resurrect an old scene after a replacement without deletion markers", async () => {
    const [old, replacement] = makeElements("old", "replacement");
    write([old]);
    const first = makeClient();
    const stale = makeClient();
    await persist(first, snapshot([replacement]));

    const merged = await persist(stale, snapshot([old]));

    expect(getNonDeletedElements(merged.elements).map(({ id }) => id)).toEqual([
      "replacement",
    ]);
    expect(
      getNonDeletedElements(importFromLocalStorage().elements).map(
        ({ id }) => id,
      ),
    ).toEqual(["replacement"]);
  });

  it("does not resurrect a deletion after its tombstone has expired", async () => {
    const [element] = makeElements("deleted");
    write([element]);
    const stale = makeClient();
    write([
      {
        ...element,
        isDeleted: true,
        version: element.version + 1,
        updated: 1000,
      },
    ]);
    vi.mocked(Date.now).mockReturnValue(1000 + DELETED_ELEMENT_TIMEOUT + 1);
    const fresh = makeClient();
    await persist(
      fresh,
      snapshot([
        {
          ...element,
          isDeleted: true,
          version: element.version + 1,
          updated: 1000,
        },
      ]),
    );
    expect(importFromLocalStorage().elements).toEqual([]);

    const merged = await persist(stale, snapshot([element]));

    expect(getNonDeletedElements(merged.elements)).toEqual([]);
    expect(getNonDeletedElements(importFromLocalStorage().elements)).toEqual(
      [],
    );
  });

  it("preserves unsaved additions while removing known elements deleted remotely", async () => {
    const [old, addition] = makeElements("old", "new-local");
    write([old]);
    const stale = makeClient();
    write([]);

    const merged = await persist(stale, snapshot([old, addition]));

    expect(getNonDeletedElements(merged.elements).map(({ id }) => id)).toEqual([
      "new-local",
    ]);
  });

  it("removes locally replaced elements even if another tab edited them", async () => {
    const [old, replacement] = makeElements("old", "replacement");
    write([old]);
    const client = makeClient();
    write([{ ...old, version: old.version + 1, x: 500 }]);

    const merged = await persist(client, snapshot([replacement]));

    expect(getNonDeletedElements(merged.elements).map(({ id }) => id)).toEqual([
      "replacement",
    ]);
  });

  it("keeps an explicitly retained collaboration scene instead of merging browser contents", async () => {
    const [local, remote] = makeElements("browser", "room");
    write([local]);
    const client = makeClient();

    const merged = await persist(client, snapshot([remote]), true);

    expect(merged.elements.map(({ id }) => id)).toEqual(["room"]);
  });

  it("does not mix concurrent stored additions into a whole-scene replacement", async () => {
    const [old, addition, replacement] = makeElements(
      "old",
      "remote-addition",
      "replacement",
    );
    write([old]);
    const client = makeClient();
    write([old, addition]);

    const merged = await persist(client, snapshot([replacement]));

    expect(getNonDeletedElements(merged.elements).map(({ id }) => id)).toEqual([
      "replacement",
    ]);
  });

  it("serializes concurrent read/merge/write operations from independent clients", async () => {
    const first = makeClient();
    const second = makeClient();
    const [a, b] = makeElements("a", "b");

    await Promise.all([
      persist(first, snapshot([a])),
      persist(second, snapshot([b])),
    ]);

    expect(importFromLocalStorage().elements.map(({ id }) => id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("preserves both tabs' independent edits when they save concurrently", async () => {
    const [a, b] = makeElements("a", "b");
    write([a, b]);
    const first = makeClient();
    const second = makeClient();

    await Promise.all([
      persist(first, snapshot([{ ...a, version: a.version + 1, x: 100 }, b])),
      persist(second, snapshot([a, { ...b, version: b.version + 1, y: 200 }])),
    ]);

    expect(importFromLocalStorage().elements).toMatchObject([
      { id: "a", x: 100 },
      { id: "b", y: 200 },
    ]);
  });

  it("merges app-state changes with the same baseline policy as elements", async () => {
    write([], { viewBackgroundColor: "#fff", gridSize: 20 });
    const client = makeClient();
    write([], { viewBackgroundColor: "#123456", gridSize: 20 });

    const merged = await persist(
      client,
      snapshot([], { viewBackgroundColor: "#fff", gridSize: 40 }),
    );

    expect(merged.appState).toMatchObject({
      viewBackgroundColor: "#123456",
      gridSize: 40,
    });
    expect(merged.updates.appState).toMatchObject({
      viewBackgroundColor: "#123456",
    });
  });

  it("returns no editor updates when the scene and settings have not changed", async () => {
    const [element] = makeElements("same");
    const local = snapshot([element]);
    write([element], local.appState);
    const client = makeClient();

    const merged = await persist(client, local);

    expect(merged.elements).toBe(local.elements);
    expect(merged.updates).toEqual({});
  });

  it("does not interpret malformed storage as a deletion", async () => {
    const [element] = makeElements("keep");
    write([element]);
    const client = makeClient();
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS, "not json");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const merged = await persist(client, snapshot([element]));

    expect(getNonDeletedElements(merged.elements).map(({ id }) => id)).toEqual([
      "keep",
    ]);
    expect(importFromLocalStorage().elements.map(({ id }) => id)).toEqual([
      "keep",
    ]);
  });
});
