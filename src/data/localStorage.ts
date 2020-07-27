import { ExcalidrawElement } from "../element/types";
import { AppState, LibraryItems } from "../types";
import { clearAppStateForLocalStorage, getDefaultAppState } from "../appState";
import { restore } from "./restore";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";
const LOCAL_STORAGE_KEY_COLLAB = "excalidraw-collab";
const LOCAL_STORAGE_KEY_LIBRARY = "excalidraw-library";

export const loadLibrary = async (): Promise<LibraryItems> => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY_LIBRARY);
  if (!data) {
    return [];
  }
  return (JSON.parse(data) as ExcalidrawElement[][]).map(
    (elements) => restore(elements, null).elements,
  ) as Mutable<LibraryItems>;
};

export const saveLibrary = async (items: LibraryItems) => {
  localStorage.setItem(LOCAL_STORAGE_KEY_LIBRARY, JSON.stringify(items));
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
  return restore(elements, appState);
};
