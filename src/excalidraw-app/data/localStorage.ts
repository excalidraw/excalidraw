import { ExcalidrawElement } from "../../element/types";
import { AppState } from "../../types";
import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "../../appState";
import { clearElementsForLocalStorage } from "../../element";
import { STORAGE_KEYS as APP_STORAGE_KEYS } from "../../constants";

export const STORAGE_KEYS = {
  LOCAL_STORAGE_ELEMENTS: "excalidraw",
  LOCAL_STORAGE_APP_STATE: "excalidraw-state",
  LOCAL_STORAGE_COLLAB: "excalidraw-collab",
  LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG: "collabLinkForceLoadFlag",
};

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error) {
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
  } catch (error) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

export const saveToLocalStorage = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify(clearElementsForLocalStorage(elements)),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(clearAppStateForLocalStorage(appState)),
    );
  } catch (error) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importFromLocalStorage = () => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    savedState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
  } catch (error) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = clearElementsForLocalStorage(JSON.parse(savedElements));
    } catch (error) {
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
    } catch (error) {
      console.error(error);
      // Do nothing because appState is already null
    }
  }
  return { elements, appState };
};

export const getTotalStorageSize = () => {
  const appState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
  const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
  const elements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
  const library = localStorage.getItem(APP_STORAGE_KEYS.LOCAL_STORAGE_LIBRARY);

  const appStateSize = appState ? JSON.stringify(appState).length : 0;
  const collabSize = collab ? JSON.stringify(collab).length : 0;
  const elementsSize = elements ? JSON.stringify(elements).length : 0;
  const librarySize = library ? JSON.stringify(library).length : 0;

  return appStateSize + collabSize + elementsSize + librarySize;
};
