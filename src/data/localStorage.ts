import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { clearAppStateForLocalStorage } from "../appState";
import { restore } from "./restore";
import { openDB, IDBPDatabase } from "idb";
import { isNonDeletedElement } from "../element";

const DB_NAME = "excalidraw";
const LOCAL_STORAGE_KEY_COLLAB = "excalidraw-collab";

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

let dbPromise: Promise<IDBPDatabase<unknown>> | undefined;

async function getDB(): Promise<IDBPDatabase<unknown>> {
  return (
    dbPromise ||
    (dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore("elements");
        db.createObjectStore("appState");
      },
    }))
  );
}

export const saveToIndexedDB = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const db = await getDB();
  await Promise.all([
    db.put("appState", clearAppStateForLocalStorage(appState), "appState"),
    db.put("elements", elements.filter(isNonDeletedElement), "elements"),
  ]);
};

export const restoreFromIndexedDB = async () => {
  const db = await getDB();

  const [appState, elements] = await Promise.all([
    db.get("appState", "appState"),
    db.get("elements", "elements"),
  ]).catch((error) => {
    console.error(error);
    return [null, null];
  });

  if (appState) {
    try {
      // If we're retrieving from local storage, we should not be collaborating
      appState.isCollaborating = false;
      appState.collaborators = new Map();
    } catch {
      // Do nothing because appState is already null
    }
  }

  return restore(elements || [], appState);
};
