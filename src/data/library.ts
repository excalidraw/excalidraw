import { loadLibraryFromBlob } from "./blob";
import { LibraryItems, LibraryItem } from "../types";
import { restoreLibraryItems } from "./restore";
import type App from "../components/App";
import { ImportedDataState } from "./types";
import { atom } from "jotai";
import { jotaiStore } from "../jotai";
import { ExcalidrawElement } from "../element/types";
import { getCommonBoundingBox } from "../element/bounds";

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
   * imports library (from blob or libraryItems), merging with current library
   * (attempting to remove duplicates)
   */
  importLibrary(
    library:
      | Blob
      | Required<ImportedDataState>["libraryItems"]
      | Promise<Required<ImportedDataState>["libraryItems"]>,
    defaultStatus: LibraryItem["status"] = "unpublished",
  ): Promise<LibraryItems> {
    return this.setLibrary(
      () =>
        new Promise<LibraryItems>(async (resolve, reject) => {
          try {
            let libraryItems: LibraryItems;
            if (library instanceof Blob) {
              libraryItems = await loadLibraryFromBlob(library, defaultStatus);
            } else {
              libraryItems = restoreLibraryItems(await library, defaultStatus);
            }

            resolve(mergeLibraryItems(this.lastLibraryItems, libraryItems));
          } catch (error) {
            reject(error);
          }
        }),
    );
  }

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

export const distributeLibraryItemsOnSquareGrid = (
  libraryItems: LibraryItems,
) => {
  const PADDING = 50;
  const ITEMS_PER_ROW = Math.ceil(Math.sqrt(libraryItems.length));

  const resElements: ExcalidrawElement[] = [];

  const getMaxHeightPerRow = (row: number) => {
    const maxHeight = libraryItems
      .slice(row * ITEMS_PER_ROW, row * ITEMS_PER_ROW + ITEMS_PER_ROW)
      .reduce((acc, item) => {
        const { height } = getCommonBoundingBox(item.elements);
        return Math.max(acc, height);
      }, 0);
    return maxHeight;
  };

  const getMaxWidthPerCol = (targetCol: number) => {
    let index = 0;
    let currCol = 0;
    let maxWidth = 0;
    for (const item of libraryItems) {
      if (index % ITEMS_PER_ROW === 0) {
        currCol = 0;
      }
      if (currCol === targetCol) {
        const { width } = getCommonBoundingBox(item.elements);
        maxWidth = Math.max(maxWidth, width);
      }
      index++;
      currCol++;
    }
    return maxWidth;
  };

  let colOffsetX = 0;
  let rowOffsetY = 0;

  let maxHeightCurrRow = 0;
  let maxWidthCurrCol = 0;

  let index = 0;
  let col = 0;
  let row = 0;

  for (const item of libraryItems) {
    if (index && index % ITEMS_PER_ROW === 0) {
      rowOffsetY += maxHeightCurrRow + PADDING;
      colOffsetX = 0;
      col = 0;
      row++;
    }

    if (col === 0) {
      maxHeightCurrRow = getMaxHeightPerRow(row);
    }
    maxWidthCurrCol = getMaxWidthPerCol(col);

    const { minX, minY, width, height } = getCommonBoundingBox(item.elements);
    const offsetCenterX = (maxWidthCurrCol - width) / 2;
    const offsetCenterY = (maxHeightCurrRow - height) / 2;
    resElements.push(
      // eslint-disable-next-line no-loop-func
      ...item.elements.map((element) => ({
        ...element,
        x:
          element.x +
          // offset for column
          colOffsetX +
          // offset to center in given square grid
          offsetCenterX -
          // subtract minX so that given item starts at 0 coord
          minX,
        y:
          element.y +
          // offset for row
          rowOffsetY +
          // offset to center in given square grid
          offsetCenterY -
          // subtract minY so that given item starts at 0 coord
          minY,
      })),
    );
    colOffsetX += maxWidthCurrCol + PADDING;
    index++;
    col++;
  }

  return resElements;
};
