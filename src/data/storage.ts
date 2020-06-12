import * as idb from "idb-keyval";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { clearAppStateForLocalStorage } from "../appState";
import { restore } from "./restore";

const STORAGE_NAME = "excalidraw";
const STORAGE_KEY_ELEMENTS = "excalidraw";
const STORAGE_KEY_STATE = "excalidraw-state";
const STORAGE_KEY_COLLAB = "excalidraw-collab";

/**
 * Uses indexedDB as key-value storage.
 * Fallsback to localStorage on older browsers without IDB (or) while running tests.
 */
export class WebStorageProvider {
  public supportsIDB: boolean;
  private IDBStore: idb.Store | null;

  constructor() {
    this.supportsIDB = "indexedDB" in window && process.env.NODE_ENV !== "test";
    this.IDBStore = this.supportsIDB
      ? new idb.Store(`${STORAGE_NAME}-db`, `${STORAGE_NAME}-store`)
      : null;
  }

  /** Moves existing localStorage data to IDB. Succeeds only if all items are
    migrated successfully, otherwise throws. */
  async migrate() {
    if (this.supportsIDB) {
      const keysToMigrate = [
        STORAGE_KEY_ELEMENTS,
        STORAGE_KEY_STATE,
        STORAGE_KEY_COLLAB,
      ];

      const runMigration = async (key: string): Promise<void> => {
        const item: string | null = localStorage.getItem(key);
        if (item) {
          await this.set(key, item);
          const isMigrationSuccessful = (await this.get(key)) === item;

          if (!isMigrationSuccessful) {
            throw new Error(`couldn't migrate "${key}" from localStorage`);
          }
        }
      };

      await Promise.all(keysToMigrate.map(runMigration));

      // after successfully migrating all keys, remove them from localStorage
      keysToMigrate.forEach((key) => {
        localStorage.removeItem(key);
      });
    }
  }

  async clear(): Promise<void> {
    if (this.supportsIDB && this.IDBStore) {
      return await idb.clear(this.IDBStore);
    }
    return localStorage.clear();
  }

  async delete(key: string): Promise<void> {
    if (this.supportsIDB && this.IDBStore) {
      return await idb.del(key, this.IDBStore);
    }
    return localStorage.removeItem(key);
  }

  async get(key: string | IDBValidKey): Promise<string | null> {
    if (this.supportsIDB && this.IDBStore) {
      return await idb.get(key, this.IDBStore);
    }
    return localStorage.getItem(key as string);
  }

  async set(key: string, value: string): Promise<void> {
    if (this.supportsIDB && this.IDBStore) {
      return await idb.set(key, value, this.IDBStore);
    }
    return localStorage.setItem(key, value);
  }

  async getAll() {
    if (this.supportsIDB && this.IDBStore) {
      const allItems: { [key: string]: string | null } = {};
      const keys = await idb.keys(this.IDBStore);
      for (const key of keys) {
        allItems[key as string] = await this.get(key);
      }
      return allItems;
    }
    return localStorage;
  }
}

export const storage = new WebStorageProvider();

export const saveUsernameToStorage = async (username: string) => {
  try {
    await storage.set(STORAGE_KEY_COLLAB, JSON.stringify({ username }));
  } catch (error) {
    console.error(error);
  }
};

export const restoreUsernameFromStorage = async (): Promise<string | null> => {
  try {
    const data = await storage.get(STORAGE_KEY_COLLAB);
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
      STORAGE_KEY_ELEMENTS,
      JSON.stringify(elements.filter((element) => !element.isDeleted)),
    );
    await storage.set(
      STORAGE_KEY_STATE,
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
      // presence of STORAGE_KEY_ELEMENTS key suggests localStorage was still
      //  not migrated (this key is always present regardless of scene state)
      localStorage.getItem(STORAGE_KEY_ELEMENTS) !== null
    ) {
      try {
        await storage.migrate();
      } catch (error) {
        console.error(error);
      }
    }

    savedElements = await storage.get(STORAGE_KEY_ELEMENTS);
    savedState = await storage.get(STORAGE_KEY_STATE);
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
