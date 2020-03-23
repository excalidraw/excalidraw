import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { clearAppStateForLocalStorage } from "../appState";
import { restore } from "./restore";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";

export function saveToLocalStorage(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify(elements.filter((element) => !element.isDeleted)),
  );
  localStorage.setItem(
    LOCAL_STORAGE_KEY_STATE,
    JSON.stringify(clearAppStateForLocalStorage(appState)),
  );
}

export function restoreFromLocalStorage() {
  const savedElements = localStorage.getItem(LOCAL_STORAGE_KEY);
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY_STATE);

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
    } catch {
      // Do nothing because appState is already null
    }
  }

  return restore(elements, appState);
}
