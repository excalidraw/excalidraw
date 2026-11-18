import * as common from "@excalidraw/common";
import { newElementWith, syncInvalidIndices } from "@excalidraw/element";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import {
  act,
  fireEvent,
  render,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import type {
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";

import ExcalidrawApp from "../App";
import { STORAGE_KEYS } from "../app_constants";
import { LibraryIndexedDBAdapter, LocalData } from "../data/LocalData";
import { appJotaiStore } from "../app-jotai";
import { collabAPIAtom } from "../collab/Collab";
import * as languageDetector from "../app-language/language-detector";
import { appLangCodeAtom } from "../app-language/language-state";

const { h } = window;

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

const getSavedIds = (): string[] =>
  JSON.parse(
    localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS) || "[]",
  ).map((element: OrderedExcalidrawElement) => element.id);

describe("app tab sync", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    vi.spyOn(LocalData.fileStorage, "saveFiles").mockResolvedValue({
      savedFiles: new Map(),
      erroredFiles: new Map(),
    });
  });

  afterEach(async () => {
    await act(async () => {
      await LocalData.flushSave();
    });
    vi.restoreAllMocks();
  });

  it("merges on focus rather than replacing the local scene", async () => {
    await render(<ExcalidrawApp />);
    const [local, remote] = syncInvalidIndices([
      API.createElement({ type: "rectangle", id: "local" }),
      API.createElement({ type: "rectangle", id: "remote" }),
    ]);
    API.setElements([local]);
    await act(async () => {
      await LocalData.flushSave();
    });
    saveSceneFromOtherTab([local, remote]);

    vi.spyOn(common, "isTestEnv").mockReturnValue(false);
    fireEvent.focus(window);

    await waitFor(() =>
      expect(h.elements.map(({ id }) => id)).toEqual(["local", "remote"]),
    );
    await act(async () => {
      await LocalData.flushSave();
    });
    expect(getSavedIds()).toEqual(["local", "remote"]);
    expect(h.elements.every((element) => !element.isDeleted)).toBe(true);
  });

  it("applies a save-time merge to the editor before its next save", async () => {
    await render(<ExcalidrawApp />);
    const [local, remote] = syncInvalidIndices([
      API.createElement({ type: "rectangle", id: "local" }),
      API.createElement({ type: "rectangle", id: "remote" }),
    ]);
    API.setElements([local]);
    saveSceneFromOtherTab([remote]);

    await act(async () => {
      await LocalData.flushSave();
    });

    expect(h.elements.map(({ id }) => id)).toEqual(["local", "remote"]);
    API.setElements(
      h.elements.map((element) =>
        element.id === "local" ? newElementWith(element, { x: 200 }) : element,
      ),
    );
    await act(async () => {
      await LocalData.flushSave();
    });
    expect(getSavedIds()).toEqual(["local", "remote"]);
    expect(h.elements[0].x).toBe(200);
  });

  it("merges a pending local save on focus without dropping either edit", async () => {
    await render(<ExcalidrawApp />);
    const [local, remote] = syncInvalidIndices([
      API.createElement({ type: "rectangle", id: "local" }),
      API.createElement({ type: "rectangle", id: "remote" }),
    ]);
    API.setElements([local]);
    saveSceneFromOtherTab([remote]);

    vi.spyOn(common, "isTestEnv").mockReturnValue(false);
    fireEvent.focus(window);

    await waitFor(() =>
      expect(h.elements.map(({ id }) => id)).toEqual(["local", "remote"]),
    );
    expect(getSavedIds()).toEqual(["local", "remote"]);
  });

  it("loads image files introduced by a save-time merge", async () => {
    await render(<ExcalidrawApp />);
    const [local, image] = syncInvalidIndices([
      API.createElement({ type: "rectangle", id: "local" }),
      API.createElement({
        type: "image",
        id: "remote",
        fileId: "remote-file",
        status: "saved",
      }),
    ]);
    const file: BinaryFileData = {
      id: "remote-file" as FileId,
      dataURL:
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjwvc3ZnPg==" as DataURL,
      mimeType: common.MIME_TYPES.svg,
      created: Date.now(),
      lastRetrieved: Date.now(),
    };
    const getFiles = vi
      .spyOn(LocalData.fileStorage, "getFiles")
      .mockResolvedValue({ loadedFiles: [file], erroredFiles: new Map() });
    API.setElements([local]);
    saveSceneFromOtherTab([image]);

    await act(async () => {
      await LocalData.flushSave();
    });

    expect(getFiles).toHaveBeenCalledWith([file.id], new Set());
    expect(h.elements.map(({ id }) => id)).toEqual(["local", "remote"]);
    expect(h.app.files[file.id]).toEqual(file);
  });

  it("applies a remote deletion on focus and keeps the tombstone on the next save", async () => {
    await render(<ExcalidrawApp />);
    const [element] = syncInvalidIndices([
      API.createElement({ type: "rectangle", id: "rect" }),
    ]);
    API.setElements([element]);
    await act(async () => {
      await LocalData.flushSave();
    });
    saveSceneFromOtherTab([
      {
        ...element,
        isDeleted: true,
        version: element.version + 1,
        updated: Date.now(),
      },
    ]);

    vi.spyOn(common, "isTestEnv").mockReturnValue(false);
    fireEvent.focus(window);

    await waitFor(() =>
      expect(h.elements).toMatchObject([{ id: "rect", isDeleted: true }]),
    );
    await act(async () => {
      await LocalData.flushSave();
    });
    expect(getSavedIds()).toEqual(["rect"]);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS)!)[0]
        .isDeleted,
    ).toBe(true);
  });

  it("refreshes library, username, and language even when a pending save advances the version", async () => {
    await render(<ExcalidrawApp />);
    const collab = appJotaiStore.get(collabAPIAtom)!;
    const setUsername = vi.spyOn(collab, "setUsername");
    const loadLibrary = vi
      .spyOn(LibraryIndexedDBAdapter, "load")
      .mockResolvedValue(null);
    vi.spyOn(languageDetector, "getPreferredLanguage").mockReturnValue("de-DE");
    const [local, remote] = syncInvalidIndices([
      API.createElement({ type: "rectangle", id: "local" }),
      API.createElement({ type: "rectangle", id: "remote" }),
    ]);
    API.setElements([local]);
    saveSceneFromOtherTab([remote]);
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username: "other-tab" }),
    );
    vi.spyOn(common, "isTestEnv").mockReturnValue(false);

    fireEvent.focus(window);

    await waitFor(() => {
      expect(
        h.elements.filter((element) => !element.isDeleted).map(({ id }) => id),
      ).toEqual(["local", "remote"]);
      expect(loadLibrary).toHaveBeenCalled();
      expect(setUsername).toHaveBeenCalledWith("other-tab");
      expect(appJotaiStore.get(appLangCodeAtom)).toBe("de-DE");
    });
  });

  it("persists an Open-file replacement without bringing back the old scene", async () => {
    await render(<ExcalidrawApp />);
    const [old, replacement] = syncInvalidIndices([
      API.createElement({ type: "rectangle", id: "old" }),
      API.createElement({ type: "rectangle", id: "replacement" }),
    ]);
    API.setElements([old]);
    await act(async () => {
      await LocalData.flushSave();
    });

    await act(async () => {
      await h.app.loadFileToCanvas(
        new File(
          [
            JSON.stringify({
              type: "excalidraw",
              version: 2,
              elements: [replacement],
              appState: {},
            }),
          ],
          "replacement.excalidraw",
          { type: "application/json" },
        ),
        null,
      );
    });
    await act(async () => {
      await LocalData.flushSave();
    });

    expect(
      h.elements.filter((element) => !element.isDeleted).map(({ id }) => id),
    ).toEqual(["replacement"]);
    expect(getSavedIds()).toEqual(["replacement"]);
  });
});
