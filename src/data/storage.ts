import * as idb from "idb-keyval";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { clearAppStateForLocalStorage } from "../appState";
import { restore } from "./restore";

const STORAGE_NAME = "excalidraw";

const STORAGE_KEYS = {
  ELEMENTS: "excalidraw",
  STATE: "excalidraw-state",
  COLLAB: "excalidraw-collab",
} as const;

type VALID_STORAGE_KEYS = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Uses indexedDB as key-value storage.
 * Fallsback to localStorage on older browsers without IDB (or) while running tests.
 */
export class WebStorageProvider {
  public supportsIDB: boolean;
  private IDBStore: idb.Store | null;

  constructor() {
    this.supportsIDB = "indexedDB" in window;
    this.IDBStore = this.supportsIDB
      ? new idb.Store(`${STORAGE_NAME}-db`, `${STORAGE_NAME}-store`)
      : null;
  }

  // TODO remove after we're certain IDB migrations work correctly (i.e. we're
  //  not getting any errors on Sentry)
  isIDBSafeToUse(): boolean {
    return process.env.NODE_ENV === "test";
  }

  /** Moves existing localStorage data to IDB. Succeeds only if all items are
    migrated successfully, otherwise throws. */
  async migrate() {
    if (this.supportsIDB) {
      for (const key of Object.values(STORAGE_KEYS)) {
        const item = localStorage.getItem(key);
        if (item) {
          await this.set(key, item);
          const isMigrationSuccessful = (await this.get(key)) === item;

          if (!isMigrationSuccessful) {
            throw new Error(`couldn't migrate "${key}" from localStorage`);
          }
        }
      }

      // after successfully migrating all keys, remove them from localStorage
      if (this.isIDBSafeToUse()) {
        for (const key of Object.values(STORAGE_KEYS)) {
          localStorage.removeItem(key);
        }
      }
    }
  }

  async clear(): Promise<void> {
    if (this.supportsIDB && this.IDBStore) {
      await idb.clear(this.IDBStore);
      if (this.isIDBSafeToUse()) {
        return;
      }
    }
    return localStorage.clear();
  }

  async delete(key: string): Promise<void> {
    if (this.supportsIDB && this.IDBStore) {
      await idb.del(key, this.IDBStore);
      if (this.isIDBSafeToUse()) {
        return;
      }
    }
    return localStorage.removeItem(key);
  }

  async get(
    key: string | IDBValidKey,
    // NOTE used for debugging. Remove this once we're sure IDB works correctly.
    storage: "localStorage" | "IDB" = "IDB",
  ): Promise<string | null> {
    if (storage === "IDB") {
      if (this.supportsIDB && this.IDBStore) {
        return (await idb.get<string>(key, this.IDBStore)) || null;
      }
      return null;
    }
    return localStorage.getItem(key as string);
  }

  async set(key: VALID_STORAGE_KEYS, value: string): Promise<void> {
    if (this.supportsIDB && this.IDBStore) {
      await idb.set(key, value, this.IDBStore);
      if (this.isIDBSafeToUse()) {
        return;
      }
    }
    return localStorage.setItem(key, value);
  }

  async getAll() {
    if (this.isIDBSafeToUse() && this.supportsIDB && this.IDBStore) {
      const allItems = {} as {
        [K in VALID_STORAGE_KEYS]: string | null;
      };

      for (const key of Object.values(STORAGE_KEYS)) {
        allItems[key] = await this.get(key);
      }

      return allItems;
    }
    return localStorage;
  }
}

export const storage = new WebStorageProvider();

export const saveUsernameToStorage = async (username: string) => {
  try {
    await storage.set(STORAGE_KEYS.COLLAB, JSON.stringify({ username }));
  } catch (error) {
    console.error(error);
  }
};

export const restoreUsernameFromStorage = async (): Promise<string | null> => {
  try {
    const data = await storage.get(STORAGE_KEYS.COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
  } catch (error) {
    console.error(error);
  }

  return null;
};

export const saveToStorage = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  try {
    await storage.set(
      STORAGE_KEYS.ELEMENTS,
      JSON.stringify(elements.filter((element) => !element.isDeleted)),
    );
    await storage.set(
      STORAGE_KEYS.STATE,
      JSON.stringify(clearAppStateForLocalStorage(appState)),
    );
  } catch (error) {
    console.error(error);
  }
};

export const restoreFromStorage = async () => {
  let savedElements = null;
  let savedState = null;

  try {
    if (
      storage.supportsIDB &&
      localStorage &&
      localStorage.length &&
      // presence of ELEMENTS key suggests localStorage was still
      //  not migrated (this key is always present regardless of scene state)
      localStorage.getItem(STORAGE_KEYS.ELEMENTS) !== null
    ) {
      try {
        await storage.migrate();
      } catch (error) {
        console.error(error);
      }
    }

    savedElements = await storage.get(
      STORAGE_KEYS.ELEMENTS,
      storage.isIDBSafeToUse() ? "IDB" : "localStorage",
    );
    savedState = await storage.get(
      STORAGE_KEYS.STATE,
      storage.isIDBSafeToUse() ? "IDB" : "localStorage",
    );
  } catch (error) {
    console.error(error);
  }

  let elements = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements);
    } catch {
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = JSON.parse(savedState) as AppState;
      // If we're retrieving from storage, we should not be collaborating
      appState.isCollaborating = false;
      appState.collaborators = new Map();
    } catch {
      // Do nothing because appState is already null
    }
  }

  return restore(elements, appState);
};
