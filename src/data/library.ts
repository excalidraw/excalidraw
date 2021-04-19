import { loadLibraryFromBlob } from "./blob";
import { LibraryItems, LibraryItem } from "../types";
import { restoreElements } from "./restore";
import { getNonDeletedElements } from "../element";
import { NonDeleted, ExcalidrawElement } from "../element/types";
import { nanoid } from "nanoid";
import App from "../components/App";

class Library {
  private libraryCache: LibraryItems | null = null;
  public csrfToken = nanoid();
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  resetLibrary = () => {
    this.app.props.resetLibrary?.();
    this.libraryCache = null;
  };

  /** imports library (currently merges, removing duplicates) */
  async importLibrary(blob: Blob) {
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

    const existingLibraryItems = await this.loadLibrary();

    const filtered = libraryFile.library!.reduce((acc, libraryItem) => {
      const restored = getNonDeletedElements(restoreElements(libraryItem));
      if (isUniqueitem(existingLibraryItems, restored)) {
        acc.push(restored);
      }
      return acc;
    }, [] as (readonly NonDeleted<ExcalidrawElement>[])[]);

    this.saveLibrary([...existingLibraryItems, ...filtered]);
  }

  loadLibrary = (): Promise<LibraryItems> => {
    return new Promise(async (resolve) => {
      if (this.libraryCache) {
        return resolve(JSON.parse(JSON.stringify(this.libraryCache)));
      }

      try {
        const libraryItems = this.app.libraryItemsFromStorage;
        if (!libraryItems) {
          return resolve([]);
        }

        const items = libraryItems.map(
          (elements) => restoreElements(elements) as LibraryItem,
        );

        // clone to ensure we don't mutate the cached library elements in the app
        this.libraryCache = JSON.parse(JSON.stringify(items));

        resolve(items);
      } catch (error) {
        console.error(error);
        resolve([]);
      }
    });
  };

  saveLibrary = async (items: LibraryItems) => {
    const prevLibraryItems = this.libraryCache;
    try {
      const serializedItems = JSON.stringify(items);
      // cache optimistically so that the app has access to the latest
      // immediately
      this.libraryCache = JSON.parse(serializedItems);
      await this.app.props.addToLibrary?.(items);
    } catch (error) {
      this.libraryCache = prevLibraryItems;
      throw error;
    }
  };
}

export default Library;
