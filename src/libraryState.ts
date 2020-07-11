import { LibraryItems } from "./types";
import { loadLibrary, saveLibrary } from "./data/localStorage";
import throttle from "lodash.throttle";

export interface LibraryStateCallback {
  (libraryElements: LibraryItems): void;
}

export interface LibraryStateCallbackRemover {
  (): void;
}

class LibraryState {
  private callbacks = new Set<LibraryStateCallback>();
  private libraryItems: LibraryItems = [];
  private initialized: boolean = false;

  constructor() {
    this.saveLibraryToDisk = throttle(this.saveLibraryToDisk.bind(this), 500);
  }

  private loadLibraryFromDisk(): Promise<LibraryItems> {
    return loadLibrary();
  }

  private saveLibraryToDisk() {
    saveLibrary(this.libraryItems).catch((e) => {
      console.error(e);
    });
  }

  addCallback(callback: LibraryStateCallback): LibraryStateCallbackRemover {
    if (!this.initialized) {
      this.initialized = true;
      this.loadLibraryFromDisk().then((library) => {
        this.replaceLibrary(() => library);
      });
    }
    this.callbacks.add(callback);
    callback(this.libraryItems);
    return () => {
      if (!this.callbacks.delete(callback)) {
        throw new Error("Cannot remove a callback more than once");
      }
    };
  }

  replaceLibrary(cb: (prevlibraryItems: LibraryItems) => LibraryItems) {
    if (!this.initialized) {
      this.initialized = true;
      this.loadLibraryFromDisk().then((libraryItems) => {
        this.libraryItems = cb(libraryItems);
        for (const callback of this.callbacks) {
          callback(this.libraryItems);
        }
      });
    }

    this.libraryItems = cb(this.libraryItems);
    for (const callback of this.callbacks) {
      callback(this.libraryItems);
    }
    this.saveLibraryToDisk();
  }
}

export const globalLibraryState = new LibraryState();
