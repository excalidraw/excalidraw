import { loadLibraryFromBlob } from "./blob";
import { LibraryItems, LibraryItem } from "../types";
import { restoreElements } from "./restore";
import { STORAGE_KEYS } from "../constants";
import { getNonDeletedElements } from "../element";
import { NonDeleted, ExcalidrawElement } from "../element/types";

export class Library {
  private static libraryCache: LibraryItems | null = null;

  static resetLibrary = () => {
    Library.libraryCache = null;
    localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_LIBRARY);
  };

  /** imports library (currently merges, removing duplicates) */
  static async importLibrary(blob: Blob) {
    const libraryFile = await loadLibraryFromBlob(blob);
    if (!libraryFile || !libraryFile.library) {
      return;
    }

    /**
     * checks if library item does not exist already in current library
     */
    const isUniqueitem = (
      existingLibraryItems: LibraryItems,
      targetLibraryItem: LibraryItem,
    ) => {
      return !existingLibraryItems.find((libraryItem) => {
        if (libraryItem.length !== targetLibraryItem.length) {
          return false;
        }

        // detect z-index difference by checking the excalidraw elements
        // are in order
        return libraryItem.every((libItemExcalidrawItem, idx) => {
          return (
            libItemExcalidrawItem.id === targetLibraryItem[idx].id &&
            libItemExcalidrawItem.versionNonce ===
              targetLibraryItem[idx].versionNonce
          );
        });
      });
    };

    const existingLibraryItems = await Library.loadLibrary();

    const filtered = libraryFile.library!.reduce((acc, libraryItem) => {
      const restored = getNonDeletedElements(restoreElements(libraryItem));
      if (isUniqueitem(existingLibraryItems, restored)) {
        acc.push(restored);
      }
      return acc;
    }, [] as (readonly NonDeleted<ExcalidrawElement>[])[]);

    Library.saveLibrary([...existingLibraryItems, ...filtered]);
  }

  static loadLibrary = (): Promise<LibraryItems> => {
    return new Promise(async (resolve) => {
      if (Library.libraryCache) {
        return resolve(JSON.parse(JSON.stringify(Library.libraryCache)));
      }

      try {
        const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_LIBRARY);
        if (!data) {
          return resolve([]);
        }

        const items = (JSON.parse(data) as LibraryItems).map((elements) =>
          restoreElements(elements),
        ) as Mutable<LibraryItems>;

        // clone to ensure we don't mutate the cached library elements in the app
        Library.libraryCache = JSON.parse(JSON.stringify(items));

        resolve(items);
      } catch (error) {
        console.error(error);
        resolve([]);
      }
    });
  };

  static saveLibrary = (items: LibraryItems) => {
    const prevLibraryItems = Library.libraryCache;
    try {
      const serializedItems = JSON.stringify(items);
      // cache optimistically so that consumers have access to the latest
      // immediately
      Library.libraryCache = JSON.parse(serializedItems);
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_LIBRARY, serializedItems);
    } catch (error) {
      Library.libraryCache = prevLibraryItems;
      console.error(error);
    }
  };
}
