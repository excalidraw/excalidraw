import { loadLibraryFromBlob } from "./blob";
import { LibraryItems, LibraryItem, LibraryItems_anyVersion } from "../types";
import { restoreLibraryItems } from "./restore";
import type App from "../components/App";
import { atom } from "jotai";
import { jotaiStore } from "../jotai";
import { AbortError } from "../errors";
import { t } from "../i18n";

export const libraryItemsAtom = atom<{
  status: "loading" | "loaded";
  isInitialized: boolean;
  libraryItems: LibraryItems;
}>({ status: "loaded", isInitialized: true, libraryItems: [] });

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

/** Merges otherItems into localItems. Unique items in otherItems array are
    sorted first. */
export const mergeLibraryItems = (
  localItems: LibraryItems,
  otherItems: LibraryItems,
): LibraryItems => {
  const newItems = [];
  for (const item of otherItems) {
    if (isUniqueItem(localItems, item)) {
      newItems.push(item);
    }
  }

  return [...newItems, ...localItems];
};

class Library {
  /** latest libraryItems */
  private lastLibraryItems: LibraryItems = [];
  /** indicates whether library is initialized with library items (has gone
   * though at least one update) */
  private isInitialized = false;

  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  private updateQueue: Promise<LibraryItems>[] = [];

  private getLastUpdateTask = (): Promise<LibraryItems> | undefined => {
    return this.updateQueue[this.updateQueue.length - 1];
  };

  private notifyListeners = () => {
    if (this.updateQueue.length > 0) {
      jotaiStore.set(libraryItemsAtom, {
        status: "loading",
        libraryItems: this.lastLibraryItems,
        isInitialized: this.isInitialized,
      });
    } else {
      this.isInitialized = true;
      jotaiStore.set(libraryItemsAtom, {
        status: "loaded",
        libraryItems: this.lastLibraryItems,
        isInitialized: this.isInitialized,
      });
      try {
        this.app.props.onLibraryChange?.(
          cloneLibraryItems(this.lastLibraryItems),
        );
      } catch (error) {
        console.error(error);
      }
    }
  };

  resetLibrary = () => {
    return this.setLibrary([]);
  };

  /**
   * @returns latest cloned libraryItems. Awaits all in-progress updates first.
   */
  getLatestLibrary = (): Promise<LibraryItems> => {
    return new Promise(async (resolve) => {
      try {
        const libraryItems = await (this.getLastUpdateTask() ||
          this.lastLibraryItems);
        if (this.updateQueue.length > 0) {
          resolve(this.getLatestLibrary());
        } else {
          resolve(cloneLibraryItems(libraryItems));
        }
      } catch (error) {
        return resolve(this.lastLibraryItems);
      }
    });
  };

  // NOTE this is a high-level public API (eposed on ExcalidrawAPI) with
  // a slight overhead (always restoring library items). For internal use
  // where merging isn't needed, use `library.setLibrary()` directly.
  updateLibrary = async ({
    libraryItems,
    prompt = false,
    merge = false,
    openLibraryMenu = false,
    handleError = false,
    defaultStatus = "unpublished",
  }: {
    libraryItems:
      | ((
          currentLibraryItems: LibraryItems,
        ) =>
          | Blob
          | LibraryItems_anyVersion
          | Promise<LibraryItems_anyVersion | Blob>)
      | Blob
      | LibraryItems_anyVersion
      | Promise<LibraryItems_anyVersion | Blob>;
    merge?: boolean;
    prompt?: boolean;
    openLibraryMenu?: boolean;
    handleError?: boolean;
    defaultStatus?: "unpublished" | "published";
  }) => {
    if (openLibraryMenu) {
      this.app.setState({ isLibraryOpen: true });
    }

    this.setLibrary(() => {
      return new Promise<LibraryItems>(async (resolve, reject) => {
        try {
          const source = await (typeof libraryItems === "function"
            ? libraryItems(this.lastLibraryItems)
            : libraryItems);

          let nextItems;

          if (source instanceof Blob) {
            nextItems = await loadLibraryFromBlob(source, defaultStatus);
          } else {
            nextItems = restoreLibraryItems(source, defaultStatus);
          }
          if (
            !prompt ||
            window.confirm(
              t("alerts.confirmAddLibrary", {
                numShapes: nextItems.length,
              }),
            )
          ) {
            if (merge) {
              resolve(mergeLibraryItems(this.lastLibraryItems, nextItems));
            } else {
              resolve(nextItems);
            }
          } else {
            reject(new AbortError());
          }
        } catch (error: any) {
          reject(error);
        }
      });
    })
      .catch((error) => {
        if (handleError) {
          console.error(error);
          this.app.setState({ errorMessage: t("errors.importLibraryError") });
        } else {
          throw error;
        }
      })
      .finally(() => {
        this.app.focusContainer();
      });
  };

  setLibrary = (
    /**
     * LibraryItems that will replace current items. Can be a function which
     * will be invoked after all previous tasks are resolved
     * (this is the prefered way to update the library to avoid race conditions,
     * but you'll want to manually merge the library items in the callback
     *  - which is what we're doing in Library.importLibrary()).
     *
     * If supplied promise is rejected with AbortError, we swallow it and
     * do not update the library.
     */
    libraryItems:
      | LibraryItems
      | Promise<LibraryItems>
      | ((
          latestLibraryItems: LibraryItems,
        ) => LibraryItems | Promise<LibraryItems>),
  ): Promise<LibraryItems> => {
    const task = new Promise<LibraryItems>(async (resolve, reject) => {
      try {
        await this.getLastUpdateTask();

        if (typeof libraryItems === "function") {
          libraryItems = libraryItems(this.lastLibraryItems);
        }

        this.lastLibraryItems = cloneLibraryItems(await libraryItems);

        resolve(this.lastLibraryItems);
      } catch (error: any) {
        reject(error);
      }
    })
      .catch((error) => {
        if (error.name === "AbortError") {
          console.warn("Library update aborted by user");
          return this.lastLibraryItems;
        }
        throw error;
      })
      .finally(() => {
        this.updateQueue = this.updateQueue.filter((_task) => _task !== task);
        this.notifyListeners();
      });

    this.updateQueue.push(task);
    this.notifyListeners();

    return task;
  };
}

export default Library;
