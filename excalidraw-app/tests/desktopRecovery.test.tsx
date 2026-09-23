import { vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { EVENT, MIME_TYPES } from "@excalidraw/excalidraw/constants";
import type {
  ExcalidrawElement,
  FileId,
} from "@excalidraw/excalidraw/element/types";
import type {
  BinaryFileData,
  BinaryFiles,
  DataURL,
} from "@excalidraw/excalidraw/types";
import ExcalidrawApp from "../App";
import { STORAGE_KEYS } from "../app_constants";
import { appJotaiStore } from "../app-jotai";
import { collabAPIAtom } from "../collab/Collab";
import { LocalData } from "../data/LocalData";
import { flushDesktopDocument } from "../desktop/bridge";

const { nativeInvoke, tauriIsDesktop } = vi.hoisted(() => ({
  nativeInvoke: vi.fn(),
  tauriIsDesktop: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: nativeInvoke,
  isTauri: tauriIsDesktop,
}));

const { h } = window;

const desktopDocument = (
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles = {},
) =>
  JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements,
    appState: {},
    files,
  });

beforeEach(() => {
  localStorage.clear();
  appJotaiStore.set(collabAPIAtom, null);
  LocalData.fileStorage.reset();
  // Isolate recovery from the ordinary onChange autosave. Flush tests resume it.
  LocalData.pauseSave("collaboration");
  tauriIsDesktop.mockReset().mockReturnValue(true);
  nativeInvoke.mockReset().mockResolvedValue(null);
});

afterEach(async () => {
  unmountComponent();
  LocalData.flushSave();
  await flushDesktopDocument();
  LocalData.resumeSave("collaboration");
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("desktop recovery in ExcalidrawApp", () => {
  it("restores a missing browser scene and its embedded images without an IndexedDB lookup", async () => {
    const file: BinaryFileData = {
      id: "recovered-image" as FileId,
      mimeType: MIME_TYPES.png,
      dataURL:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII=" as DataURL,
      created: 1,
    };
    const image = API.createElement({
      type: "image",
      id: "image-element",
      fileId: file.id,
      status: "saved",
    });
    nativeInvoke.mockResolvedValue(
      desktopDocument([image], { [file.id]: file }),
    );
    const getFiles = vi.spyOn(LocalData.fileStorage, "getFiles");
    const clearObsoleteFiles = vi.spyOn(
      LocalData.fileStorage,
      "clearObsoleteFiles",
    );

    await render(<ExcalidrawApp />);

    expect(nativeInvoke).toHaveBeenCalledTimes(1);
    expect(nativeInvoke).toHaveBeenNthCalledWith(1, "restore_document");
    expect(h.elements).toEqual([
      expect.objectContaining({
        id: image.id,
        fileId: file.id,
        status: "saved",
      }),
    ]);
    expect(h.app.files[file.id]).toEqual(file);
    expect(getFiles).not.toHaveBeenCalled();
    expect(clearObsoleteFiles).toHaveBeenCalledWith({
      currentFileIds: [file.id],
    });
  });

  it("looks up only images not embedded in recovery and retains every cleanup ID", async () => {
    const embeddedId = "embedded-image" as FileId;
    const missingId = "missing-image" as FileId;
    const embeddedFile: BinaryFileData = {
      id: embeddedId,
      mimeType: MIME_TYPES.png,
      dataURL: "data:image/png;base64,AA==" as DataURL,
      created: 1,
    };
    const images = [embeddedId, missingId].map((fileId) =>
      API.createElement({ type: "image", id: fileId, fileId, status: "saved" }),
    );
    nativeInvoke.mockResolvedValue(
      desktopDocument(images, { [embeddedId]: embeddedFile }),
    );
    const getFiles = vi
      .spyOn(LocalData.fileStorage, "getFiles")
      .mockResolvedValue({
        loadedFiles: [],
        erroredFiles: new Map([[missingId, true]]),
      });
    const clearObsoleteFiles = vi.spyOn(
      LocalData.fileStorage,
      "clearObsoleteFiles",
    );

    await render(<ExcalidrawApp />);

    expect(getFiles).toHaveBeenCalledTimes(1);
    expect(getFiles).toHaveBeenNthCalledWith(1, [missingId]);
    expect(h.app.files[embeddedId]).toEqual(embeddedFile);
    expect(
      h.elements.find((element) => element.id === embeddedId),
    ).toMatchObject({
      status: "saved",
    });
    expect(clearObsoleteFiles).toHaveBeenCalledWith({
      currentFileIds: [embeddedId, missingId],
    });
  });

  it("does not resurrect a native document over a valid saved empty browser scene", async () => {
    nativeInvoke.mockResolvedValue(
      desktopDocument([API.createElement({ id: "old-native-element" })]),
    );

    await render(<ExcalidrawApp />, { localStorageData: { elements: [] } });

    expect(h.elements).toEqual([]);
    expect(h.state.isLoading).toBe(false);
    expect(nativeInvoke).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS)).toBe(
      "[]",
    );
  });

  it("keeps a nonempty browser scene ahead of native recovery", async () => {
    const element = API.createElement({ id: "browser-element" });

    await render(<ExcalidrawApp />, {
      localStorageData: { elements: [element] },
    });

    expect(h.elements).toEqual([expect.objectContaining({ id: element.id })]);
    expect(nativeInvoke).not.toHaveBeenCalled();
  });

  it.each(["not JSON", "{}", "[null]", '[{"type":"unknown"}]'])(
    "recovers when browser elements are corrupt (%s)",
    async (storedElements) => {
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS, storedElements);
      // The existing browser importer reports malformed local storage.
      vi.spyOn(console, "error").mockImplementation(() => {});
      const element = API.createElement({ id: "recovered-element" });
      nativeInvoke.mockResolvedValue(desktopDocument([element]));

      await render(<ExcalidrawApp />);

      expect(h.elements).toEqual([expect.objectContaining({ id: element.id })]);
      expect(nativeInvoke).toHaveBeenCalledTimes(1);
      expect(nativeInvoke).toHaveBeenNthCalledWith(1, "restore_document");
    },
  );

  it("recovers when browser elements cannot be read", async () => {
    const getItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key,
    ) {
      if (key === STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS) {
        throw new Error("Storage unavailable");
      }
      return getItem.call(this, key);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const element = API.createElement({ id: "recovered-element" });
    nativeInvoke.mockResolvedValue(desktopDocument([element]));

    await render(<ExcalidrawApp />);

    expect(h.elements).toEqual([expect.objectContaining({ id: element.id })]);
    expect(nativeInvoke).toHaveBeenCalledTimes(1);
    expect(nativeInvoke).toHaveBeenNthCalledWith(1, "restore_document");
  });

  it.each(["private invalid JSON", '{"type":"excalidraw","elements":[null]}'])(
    "falls back from corrupt native data without recovery writes or payload logs (%s)",
    async (contents) => {
      nativeInvoke.mockResolvedValue(contents);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      const saveFiles = vi.spyOn(LocalData.fileStorage, "saveFiles");

      await render(<ExcalidrawApp />);

      expect(h.state.isLoading).toBe(false);
      expect(h.elements).toEqual([]);
      expect(h.app.files).toEqual({});
      expect(nativeInvoke).toHaveBeenCalledTimes(1);
      expect(nativeInvoke).toHaveBeenNthCalledWith(1, "restore_document");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenNthCalledWith(
        1,
        "Unable to restore the desktop document.",
      );
      expect(
        setItem.mock.calls.filter(
          ([key]) =>
            key === STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS ||
            key === STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
        ),
      ).toEqual([]);
      expect(saveFiles).not.toHaveBeenCalled();
    },
  );

  it("keeps native rejection details out of recovery logs", async () => {
    nativeInvoke.mockRejectedValue(
      new Error("private native document contents"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await render(<ExcalidrawApp />);

    expect(h.state.isLoading).toBe(false);
    expect(h.elements).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenNthCalledWith(
      1,
      "Unable to restore the desktop document.",
    );
  });

  it("adds no browser storage read for recovery outside desktop", async () => {
    tauriIsDesktop.mockReturnValue(false);
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    await render(<ExcalidrawApp />);

    expect(nativeInvoke).not.toHaveBeenCalled();
    expect(
      getItem.mock.calls.filter(
        ([key]) => key === STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      ),
    ).toHaveLength(1);
  });

  it.each([EVENT.BLUR, EVENT.VISIBILITY_CHANGE])(
    "flushes pending desktop edits on %s before the debounce expires",
    async (event) => {
      await render(<ExcalidrawApp />, { localStorageData: { elements: [] } });
      LocalData.resumeSave("collaboration");
      vi.useFakeTimers();
      const element = API.createElement({ id: "pending-edit" });
      API.updateScene({ elements: [element] });
      expect(nativeInvoke).not.toHaveBeenCalled();

      await act(async () => {
        if (event === EVENT.VISIBILITY_CHANGE) {
          vi.spyOn(document, "hidden", "get").mockReturnValue(true);
          fireEvent(document, new Event(event));
        } else {
          fireEvent(window, new Event(event));
        }
      });

      expect(nativeInvoke).toHaveBeenCalledTimes(1);
      expect(nativeInvoke).toHaveBeenNthCalledWith(1, "persist_document", {
        request: { contents: expect.any(String) },
      });
      expect(
        JSON.parse(nativeInvoke.mock.calls[0][1].request.contents).elements,
      ).toEqual([expect.objectContaining({ id: element.id })]);
    },
  );
});
