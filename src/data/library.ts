import { loadLibraryFromBlob } from "./blob";
import { LibraryItems, LibraryItem } from "../types";
import { restoreLibraryItems } from "./restore";
import type App from "../components/App";
import { ImportedDataState } from "./types";
import { atom } from "jotai";
import { jotaiStore } from "../jotai";

export const libraryItemsAtom = atom<LibraryItems>([]);

const cloneLibraryItems = (libraryItems: LibraryItems): LibraryItems =>
  JSON.parse(JSON.stringify(libraryItems));

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

class Library {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  resetLibrary = async () => {
    this.saveLibrary([]);
  };

  /** imports library (currently merges, removing duplicates) */
  async importLibrary(
    blob:
      | Blob
      | Required<ImportedDataState>["libraryItems"]
      | Promise<Required<ImportedDataState>["libraryItems"]>,
    defaultStatus: LibraryItem["status"] = "unpublished",
  ) {
    let libraryItems: LibraryItems;
    if (blob instanceof Blob) {
      const libraryFile = await loadLibraryFromBlob(blob);
      if (!libraryFile || !(libraryFile.libraryItems || libraryFile.library)) {
        return;
      }
      libraryItems = libraryFile.libraryItems || libraryFile.library || [];
    } else {
      libraryItems = restoreLibraryItems(await blob, defaultStatus);
    }

    const existingLibraryItems = await jotaiStore.get(libraryItemsAtom)!;

    const filteredItems = [];
    for (const item of libraryItems) {
      if (isUniqueitem(existingLibraryItems, item)) {
        filteredItems.push(item);
      }
    }

    await this.saveLibrary([...filteredItems, ...existingLibraryItems]);
  }

  loadLibrary = (): Promise<LibraryItems> => {
    return new Promise(async (resolve) => {
      const libraryItems = (await jotaiStore.get(libraryItemsAtom)) || [];
      resolve(cloneLibraryItems(libraryItems));
    });
  };

  saveLibrary = async (items: LibraryItems) => {
    const prevLibraryItems = (await jotaiStore.get(libraryItemsAtom)) || [];
    try {
      jotaiStore.set(libraryItemsAtom, cloneLibraryItems(items));
      await this.app.props.onLibraryChange?.(items);
    } catch (error: any) {
      jotaiStore.set(libraryItemsAtom, prevLibraryItems);
      throw error;
    }
  };
}

export default Library;
