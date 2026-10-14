import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { syncInvalidIndices } from "@excalidraw/element";

import type {
  ExcalidrawGenericElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { DELETED_ELEMENT_TIMEOUT, STORAGE_KEYS } from "../app_constants";
import { LocalData } from "../data/LocalData";
import { updateBrowserStateVersion } from "../data/tabSync";

const createElement = (
  overrides: Partial<OrderedExcalidrawElement & ExcalidrawGenericElement>,
) => ({
  ...syncInvalidIndices([API.createElement({ type: "rectangle" })])[0],
  ...overrides,
});

const saveScene = async (
  elements: readonly OrderedExcalidrawElement[],
  onElementsReconciled = vi.fn(),
  appState = getDefaultAppState() as AppState,
) => {
  LocalData.save({
    getSnapshot: () => ({
      elements,
      appState: { ...appState, isLoading: false },
      files: {},
    }),
    onFilesSaved: vi.fn(),
    onSync: (updates) => {
      if (updates.elements) {
        onElementsReconciled(updates.elements);
      }
    },
  });
  await LocalData.flushSave();
  return onElementsReconciled;
};

const getSavedElements = (): OrderedExcalidrawElement[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS) || "[]");

const saveSceneFromOtherTab = (
  elements: readonly OrderedExcalidrawElement[],
) => {
  localStorage.setItem(
    STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
    JSON.stringify(elements),
  );
  localStorage.setItem(
    STORAGE_KEYS.VERSION_DATA_STATE,
    JSON.stringify(
      Number(localStorage.getItem(STORAGE_KEYS.VERSION_DATA_STATE)) + 1,
    ),
  );
};

describe("tab sync", () => {
  beforeEach(async () => {
    localStorage.clear();
    await LocalData.load();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    vi.spyOn(LocalData.fileStorage, "saveFiles").mockResolvedValue({
      savedFiles: new Map(),
      erroredFiles: new Map(),
    });
  });

  afterEach(async () => {
    await LocalData.flushSave();
    vi.restoreAllMocks();
  });

  it.each([true, false])(
    "merges both tabs' elements when hasFocus is %s",
    async (hasFocus) => {
      vi.spyOn(document, "hasFocus").mockReturnValue(hasFocus);
      const [local, remote] = syncInvalidIndices([
        createElement({ type: "rectangle", id: "local" }),
        createElement({ type: "rectangle", id: "remote" }),
      ]);
      await saveScene([local]);
      saveSceneFromOtherTab([local, remote]);

      const onElementsReconciled = await saveScene([local]);

      expect(getSavedElements().map(({ id }) => id)).toEqual([
        "local",
        "remote",
      ]);
      expect(onElementsReconciled).toHaveBeenCalledWith(getSavedElements());
      expect(getSavedElements().every((element) => !element.isDeleted)).toBe(
        true,
      );
    },
  );

  it("retains a merge on the next save from the updated editor", async () => {
    const [local, remote] = syncInvalidIndices([
      createElement({ type: "rectangle", id: "local" }),
      createElement({ type: "rectangle", id: "remote" }),
    ]);
    let scene = [local];
    saveSceneFromOtherTab([remote]);
    const onElementsReconciled = vi.fn((elements) => {
      scene = elements;
    });

    await saveScene(scene, onElementsReconciled);
    await saveScene(scene, onElementsReconciled);

    expect(onElementsReconciled).toHaveBeenCalledTimes(1);
    expect(getSavedElements().map(({ id }) => id)).toEqual(["local", "remote"]);
  });

  it.each(["local", "remote"])(
    "preserves a newer deletion from the %s tab",
    async (deletedIn) => {
      const element = createElement({
        type: "rectangle",
        id: "rect",
        version: 1,
      });
      const deleted = {
        ...element,
        isDeleted: true,
        version: 2,
        updated: Date.now(),
      };
      saveSceneFromOtherTab([deletedIn === "remote" ? deleted : element]);

      await saveScene([deletedIn === "local" ? deleted : element]);

      expect(getSavedElements()).toMatchObject([
        { id: "rect", isDeleted: true, version: 2 },
      ]);
    },
  );

  it("uses element versions and deterministic nonces to resolve conflicts", async () => {
    const [a, b] = syncInvalidIndices([
      createElement({
        type: "rectangle",
        id: "a",
      }),
      createElement({
        type: "rectangle",
        id: "b",
      }),
    ]).map((element) => ({ ...element, version: 2, versionNonce: 2 }));
    saveSceneFromOtherTab([
      { ...a, version: 3, x: 100 },
      { ...b, versionNonce: 1, x: 200 },
    ]);

    await saveScene([a, b]);

    expect(getSavedElements()).toMatchObject([
      { id: "a", version: 3, x: 100 },
      { id: "b", versionNonce: 1, x: 200 },
    ]);
  });

  it("preserves an element being resized locally", async () => {
    const element = createElement({
      type: "rectangle",
      id: "rect",
      version: 1,
    });
    saveSceneFromOtherTab([{ ...element, version: 2, width: 500 }]);

    await saveScene([element], vi.fn(), {
      ...getDefaultAppState(),
      resizingElement: element,
    } as AppState);

    expect(getSavedElements()).toEqual([element]);
  });

  it("keeps recent tombstones and discards expired tombstones and invisible elements", async () => {
    const elements = syncInvalidIndices([
      createElement({
        type: "rectangle",
        id: "recent",
        isDeleted: true,
        updated: Date.now(),
      }),
      createElement({
        type: "rectangle",
        id: "expired",
        isDeleted: true,
        updated: Date.now() - DELETED_ELEMENT_TIMEOUT - 1,
      }),
      createElement({
        type: "rectangle",
        id: "invisible",
        width: 0,
        height: 0,
      }),
    ]);

    await saveScene(elements);

    expect(getSavedElements().map(({ id }) => id)).toEqual(["recent"]);
  });

  it("allows an intentional scene replacement after importing the current storage version", async () => {
    saveSceneFromOtherTab([
      createElement({ type: "rectangle", id: "previous" }),
    ]);
    await LocalData.load();
    const replacement = createElement({
      type: "rectangle",
      id: "replacement",
    });

    const onElementsReconciled = await saveScene([replacement]);

    expect(getSavedElements()).toEqual([replacement]);
    expect(onElementsReconciled).not.toHaveBeenCalled();
  });

  it("does not mark a failed save as synced, so a retry still merges", async () => {
    const local = createElement({ type: "rectangle", id: "local" });
    const remote = createElement({ type: "rectangle", id: "remote" });
    saveSceneFromOtherTab([remote]);
    const versionBeforeSave = localStorage.getItem(
      STORAGE_KEYS.VERSION_DATA_STATE,
    );
    const setItem = vi
      .spyOn(localStorage, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const onElementsReconciled = await saveScene([local]);

    expect(onElementsReconciled).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      versionBeforeSave,
    );
    setItem.mockRestore();
    await saveScene([local]);
    expect(
      getSavedElements()
        .map(({ id }) => id)
        .sort(),
    ).toEqual(["local", "remote"]);
  });

  it("increments storage versions for saves within one millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
    expect(localStorage.getItem(STORAGE_KEYS.VERSION_DATA_STATE)).toBe("1000");
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
    expect(localStorage.getItem(STORAGE_KEYS.VERSION_DATA_STATE)).toBe("1001");
  });
});
