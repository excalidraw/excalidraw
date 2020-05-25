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
  private supportsIDB: boolean;
  private indexedDBStore: idb.Store | null;

  constructor() {
    this.supportsIDB = "indexedDB" in window && process.env.NODE_ENV !== "test";
    this.indexedDBStore = this.supportsIDB
      ? new idb.Store(`${STORAGE_NAME}-db`, `${STORAGE_NAME}-store`)
      : null;
  }

  async clear(): Promise<void> {
    if (this.supportsIDB && this.indexedDBStore) {
      return await idb.clear(this.indexedDBStore);
    }
    return localStorage.clear();
  }

  async delete(key: string): Promise<void> {
    if (this.supportsIDB && this.indexedDBStore) {
      return await idb.del(key, this.indexedDBStore);
    }
    return localStorage.removeItem(key);
  }

  async get(key: string): Promise<string | null> {
    if (this.supportsIDB && this.indexedDBStore) {
      return await idb.get(key, this.indexedDBStore);
    }
    return localStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    if (this.supportsIDB && this.indexedDBStore) {
      return await idb.set(key, value, this.indexedDBStore);
    }
    return localStorage.setItem(key, value);
  }
}

const storage = new WebStorageProvider();

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
