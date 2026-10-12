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
import { LocalData } from "../data/LocalData";
import { resetBrowserStateVersions } from "../data/tabSync";

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
    resetBrowserStateVersions();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    vi.spyOn(LocalData.fileStorage, "saveFiles").mockResolvedValue({
      savedFiles: new Map(),
      erroredFiles: new Map(),
    });
  });

  afterEach(async () => {
    await act(async () => {
      LocalData.flushSave();
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
      LocalData.flushSave();
    });
    saveSceneFromOtherTab([remote]);

    vi.spyOn(common, "isTestEnv").mockReturnValue(false);
    fireEvent.focus(window);

    await waitFor(() =>
      expect(h.elements.map(({ id }) => id)).toEqual(["local", "remote"]),
    );
    await act(async () => {
      LocalData.flushSave();
    });
    expect(getSavedIds()).toEqual(["local", "remote"]);
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
      LocalData.flushSave();
    });

    expect(h.elements.map(({ id }) => id)).toEqual(["local", "remote"]);
    API.setElements(
      h.elements.map((element) =>
        element.id === "local" ? newElementWith(element, { x: 200 }) : element,
      ),
    );
    await act(async () => {
      LocalData.flushSave();
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
      LocalData.flushSave();
    });

    expect(getFiles).toHaveBeenCalledWith([file.id]);
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
      LocalData.flushSave();
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
      LocalData.flushSave();
    });
    expect(getSavedIds()).toEqual(["rect"]);
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS)!)[0]
        .isDeleted,
    ).toBe(true);
  });
});
