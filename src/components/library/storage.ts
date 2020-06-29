import {
  NonDeletedExcalidrawElement,
  ExcalidrawElement,
} from "../../element/types";
import { useState, useEffect } from "react";
import { getNonDeletedElements } from "../../element";

export type Timestamp = number;

/** Drawing library stored in localStorage. */
export type Library = {
  savedDrawings: SavedDrawing[];
};

const INITIAL_LIBRARY: Library = {
  savedDrawings: [],
};

/** Drawing in memory but not necessarily saved. */
export type UnsavedDrawing = {
  uid: string;
  name: string;
  elements: readonly ExcalidrawElement[];
};

/** Drawing saved to the library, analogous to a `.excalidraw` file. */
export type SavedDrawing = {
  /** Unique ID for the drawing generated on first save. */
  uid: string;
  elements: readonly NonDeletedExcalidrawElement[];
  lastSaved: Timestamp;
  name?: string;
};

const LIBRARY_KEY = "excalidraw-library";

type Subscriber = () => void;
type Subscription = {
  unsubscribe: () => void;
};

/**
 * Storage layer for saved drawings.
 *
 * The current implementation uses window.localStorage, but this may change
 * to support third-party cloud providers in the future, assuming users
 * acknowledge that their data may not be as secure.
 */
export class LibraryStorage {
  private static instance: Promise<LibraryStorage> | null;

  private subscribers: Subscriber[] = [];

  private constructor() {}

  static async init() {
    if (LibraryStorage.instance) {
      return LibraryStorage.instance;
    }

    return (LibraryStorage.instance = (async () => {
      if (!window.localStorage.getItem(LIBRARY_KEY)) {
        window.localStorage.setItem(
          LIBRARY_KEY,
          JSON.stringify(INITIAL_LIBRARY),
        );
      }
      return new LibraryStorage();
    })());
  }

  subscribe(subscriber: Subscriber): Subscription {
    this.subscribers.push(subscriber);
    return {
      unsubscribe: () => {
        this.subscribers = this.subscribers.filter((s) => s !== subscriber);
      },
    };
  }

  private notify() {
    for (const subscriber of this.subscribers) {
      subscriber();
    }
  }

  /**
   * Lists all saved drawings.
   */
  async getLibrary(): Promise<Library> {
    return this.getFromLocalStorage();
  }

  /**
   * Saves the drawing identified by `uid`, overwriting the old drawing
   * if it exists.
   */
  async save({ uid, name, elements }: UnsavedDrawing): Promise<void> {
    if (!uid) {
      throw new Error("Drawing is missing uid.");
    }
    if (!elements?.length) {
      throw new Error("Drawing is missing or empty.");
    }
    const library = this.getFromLocalStorage();
    const newDrawing: SavedDrawing = {
      uid,
      ...(name ? { name } : {}),
      elements: getNonDeletedElements(elements),
      lastSaved: new Date().getTime(),
    };
    library.savedDrawings = [
      newDrawing,
      ...library.savedDrawings.filter((drawing) => drawing.uid !== uid),
    ];
    this.writeToLocalStorage(library);
  }

  async remove({ uid }: { uid: string }) {
    const library = this.getFromLocalStorage();
    library.savedDrawings = [
      ...library.savedDrawings.filter((drawing) => drawing.uid !== uid),
    ];
    this.writeToLocalStorage(library);
  }

  /** Renames the drawing with the given ID. */
  async rename(uid: string, name: string) {
    // TODO
  }

  /**
   * Records that the drawing with the given UID was accessed.
   *
   * This pushes the drawing to the front of the list.
   */
  async recordAccess(uid: string) {
    const library = this.getFromLocalStorage();
    library.savedDrawings = [
      ...library.savedDrawings.filter((drawing) => drawing.uid === uid),
      ...library.savedDrawings.filter((drawing) => drawing.uid !== uid),
    ];
    this.writeToLocalStorage(library);
  }

  /** Returns the entire stored drawing library. */
  private getFromLocalStorage(): Library {
    return JSON.parse(window.localStorage.getItem(LIBRARY_KEY) as string);
  }

  /** Overwrites the entire drawing library. */
  private writeToLocalStorage(library: Library) {
    if (!library) {
      throw new Error("Provided library object is invalid.");
    }
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    this.notify();
  }
}

/**
 * Hook that grants access to the storage layer for saved drawings.
 *
 * Returns null if the library is not yet initialized.
 */
export function useLibraryStorage() {
  const [storage, setStorage] = useState<LibraryStorage | null>(null);

  useEffect(() => {
    LibraryStorage.init().then(setStorage);
  }, []);

  return storage;
}
