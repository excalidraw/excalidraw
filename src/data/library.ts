import { loadLibraryFromBlob } from "./blob";
import { LibraryItems, LibraryItem } from "../types";
import { restoreLibraryItems } from "./restore";
import type App from "../components/App";

class Library {
  private libraryCache: LibraryItems | null = null;
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  resetLibrary = async () => {
    await this.app.props.onLibraryChange?.([]);
    this.libraryCache = [];
  };

  /** imports library (currently merges, removing duplicates) */
  async importLibrary(
    blob: Blob,
    defaultStatus: LibraryItem["status"] = "unpublished",
  ) {
    const libraryFile = await loadLibraryFromBlob(blob);
    if (!libraryFile || !(libraryFile.libraryItems || libraryFile.library)) {
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
        if (libraryItem.elements.length !== targetLibraryItem.elements.length) {
          return false;
        }

        // detect z-index difference by checking the excalidraw elements
        // are in order
        return libraryItem.elements.every((libItemExcalidrawItem, idx) => {
          return (
            libItemExcalidrawItem.id === targetLibraryItem.elements[idx].id &&
            libItemExcalidrawItem.versionNonce ===
              targetLibraryItem.elements[idx].versionNonce
          );
        });
      });
    };

    const existingLibraryItems = await this.loadLibrary();

    const library = libraryFile.libraryItems || libraryFile.library || [];
    const restoredLibItems = restoreLibraryItems(library, defaultStatus);
    const filteredItems = [];
    for (const item of restoredLibItems) {
      if (isUniqueitem(existingLibraryItems, item)) {
        filteredItems.push(item);
      }
    }

    await this.saveLibrary([...filteredItems, ...existingLibraryItems]);
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

        const items = restoreLibraryItems(libraryItems, "unpublished");

        // clone to ensure we don't mutate the cached library elements in the app
        this.libraryCache = JSON.parse(JSON.stringify(items));

        resolve(items);
      } catch (error: any) {
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
      await this.app.props.onLibraryChange?.(items);
    } catch (error: any) {
      this.libraryCache = prevLibraryItems;
      throw error;
    }
  };
}

export default Library;
