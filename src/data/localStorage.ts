import { ExcalidrawElement, NonDeleted } from "../element/types";
import { AppState } from "../types";
import { clearAppStateForLocalStorage } from "../appState";
import { restore } from "./restore";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";
const LOCAL_STORAGE_KEY_COLLAB = "excalidraw-collab";
const LOCAL_STORAGE_KEY_LIBRARY = "excalidraw-library";

export const loadLibrary = () => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY_LIBRARY);
    if (!data) {
      return [];
    }

    const library: ExcalidrawElement[][] = JSON.parse(data);

    return library.map(
      (elements) => restore(elements, null).elements,
    ) as NonDeleted<ExcalidrawElement>[][];
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const saveLibrary = (library: readonly ExcalidrawElement[][]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_LIBRARY, JSON.stringify(library));
  } catch (e) {
    console.error(e);
  }
};

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const restoreUsernameFromLocalStorage = (): string | null => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY_COLLAB);
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
      LOCAL_STORAGE_KEY,
      JSON.stringify(elements.filter((element) => !element.isDeleted)),
    );
    localStorage.setItem(
      LOCAL_STORAGE_KEY_STATE,
      JSON.stringify(clearAppStateForLocalStorage(appState)),
    );
  } catch (error) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const restoreFromLocalStorage = () => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(LOCAL_STORAGE_KEY);
    savedState = localStorage.getItem(LOCAL_STORAGE_KEY_STATE);
  } catch (error) {
    // Unable to access localStorage
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
      // If we're retrieving from local storage, we should not be collaborating
      appState.isCollaborating = false;
      appState.collaborators = new Map();
      delete appState.width;
      delete appState.height;
      // Always favor the saved library
      appState.library = loadLibrary();
    } catch {
      // Do nothing because appState is already null
    }
  }
  return restore(elements, appState);
};
