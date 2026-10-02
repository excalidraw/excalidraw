import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import { createStore, del, get, set } from "idb-keyval";

import { nanoid } from "nanoid";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../../app_constants";
import { importFromLocalStorage } from "../localStorage";

import {
  downloadSceneAsFile,
  getAutosaveFileName,
  getOrCreateFileHandle,
  isCollectionsFileSystemSupported,
  readSceneFromFileHandle,
  requestDirectoryHandle,
  requestSaveFileHandle,
  sanitizeCollectionFileName,
  serializeScene,
  tryReadSceneFromDirectoryFile,
  verifyHandlePermission,
  writeAutosaveBackup,
  writeSceneToFileHandle,
} from "./collectionFiles";
import { saveCollectionThumbnail } from "./collectionThumbnails";

import type {
  Collection,
  CollectionsIndex,
  CollectionSceneData,
} from "./types";

const IDB_KEYS = {
  DIRECTORY_HANDLE: "directory-handle",
  fileHandle: (collectionId: string) => `file-handle-${collectionId}`,
  sceneFallback: (collectionId: string) => `scene-fallback-${collectionId}`,
} as const;

const collectionsStore = createStore(
  `${STORAGE_KEYS.IDB_COLLECTIONS}-db`,
  `${STORAGE_KEYS.IDB_COLLECTIONS}-store`,
);

const MAX_RECENT = 5;

/** Cleared when the page is reloaded (browser session scope). */
let sessionDirectoryHandle: FileSystemDirectoryHandle | null = null;

const readIndex = (): CollectionsIndex => {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLECTIONS_INDEX,
    );
    if (raw) {
      const parsed = JSON.parse(raw) as CollectionsIndex;
      if (parsed?.collections && Array.isArray(parsed.collections)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error(error);
  }
  return { collections: [], hasDirectory: false, recentCollectionIds: [] };
};

const writeIndex = (index: CollectionsIndex) => {
  localStorage.setItem(
    STORAGE_KEYS.LOCAL_STORAGE_COLLECTIONS_INDEX,
    JSON.stringify(index),
  );
};

const getActiveCollectionId = (): string | null => {
  try {
    return localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_COLLECTION_ID,
    );
  } catch {
    return null;
  }
};

const setActiveCollectionId = (id: string) => {
  localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_COLLECTION_ID, id);
};

const updateCollectionInIndex = (
  id: string,
  patch: Partial<
    Pick<
      Collection,
      | "name"
      | "fileName"
      | "updatedAt"
      | "savedToDisk"
      | "lastSavedAt"
      | "saveLocationLabel"
      | "customFileHandle"
      | "thumbnailUpdatedAt"
    >
  >,
) => {
  const index = readIndex();
  const collection = index.collections.find((c) => c.id === id);
  if (collection) {
    Object.assign(collection, patch, { updatedAt: Date.now() });
    writeIndex(index);
  }
};

const buildSaveLocationLabel = (
  directoryHandle: FileSystemDirectoryHandle | null,
  fileName: string,
  customFileHandle?: boolean,
): string => {
  if (customFileHandle) {
    return fileName;
  }
  if (directoryHandle) {
    return `${directoryHandle.name}/${fileName}`;
  }
  return fileName;
};

const touchRecentCollection = (id: string) => {
  const index = readIndex();
  const recent = index.recentCollectionIds ?? [];
  const next = [id, ...recent.filter((rid) => rid !== id)].slice(0, MAX_RECENT);
  index.recentCollectionIds = next;
  writeIndex(index);
};

const markCollectionSavedToDisk = (id: string, saveLocationLabel: string) => {
  updateCollectionInIndex(id, {
    savedToDisk: true,
    lastSavedAt: Date.now(),
    saveLocationLabel,
  });
  touchRecentCollection(id);
};

export class CollectionStore {
  static isFileSystemSupported = isCollectionsFileSystemSupported;

  static getSessionDirectory(): FileSystemDirectoryHandle | null {
    return sessionDirectoryHandle;
  }

  static hasSessionDirectory(): boolean {
    return sessionDirectoryHandle != null;
  }

  static getSessionDirectoryName(): string | null {
    return sessionDirectoryHandle?.name ?? null;
  }

  static async getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (sessionDirectoryHandle) {
      return sessionDirectoryHandle;
    }
    const handle = await get<FileSystemDirectoryHandle>(
      IDB_KEYS.DIRECTORY_HANDLE,
      collectionsStore,
    );
    return handle ?? null;
  }

  private static async saveDirectoryHandle(
    handle: FileSystemDirectoryHandle,
  ): Promise<void> {
    sessionDirectoryHandle = handle;
    await set(IDB_KEYS.DIRECTORY_HANDLE, handle, collectionsStore);
    const index = readIndex();
    index.hasDirectory = true;
    writeIndex(index);
  }

  private static async tryUseDirectoryHandle(
    handle: FileSystemDirectoryHandle,
  ): Promise<FileSystemDirectoryHandle | null> {
    const hasPermission = await verifyHandlePermission(handle, "readwrite");
    if (hasPermission) {
      sessionDirectoryHandle = handle;
      return handle;
    }
    return null;
  }

  /** Prompts for a folder only when none is set for this session or in IDB. */
  static async ensureSessionDirectory(): Promise<FileSystemDirectoryHandle> {
    if (sessionDirectoryHandle) {
      const usable = await this.tryUseDirectoryHandle(sessionDirectoryHandle);
      if (usable) {
        return usable;
      }
      sessionDirectoryHandle = null;
    }

    const persisted = await get<FileSystemDirectoryHandle>(
      IDB_KEYS.DIRECTORY_HANDLE,
      collectionsStore,
    );
    if (persisted) {
      const usable = await this.tryUseDirectoryHandle(persisted);
      if (usable) {
        return usable;
      }
    }

    if (!this.isFileSystemSupported()) {
      throw new Error("Folder picker is not supported in this browser.");
    }

    const handle = await requestDirectoryHandle();
    await this.saveDirectoryHandle(handle);
    return handle;
  }

  static getIndex(): CollectionsIndex {
    return readIndex();
  }

  static getCollections(): Collection[] {
    return readIndex().collections;
  }

  static getRecentCollections(): Collection[] {
    const index = readIndex();
    const ids = index.recentCollectionIds ?? [];
    const byId = new Map(index.collections.map((c) => [c.id, c]));
    const recent: Collection[] = [];
    for (const id of ids) {
      const c = byId.get(id);
      if (c) {
        recent.push(c);
      }
    }
    if (recent.length < MAX_RECENT) {
      const sorted = [...index.collections].sort(
        (a, b) =>
          (b.lastSavedAt ?? b.updatedAt) - (a.lastSavedAt ?? a.updatedAt),
      );
      for (const c of sorted) {
        if (!recent.some((r) => r.id === c.id)) {
          recent.push(c);
        }
        if (recent.length >= MAX_RECENT) {
          break;
        }
      }
    }
    return recent.slice(0, MAX_RECENT);
  }

  static getActiveCollection(): Collection | null {
    const id = getActiveCollectionId();
    if (!id) {
      return null;
    }
    return readIndex().collections.find((c) => c.id === id) ?? null;
  }

  static hasConfiguredStorage(): boolean {
    const index = readIndex();
    return index.collections.length > 0 || index.hasDirectory;
  }

  static ensureActiveCollectionOnStartup(): string | null {
    const index = readIndex();
    if (index.collections.length === 0) {
      return null;
    }

    const activeId = getActiveCollectionId();
    if (activeId && index.collections.some((c) => c.id === activeId)) {
      return activeId;
    }

    const sorted = [...index.collections].sort(
      (a, b) => (b.lastSavedAt ?? b.updatedAt) - (a.lastSavedAt ?? a.updatedAt),
    );
    const fallback = sorted[0];
    if (fallback) {
      setActiveCollectionId(fallback.id);
      return fallback.id;
    }
    return null;
  }

  static getOsFolderPath(): string {
    try {
      return (
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLECTIONS_OS_PATH) ??
        ""
      );
    } catch {
      return "";
    }
  }

  static setOsFolderPath(path: string): void {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLECTIONS_OS_PATH,
      path.trim(),
    );
  }

  /** Set session folder without migrating or saving a collection. */
  static async pickDirectory(): Promise<void> {
    const handle = await requestDirectoryHandle();
    await this.saveDirectoryHandle(handle);
  }

  static async createCollection(
    name: string,
    initialScene?: CollectionSceneData,
  ): Promise<Collection> {
    const fileName = `${sanitizeCollectionFileName(name)}.excalidraw`;
    const collection: Collection = {
      id: nanoid(),
      name: name.trim() || "Untitled",
      fileName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      savedToDisk: false,
    };

    const index = readIndex();
    index.collections.push(collection);
    writeIndex(index);

    const emptyScene: CollectionSceneData = {
      elements: [],
      appState: { ...getDefaultAppState() } as AppState,
      files: {},
    };

    await set(
      IDB_KEYS.sceneFallback(collection.id),
      initialScene ?? emptyScene,
      collectionsStore,
    );

    if (!getActiveCollectionId()) {
      setActiveCollectionId(collection.id);
    }

    return collection;
  }

  private static async writeToDiskWithBackup(
    collectionId: string,
    collection: Collection,
    dir: FileSystemDirectoryHandle,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
    fileHandle?: FileSystemFileHandle,
  ): Promise<string> {
    const handle =
      fileHandle ?? (await getOrCreateFileHandle(dir, collection.fileName));
    const serialized = await writeSceneToFileHandle(
      handle,
      elements,
      appState,
      files,
    );
    await set(IDB_KEYS.fileHandle(collectionId), handle, collectionsStore);
    if (!collection.customFileHandle) {
      await writeAutosaveBackup(dir, collection.fileName, serialized);
    }
    return serialized;
  }

  static async saveCollectionToDisk(
    collectionId: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
    options?: { skipThumbnail?: boolean },
  ): Promise<void> {
    const index = readIndex();
    const collection = index.collections.find((c) => c.id === collectionId);
    if (!collection) {
      return;
    }

    if (this.isFileSystemSupported()) {
      let dir: FileSystemDirectoryHandle | null = null;
      let fileHandle: FileSystemFileHandle | null = null;

      if (collection.customFileHandle) {
        fileHandle =
          (await get<FileSystemFileHandle>(
            IDB_KEYS.fileHandle(collectionId),
            collectionsStore,
          )) ?? null;
        if (!fileHandle) {
          throw new Error("Save As file handle was lost. Use Save As again.");
        }
      } else {
        dir = sessionDirectoryHandle ?? (await this.ensureSessionDirectory());
      }

      if (fileHandle) {
        await writeSceneToFileHandle(fileHandle, elements, appState, files);
      } else if (dir) {
        await this.writeToDiskWithBackup(
          collectionId,
          collection,
          dir,
          elements,
          appState,
          files,
        );
      }

      const label = buildSaveLocationLabel(
        dir ?? sessionDirectoryHandle,
        collection.fileName,
        collection.customFileHandle,
      );
      markCollectionSavedToDisk(collectionId, label);

      if (!options?.skipThumbnail) {
        await saveCollectionThumbnail(collectionId, elements, appState, files);
        updateCollectionInIndex(collectionId, {
          thumbnailUpdatedAt: Date.now(),
        });
      }
      return;
    }

    await set(
      IDB_KEYS.sceneFallback(collectionId),
      { elements, appState, files },
      collectionsStore,
    );
    markCollectionSavedToDisk(collectionId, "Browser storage");
    if (!options?.skipThumbnail) {
      await saveCollectionThumbnail(collectionId, elements, appState, files);
      updateCollectionInIndex(collectionId, {
        thumbnailUpdatedAt: Date.now(),
      });
    }
  }

  static async saveCollectionAs(
    collectionId: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ): Promise<void> {
    const collection = readIndex().collections.find(
      (c) => c.id === collectionId,
    );
    if (!collection) {
      return;
    }

    const fileHandle = await requestSaveFileHandle(collection.fileName);
    const serialized = await writeSceneToFileHandle(
      fileHandle,
      elements,
      appState,
      files,
    );
    await set(IDB_KEYS.fileHandle(collectionId), fileHandle, collectionsStore);

    const newFileName = fileHandle.name;
    updateCollectionInIndex(collectionId, {
      fileName: newFileName,
      customFileHandle: true,
      savedToDisk: true,
      lastSavedAt: Date.now(),
      saveLocationLabel: newFileName,
    });

    const dir = await this.getDirectoryHandle();
    if (dir && !collection.customFileHandle) {
      await writeAutosaveBackup(dir, collection.fileName, serialized);
    }

    await saveCollectionThumbnail(collectionId, elements, appState, files);
    updateCollectionInIndex(collectionId, { thumbnailUpdatedAt: Date.now() });
  }

  static async saveCollectionToStorage(
    collectionId: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ): Promise<void> {
    const collection = readIndex().collections.find(
      (c) => c.id === collectionId,
    );
    if (!collection) {
      return;
    }

    if (collection.savedToDisk && this.isFileSystemSupported()) {
      await this.saveCollectionToDisk(collectionId, elements, appState, files, {
        skipThumbnail: true,
      });
      return;
    }

    await set(
      IDB_KEYS.sceneFallback(collectionId),
      { elements, appState, files },
      collectionsStore,
    );
    updateCollectionInIndex(collectionId, {});
  }

  static async saveActiveToFile(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ): Promise<void> {
    const active = this.getActiveCollection();
    if (!active?.savedToDisk) {
      return;
    }
    await this.saveCollectionToStorage(active.id, elements, appState, files);
  }

  static downloadCollection(
    collectionId: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ): void {
    const collection = readIndex().collections.find(
      (c) => c.id === collectionId,
    );
    if (!collection) {
      return;
    }
    downloadSceneAsFile(collection.fileName, elements, appState, files);
  }

  static async duplicateCollection(id: string): Promise<Collection> {
    const source = readIndex().collections.find((c) => c.id === id);
    if (!source) {
      throw new Error("Collection not found.");
    }

    const scene = await this.loadCollectionScene(id, null, null);
    const copyName = `${source.name} (copy)`;
    const created = await this.createCollection(
      copyName,
      scene
        ? {
            elements: scene.elements ?? [],
            appState: (scene.appState ?? {}) as Partial<AppState>,
            files: scene.files ?? {},
          }
        : undefined,
    );

    return created;
  }

  static async importFromFile(file: File): Promise<Collection> {
    const { loadFromBlob } = await import("@excalidraw/excalidraw/data/blob");
    const data = await loadFromBlob(file, null, null);
    const baseName =
      file.name.replace(/\.(excalidraw|json)$/i, "") || "Imported";
    const created = await this.createCollection(baseName, {
      elements: data.elements ?? [],
      appState: (data.appState ?? {}) as Partial<AppState>,
      files: data.files ?? {},
    });
    setActiveCollectionId(created.id);
    touchRecentCollection(created.id);
    return created;
  }

  static async renameCollection(id: string, newName: string): Promise<void> {
    const index = readIndex();
    const collection = index.collections.find((c) => c.id === id);
    if (!collection) {
      return;
    }

    const trimmed = newName.trim() || "Untitled";
    const newFileName = `${sanitizeCollectionFileName(trimmed)}.excalidraw`;
    const oldFileName = collection.fileName;

    collection.name = trimmed;
    collection.fileName = newFileName;
    collection.updatedAt = Date.now();
    if (collection.saveLocationLabel && !collection.customFileHandle) {
      const dir = sessionDirectoryHandle ?? (await this.getDirectoryHandle());
      collection.saveLocationLabel = buildSaveLocationLabel(
        dir,
        newFileName,
        false,
      );
    }
    writeIndex(index);

    if (!collection.savedToDisk || oldFileName === newFileName) {
      return;
    }

    if (collection.customFileHandle) {
      return;
    }

    const dir = await this.getDirectoryHandle();
    if (dir && this.isFileSystemSupported()) {
      try {
        const oldHandle = await get<FileSystemFileHandle>(
          IDB_KEYS.fileHandle(id),
          collectionsStore,
        );
        if (oldHandle) {
          const file = await oldHandle.getFile();
          const newHandle = await getOrCreateFileHandle(dir, newFileName);
          const writable = await newHandle.createWritable();
          await writable.write(file);
          await writable.close();
          await set(IDB_KEYS.fileHandle(id), newHandle, collectionsStore);
          await dir.removeEntry(oldFileName).catch(() => {
            /* old file may not exist */
          });
          const autosaveOld = getAutosaveFileName(oldFileName);
          await dir.removeEntry(autosaveOld).catch(() => {});
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  static async deleteCollection(id: string): Promise<void> {
    const index = readIndex();
    const collection = index.collections.find((c) => c.id === id);
    index.collections = index.collections.filter((c) => c.id !== id);
    if (index.recentCollectionIds) {
      index.recentCollectionIds = index.recentCollectionIds.filter(
        (rid) => rid !== id,
      );
    }
    writeIndex(index);

    await del(IDB_KEYS.fileHandle(id), collectionsStore);
    await del(IDB_KEYS.sceneFallback(id), collectionsStore);
    await del(`thumbnail-${id}`, collectionsStore);

    if (
      collection?.savedToDisk &&
      index.hasDirectory &&
      !collection.customFileHandle
    ) {
      const dir = await this.getDirectoryHandle();
      if (dir) {
        await dir.removeEntry(collection.fileName).catch(() => {});
        await dir
          .removeEntry(getAutosaveFileName(collection.fileName))
          .catch(() => {});
      }
    }

    const activeId = getActiveCollectionId();
    if (activeId === id) {
      const next = index.collections[0];
      if (next) {
        setActiveCollectionId(next.id);
      } else {
        localStorage.removeItem(
          STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_COLLECTION_ID,
        );
      }
    }
  }

  static async loadCollectionScene(
    collectionId: string,
    localAppState: AppState | null,
    localElements: readonly ExcalidrawElement[] | null,
  ): Promise<(ImportedDataState & { recoveredFromAutosave?: boolean }) | null> {
    const collection = readIndex().collections.find(
      (c) => c.id === collectionId,
    );

    if (collection?.savedToDisk && this.isFileSystemSupported()) {
      const fileHandle = await get<FileSystemFileHandle>(
        IDB_KEYS.fileHandle(collectionId),
        collectionsStore,
      );

      if (fileHandle) {
        try {
          return await readSceneFromFileHandle(
            fileHandle,
            localAppState,
            localElements,
          );
        } catch (error) {
          console.error(error);
        }
      }

      if (!collection.customFileHandle) {
        const dir = await this.getDirectoryHandle();
        if (dir) {
          let mainScene: ImportedDataState | null = null;
          try {
            mainScene = await tryReadSceneFromDirectoryFile(
              dir,
              collection.fileName,
              localAppState,
              localElements,
            );
          } catch {
            mainScene = null;
          }

          const autosaveName = getAutosaveFileName(collection.fileName);
          let autosaveScene: ImportedDataState | null = null;
          try {
            autosaveScene = await tryReadSceneFromDirectoryFile(
              dir,
              autosaveName,
              localAppState,
              localElements,
            );
          } catch {
            autosaveScene = null;
          }

          if (autosaveScene && !mainScene) {
            return { ...autosaveScene, recoveredFromAutosave: true };
          }

          if (autosaveScene && mainScene) {
            try {
              const mainHandle = await dir.getFileHandle(collection.fileName);
              const autoHandle = await dir.getFileHandle(autosaveName);
              const mainFile = await mainHandle.getFile();
              const autoFile = await autoHandle.getFile();
              if (autoFile.lastModified > mainFile.lastModified) {
                return { ...autosaveScene, recoveredFromAutosave: true };
              }
            } catch {
              return { ...autosaveScene, recoveredFromAutosave: true };
            }
            return mainScene;
          }

          if (mainScene) {
            return mainScene;
          }
        }
      }
    }

    const fallback = await get<CollectionSceneData>(
      IDB_KEYS.sceneFallback(collectionId),
      collectionsStore,
    );

    if (fallback) {
      return {
        elements: fallback.elements,
        appState: fallback.appState,
        files: fallback.files,
      };
    }

    return null;
  }

  static async loadActiveCollectionScene(
    localAppState: AppState | null,
    localElements: readonly ExcalidrawElement[] | null,
  ): Promise<(ImportedDataState & { recoveredFromAutosave?: boolean }) | null> {
    const active = this.getActiveCollection();
    if (!active) {
      return null;
    }
    return this.loadCollectionScene(active.id, localAppState, localElements);
  }

  static setActiveCollection(id: string): void {
    const exists = readIndex().collections.some((c) => c.id === id);
    if (exists) {
      setActiveCollectionId(id);
      touchRecentCollection(id);
    }
  }

  static getFolderInfo(): {
    folderName: string | null;
    fileNames: string[];
    osPath: string;
  } {
    const index = readIndex();
    return {
      folderName: sessionDirectoryHandle?.name ?? null,
      fileNames: index.collections.map((c) => c.fileName),
      osPath: this.getOsFolderPath(),
    };
  }

  static serializeCollectionForExport(
    collectionId: string,
    fallbackAppState: AppState,
  ): Promise<string | null> {
    return this.loadCollectionScene(collectionId, fallbackAppState, null).then(
      (scene) => {
        if (!scene?.elements) {
          return null;
        }
        const appState = {
          ...fallbackAppState,
          ...(scene.appState ?? {}),
        } as AppState;
        return serializeScene(scene.elements, appState, scene.files ?? {});
      },
    );
  }

  /** One-time migration when user picks a folder and has legacy localStorage scene. */
  static async migrateLegacySceneToDefaultCollection(): Promise<void> {
    const index = readIndex();
    if (index.collections.length > 0) {
      return;
    }

    const legacy = importFromLocalStorage();
    const hasLegacyContent =
      (legacy.elements?.length ?? 0) > 0 || legacy.appState != null;

    const collection = await this.createCollection(
      "Default",
      hasLegacyContent
        ? {
            elements: legacy.elements ?? [],
            appState: {
              ...getDefaultAppState(),
              ...(legacy.appState ?? {}),
            } as AppState,
            files: {},
          }
        : undefined,
    );

    setActiveCollectionId(collection.id);

    if (hasLegacyContent && sessionDirectoryHandle) {
      await this.saveCollectionToDisk(
        collection.id,
        legacy.elements ?? [],
        {
          ...getDefaultAppState(),
          ...(legacy.appState ?? {}),
        } as AppState,
        {},
      );
    }
  }
}
