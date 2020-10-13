import { ExcalidrawElement } from "../element/types";
import { AppState, LibraryItems } from "../types";
import { clearAppStateForLocalStorage, getDefaultAppState } from "../appState";
import { restoreElements } from "./restore";

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";
const LOCAL_STORAGE_KEY_COLLAB = "excalidraw-collab";
const LOCAL_STORAGE_KEY_LIBRARY = "excalidraw-library";

let _LATEST_LIBRARY_ITEMS: LibraryItems | null = null;
export const loadLibrary = (): Promise<LibraryItems> => {
  return new Promise(async (resolve) => {
    if (_LATEST_LIBRARY_ITEMS) {
      return resolve(JSON.parse(JSON.stringify(_LATEST_LIBRARY_ITEMS)));
    }

    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY_LIBRARY);
      if (!data) {
        return resolve([]);
      }

      const items = (JSON.parse(data) as LibraryItems).map((elements) =>
        restoreElements(elements),
      ) as Mutable<LibraryItems>;

      // clone to ensure we don't mutate the cached library elements in the app
      _LATEST_LIBRARY_ITEMS = JSON.parse(JSON.stringify(items));

      resolve(items);
    } catch (e) {
      console.error(e);
      resolve([]);
    }
  });
};

export const saveLibrary = (items: LibraryItems) => {
  const prevLibraryItems = _LATEST_LIBRARY_ITEMS;
  try {
    const serializedItems = JSON.stringify(items);
    // cache optimistically so that consumers have access to the latest
    //  immediately
    _LATEST_LIBRARY_ITEMS = JSON.parse(serializedItems);
    localStorage.setItem(LOCAL_STORAGE_KEY_LIBRARY, serializedItems);
  } catch (e) {
    _LATEST_LIBRARY_ITEMS = prevLibraryItems;
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

export const importUsernameFromLocalStorage = (): string | null => {
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

export const importFromLocalStorage = () => {
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
  return { elements, appState };
};
