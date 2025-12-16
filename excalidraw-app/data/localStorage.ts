import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { getNonDeletedElements } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

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

/**
 * Get board-specific localStorage key
 */
const getBoardStorageKey = (key: string, boardId: string | null): string => {
  if (!boardId) {
    return key; // Default shared key
  }
  return `${key}_board_${boardId}`; // Board-specific key
};

/**
 * Import data from localStorage (supports board-specific keys)
 */
export const importFromLocalStorage = (boardId?: string | null) => {
  let savedElements = null;
  let savedState = null;

  try {
    const elementsKey = getBoardStorageKey(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      boardId || null,
    );
    const stateKey = getBoardStorageKey(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      boardId || null,
    );

    savedElements = localStorage.getItem(elementsKey);
    savedState = localStorage.getItem(stateKey);
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements);
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

/**
 * Save data to board-specific localStorage
 */
export const saveToBoardLocalStorage = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  boardId: string | null,
) => {
  const elementsKey = getBoardStorageKey(
    STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
    boardId,
  );
  const stateKey = getBoardStorageKey(
    STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
    boardId,
  );

  try {
    const _appState = clearAppStateForLocalStorage(appState);
    localStorage.setItem(
      elementsKey,
      JSON.stringify(getNonDeletedElements(elements)),
    );
    localStorage.setItem(stateKey, JSON.stringify(_appState));
  } catch (error: any) {
    console.error("Failed to save to board localStorage:", error);
  }
};

export const getElementsStorageSize = () => {
  try {
    const elements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    const elementsSize = elements?.length || 0;
    return elementsSize;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

export const getTotalStorageSize = () => {
  try {
    const appState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
    const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);

    const appStateSize = appState?.length || 0;
    const collabSize = collab?.length || 0;

    return appStateSize + collabSize + getElementsStorageSize();
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};
