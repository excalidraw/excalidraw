import { loadLibraryFromBlob } from "./blob";
import { LibraryItems, LibraryItem } from "../types";
import { loadLibrary, saveLibrary } from "./localStorage";

export class Library {
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
        //  are in order
        return libraryItem.every((libItemExcalidrawItem, idx) => {
          return (
            libItemExcalidrawItem.id === targetLibraryItem[idx].id &&
            libItemExcalidrawItem.versionNonce ===
              targetLibraryItem[idx].versionNonce
          );
        });
      });
    };

    const existingLibraryItems = await loadLibrary();
    const filtered = libraryFile.library!.filter((libraryItem) =>
      isUniqueitem(existingLibraryItems, libraryItem),
    );
    saveLibrary([...existingLibraryItems, ...filtered]);
  }
}
