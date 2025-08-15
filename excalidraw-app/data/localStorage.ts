import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { clearElementsForLocalStorage } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

import {
  AppStateIndexedDBAdapter,
  ElementsIndexedDBAdapter,
} from "./LocalData";

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importUsernameFromLocalStorage = (): string | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

export const importFromLocalStorage = () => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    savedState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = clearElementsForLocalStorage(JSON.parse(savedElements));
    } catch (error: any) {
      console.error(error);
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(
          JSON.parse(savedState) as Partial<AppState>,
        ),
      };
    } catch (error: any) {
      console.error(error);
      // Do nothing because appState is already null
    }
  }
  return { elements, appState };
};

export const importFromIndexedDB = async () => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = await ElementsIndexedDBAdapter.load();
    savedState = await AppStateIndexedDBAdapter.load();
  } catch (error: any) {
    // unable to access IndexedDB
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = clearElementsForLocalStorage(savedElements);
    } catch (error: any) {
      console.error(error);
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(savedState),
      };
    } catch (error: any) {
      console.error(error);
    }
  }
  return { elements, appState };
};

export const migrateFromLocalStorageToIndexedDB = async () => {
  try {
    // check if we have data in localStorage
    const savedElements = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
    );
    const savedState = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
    );

    if (savedElements || savedState) {
      // parse and migrate elements
      if (savedElements) {
        try {
          const elements = JSON.parse(savedElements);
          await ElementsIndexedDBAdapter.save(elements);
        } catch (error) {
          console.error("Failed to migrate elements:", error);
        }
      }

      // parse and migrate app state
      if (savedState) {
        try {
          const appState = JSON.parse(savedState);
          await AppStateIndexedDBAdapter.save(appState);
        } catch (error) {
          console.error("Failed to migrate app state:", error);
        }
      }

      // clear localStorage after successful migration
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
    }
  } catch (error) {
    console.error("Migration failed:", error);
  }
};

/**
 * Get the size of elements stored in IndexedDB (with localStorage fallback)
 * @returns Promise<number> - Size in bytes
 */
export const getElementsStorageSize = async () => {
  try {
    const elements = await ElementsIndexedDBAdapter.load();
    if (elements) {
      // calculate size by stringifying the data
      const elementsString = JSON.stringify(elements);
      return elementsString.length;
    }
    return 0;
  } catch (error: any) {
    console.error("Failed to get elements size from IndexedDB:", error);
    // fallback to localStorage
    try {
      const elements = localStorage.getItem(
        STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      );
      return elements?.length || 0;
    } catch (localStorageError: any) {
      console.error(
        "Failed to get elements size from localStorage:",
        localStorageError,
      );
      return 0;
    }
  }
};

/**
 * Get the total size of all data stored in IndexedDB and localStorage
 * @returns Promise<number> - Size in bytes
 */
export const getTotalStorageSize = async () => {
  try {
    const appState = await AppStateIndexedDBAdapter.load();
    const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);

    const appStateSize = appState ? JSON.stringify(appState).length : 0;
    const collabSize = collab?.length || 0;

    const elementsSize = await getElementsStorageSize();
    return appStateSize + collabSize + elementsSize;
  } catch (error: any) {
    console.error("Failed to get total storage size from IndexedDB:", error);
    // fallback to localStorage
    try {
      const appState = localStorage.getItem(
        STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      );
      const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);

      const appStateSize = appState?.length || 0;
      const collabSize = collab?.length || 0;

      const elementsSize = await getElementsStorageSize();
      return appStateSize + collabSize + elementsSize;
    } catch (localStorageError: any) {
      console.error(
        "Failed to get total storage size from localStorage:",
        localStorageError,
      );
      return 0;
    }
  }
};
