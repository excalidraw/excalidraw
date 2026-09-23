import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";
import { LocalData } from "../data/LocalData";
import { importFromLocalStorage } from "../data/localStorage";

const saveScene = (elements: readonly ExcalidrawElement[]) => {
  LocalData.save(elements, getDefaultAppState() as AppState, {}, () => {});
  LocalData.flushSave();
};

const getSavedElementIds = (): string[] =>
  JSON.parse(
    localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS) || "[]",
  ).map((element: ExcalidrawElement) => element.id);

const saveSceneFromOtherTab = (elements: readonly ExcalidrawElement[]) => {
  localStorage.setItem(
    STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
    JSON.stringify(elements),
  );
  localStorage.setItem(
    STORAGE_KEYS.VERSION_DATA_STATE,
    JSON.stringify(Date.now() + 1000),
  );
};

describe("tab sync", () => {
  beforeEach(() => {
    localStorage.clear();
    importFromLocalStorage();
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not overwrite a newer scene saved by another tab", () => {
    const staleRect = API.createElement({ type: "rectangle", id: "stale" });
    const newerRect = API.createElement({ type: "rectangle", id: "newer" });

    saveScene([staleRect]);
    expect(getSavedElementIds()).toEqual(["stale"]);

    saveSceneFromOtherTab([newerRect]);

    saveScene([staleRect]);
    expect(getSavedElementIds()).toEqual(["newer"]);
  });

  it("should save once synced with the newer scene", () => {
    const newerRect = API.createElement({ type: "rectangle", id: "newer" });
    const editedRect = API.createElement({ type: "rectangle", id: "edited" });

    saveSceneFromOtherTab([newerRect]);
    importFromLocalStorage();

    saveScene([editedRect]);
    expect(getSavedElementIds()).toEqual(["edited"]);
  });

  it("should save from the focused tab even if another tab saved since", () => {
    const newerRect = API.createElement({ type: "rectangle", id: "newer" });
    const editedRect = API.createElement({ type: "rectangle", id: "edited" });

    saveSceneFromOtherTab([newerRect]);

    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    saveScene([editedRect]);
    expect(getSavedElementIds()).toEqual(["edited"]);
  });
});
