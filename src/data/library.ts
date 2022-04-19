import { loadLibraryFromBlob } from "./blob";
import { LibraryItems, LibraryItem } from "../types";
import { restoreLibraryItems } from "./restore";
import type App from "../components/App";
import { ImportedDataState } from "./types";
import { atom } from "jotai";
import { jotaiStore } from "../jotai";
import { isPromiseLike } from "../utils";

export const libraryItemsAtom = atom<
  | { status: "loading"; libraryItems: null; promise: Promise<LibraryItems> }
  | { status: "loaded"; libraryItems: LibraryItems }
>({ status: "loaded", libraryItems: [] });

const cloneLibraryItems = (libraryItems: LibraryItems): LibraryItems =>
  JSON.parse(JSON.stringify(libraryItems));

/**
 * checks if library item does not exist already in current library
 */
const isUniqueItem = (
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
  /** cache for currently active promise when initializing/updating libaries
   asynchronously */
  private libraryItemsPromise: Promise<LibraryItems> | null = null;
  /** last resolved libraryItems */
  private lastLibraryItems: LibraryItems = [];

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
    return this.saveLibrary(
      new Promise<LibraryItems>(async (resolve, reject) => {
        try {
          let libraryItems: LibraryItems;
          if (blob instanceof Blob) {
            const libraryFile = await loadLibraryFromBlob(blob);
            if (
              !libraryFile ||
              !(libraryFile.libraryItems || libraryFile.library)
            ) {
              throw new Error("Invalid library file");
            }
            libraryItems = restoreLibraryItems(
              libraryFile.libraryItems || libraryFile.library || [],
              defaultStatus,
            );
          } else {
            libraryItems = restoreLibraryItems(await blob, defaultStatus);
          }

          const existingLibraryItems = this.lastLibraryItems;

          const filteredItems = [];
          for (const item of libraryItems) {
            if (isUniqueItem(existingLibraryItems, item)) {
              filteredItems.push(item);
            }
          }

          resolve([...filteredItems, ...existingLibraryItems]);
        } catch (error) {
          reject(error);
        }
      }),
    );
  }

  loadLibrary = (): Promise<LibraryItems> => {
    return new Promise(async (resolve) => {
      try {
        resolve(
          cloneLibraryItems(
            await (this.libraryItemsPromise || this.lastLibraryItems),
          ),
        );
      } catch (error) {
        return resolve(this.lastLibraryItems);
      }
    });
  };

  saveLibrary = async (items: LibraryItems | Promise<LibraryItems>) => {
    const prevLibraryItems = this.lastLibraryItems;
    try {
      let nextLibraryItems;
      if (isPromiseLike(items)) {
        const promise = items.then((items) => cloneLibraryItems(items));
        this.libraryItemsPromise = promise;
        jotaiStore.set(libraryItemsAtom, {
          status: "loading",
          promise,
          libraryItems: null,
        });
        nextLibraryItems = await promise;
      } else {
        nextLibraryItems = cloneLibraryItems(items);
      }

      this.lastLibraryItems = nextLibraryItems;
      this.libraryItemsPromise = null;

      jotaiStore.set(libraryItemsAtom, {
        status: "loaded",
        libraryItems: nextLibraryItems,
      });
      await this.app.props.onLibraryChange?.(
        cloneLibraryItems(nextLibraryItems),
      );
    } catch (error: any) {
      this.lastLibraryItems = prevLibraryItems;
      this.libraryItemsPromise = null;
      jotaiStore.set(libraryItemsAtom, {
        status: "loaded",
        libraryItems: prevLibraryItems,
      });
      throw error;
    }
  };
}

export default Library;
