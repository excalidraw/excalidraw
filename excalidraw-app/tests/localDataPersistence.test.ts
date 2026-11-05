import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { syncInvalidIndices } from "@excalidraw/element";
import * as idb from "idb-keyval";

import type {
  AppState,
  BinaryFileData,
  DataURL,
} from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

import { appJotaiStore } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import {
  LocalData,
  localStorageQuotaExceededAtom,
  localStorageSaveFailedAtom,
} from "../data/LocalData";
import { importFromLocalStorage } from "../data/localStorage";
import { FileManager } from "../data/FileManager";

import type { LocalSceneSnapshot } from "../data/LocalScene";

vi.mock("idb-keyval", async (importOriginal) => {
  const original = await importOriginal<typeof import("idb-keyval")>();
  return { ...original, set: vi.fn(original.set) };
});

const makeOptions = () => {
  const elements = syncInvalidIndices([
    API.createElement({ type: "rectangle", id: "local" }),
  ]);
  return {
    getSnapshot: vi.fn(
      (): LocalSceneSnapshot => ({
        elements,
        appState: { ...getDefaultAppState(), isLoading: false } as AppState,
        files: {},
      }),
    ),
    onFilesSaved: vi.fn(),
    onSync: vi.fn(),
  };
};

describe("local persistence lifecycle", () => {
  beforeEach(async () => {
    localStorage.clear();
    LocalData.resumeSave("collaboration");
    await LocalData.load();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    vi.spyOn(LocalData.fileStorage, "saveFiles").mockResolvedValue({
      savedFiles: new Map(),
      erroredFiles: new Map(),
    });
    appJotaiStore.set(localStorageQuotaExceededAtom, false);
    appJotaiStore.set(localStorageSaveFailedAtom, false);
  });

  afterEach(async () => {
    await LocalData.flushSave();
    LocalData.resumeSave("collaboration");
    vi.restoreAllMocks();
  });

  it.each(["not json", "null", "{}", "[null]", '[{"id":"x"}]'])(
    "recovers saves when stored elements are %s",
    async (corrupt) => {
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS, corrupt);
      vi.spyOn(console, "error").mockImplementation(() => {});

      LocalData.save(makeOptions());
      await LocalData.flushSave();

      expect(importFromLocalStorage().elements).toMatchObject([
        { id: "local", isDeleted: false },
      ]);
      expect(appJotaiStore.get(localStorageSaveFailedAtom)).toBe(false);
    },
  );

  it.each(["not json", "null", '"text"', "{}", "1e999"])(
    "does not lose a valid drawing when its version is %s",
    async (corrupt) => {
      const options = makeOptions();
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
        JSON.stringify(options.getSnapshot().elements),
      );
      localStorage.setItem(STORAGE_KEYS.VERSION_DATA_STATE, corrupt);

      const loaded = await LocalData.load();
      LocalData.save(options);
      await LocalData.flushSave();

      expect(loaded.elements).toMatchObject([{ id: "local" }]);
      expect(importFromLocalStorage().elements).toMatchObject([
        { id: "local" },
      ]);
    },
  );

  it("cancels a debounced local save when joining collaboration", async () => {
    const options = makeOptions();
    LocalData.save(options);
    LocalData.pauseSave("collaboration");

    await LocalData.flushSave();

    expect(options.getSnapshot).not.toHaveBeenCalled();
    expect(options.onSync).not.toHaveBeenCalled();
    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
    ).toBeNull();
  });

  it("invalidates a save already waiting for the storage transaction when collaboration starts", async () => {
    const options = makeOptions();
    LocalData.save(options);
    const saving = LocalData.flushSave();
    LocalData.pauseSave("collaboration");
    LocalData.resumeSave("collaboration");

    await saving;

    expect(options.getSnapshot).not.toHaveBeenCalled();
    expect(options.onSync).not.toHaveBeenCalled();
    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
    ).toBeNull();
  });

  it("does not apply an old file-save callback to a collaboration scene", async () => {
    const options = makeOptions();
    let started!: () => void;
    let finish!: (value: {
      savedFiles: Map<FileId, never>;
      erroredFiles: Map<FileId, never>;
    }) => void;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const filesPromise = new Promise<{
      savedFiles: Map<FileId, never>;
      erroredFiles: Map<FileId, never>;
    }>((resolve) => {
      finish = resolve;
    });
    vi.mocked(LocalData.fileStorage.saveFiles).mockImplementation(() => {
      started();
      return filesPromise;
    });
    LocalData.save(options);
    const saving = LocalData.flushSave();
    await startedPromise;
    LocalData.pauseSave("collaboration");
    LocalData.resumeSave("collaboration");
    finish({
      savedFiles: new Map<FileId, never>(),
      erroredFiles: new Map<FileId, never>(),
    });

    await saving;

    expect(options.onFilesSaved).not.toHaveBeenCalled();
  });

  it("reads the current scene after acquiring the transaction rather than saving stale callback arguments", async () => {
    const options = makeOptions();
    LocalData.save(options);
    const saving = LocalData.flushSave();
    const current = options.getSnapshot();
    options.getSnapshot.mockReturnValue({
      ...current,
      elements: syncInvalidIndices([
        API.createElement({ type: "rectangle", id: "latest" }),
      ]),
    });

    await saving;

    expect(importFromLocalStorage().elements).toMatchObject([{ id: "latest" }]);
  });

  it("compacts tombstones on quota pressure without discarding live elements", async () => {
    const options = makeOptions();
    const current = options.getSnapshot();
    const [deleted] = syncInvalidIndices([
      API.createElement({ type: "rectangle", id: "deleted" }),
    ]);
    options.getSnapshot.mockReturnValue({
      ...current,
      elements: [
        ...current.elements,
        { ...deleted, isDeleted: true, updated: Date.now() },
      ],
    });
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (
        key === STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS &&
        JSON.parse(value).some(
          (element: { isDeleted: boolean }) => element.isDeleted,
        )
      ) {
        throw new DOMException("Full", "QuotaExceededError");
      }
      setItem(key, value);
    });

    LocalData.save(options);
    await LocalData.flushSave();

    expect(importFromLocalStorage().elements).toMatchObject([
      { id: "local", isDeleted: false },
    ]);
    expect(appJotaiStore.get(localStorageQuotaExceededAtom)).toBe(false);
  });

  it("keeps a visible failure and unload protection when live content cannot be saved", async () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    LocalData.save(makeOptions());
    expect(LocalData.hasUnsavedChanges()).toBe(true);
    await LocalData.flushSave();

    expect(appJotaiStore.get(localStorageQuotaExceededAtom)).toBe(true);
    expect(LocalData.hasUnsavedChanges()).toBe(true);
  });

  it("does not issue redundant editor updates or rewrite unchanged storage", async () => {
    const options = makeOptions();
    LocalData.save(options);
    await LocalData.flushSave();
    const setItem = vi.spyOn(localStorage, "setItem");
    options.onSync.mockClear();

    LocalData.save(options);
    await LocalData.flushSave();

    expect(options.onSync).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("reports non-quota write failures and clears the warning after a successful retry", async () => {
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const options = makeOptions();
    LocalData.save(options);
    await LocalData.flushSave();
    expect(appJotaiStore.get(localStorageSaveFailedAtom)).toBe(true);
    expect(LocalData.hasUnsavedChanges()).toBe(true);

    setItem.mockRestore();
    LocalData.save(options);
    await LocalData.flushSave();

    expect(appJotaiStore.get(localStorageSaveFailedAtom)).toBe(false);
    expect(importFromLocalStorage().elements).toMatchObject([{ id: "local" }]);
  });

  it("does not mark pending remote image files as errored while still reporting missing committed files", async () => {
    const pending = "pending" as FileId;
    const missing = "missing" as FileId;
    const onStatus = vi.fn();
    const manager = new FileManager({
      getFiles: async () => ({
        loadedFiles: [],
        erroredFiles: new Map([
          [pending, true],
          [missing, true],
        ]),
      }),
      saveFiles: async () => ({
        savedFiles: new Map(),
        erroredFiles: new Map(),
      }),
      onFileStatusChange: onStatus,
    });

    const result = await manager.getFiles(
      [pending, missing],
      new Set([pending]),
    );

    expect([...result.erroredFiles.keys()]).toEqual([missing]);
    expect(onStatus).toHaveBeenLastCalledWith([[missing, "error"]]);
  });

  it("publishes file availability only after the IndexedDB write completes", async () => {
    vi.mocked(LocalData.fileStorage.saveFiles).mockRestore();
    LocalData.fileStorage.reset();
    let finish!: () => void;
    const writing = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const set = vi.mocked(idb.set).mockReturnValueOnce(writing);
    const file: BinaryFileData = {
      id: "pending-image" as FileId,
      dataURL: "data:image/png;base64," as DataURL,
      mimeType: "image/png",
      created: Date.now(),
      lastRetrieved: Date.now(),
    };
    const elements = syncInvalidIndices([
      API.createElement({ type: "image", fileId: file.id, status: "pending" }),
    ]);

    const save = LocalData.fileStorage.saveFiles({
      elements,
      files: { [file.id]: file },
    });
    expect(set).toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.VERSION_FILES)).toBeNull();
    finish();
    await save;

    expect(
      Number(localStorage.getItem(STORAGE_KEYS.VERSION_FILES)),
    ).toBeGreaterThan(0);
    LocalData.fileStorage.reset();
  });
});
