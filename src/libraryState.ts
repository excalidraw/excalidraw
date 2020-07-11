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
  private loadedPromise: Promise<void>;

  constructor() {
    this.saveLibraryToDisk = throttle(this.saveLibraryToDisk.bind(this), 500);
    this.loadedPromise = this.loadLibraryFromDisk();
  }

  private async loadLibraryFromDisk(): Promise<void> {
    this.libraryItems = await loadLibrary();
    for (const callback of this.callbacks) {
      callback(this.libraryItems);
    }
  }

  private saveLibraryToDisk() {
    this.loadedPromise.then(() => {
      return saveLibrary(this.libraryItems).catch((e) => {
        console.error(e);
      });
    });
  }

  addCallback(callback: LibraryStateCallback): LibraryStateCallbackRemover {
    this.callbacks.add(callback);
    callback(this.libraryItems);
    return () => {
      if (!this.callbacks.delete(callback)) {
        throw new Error("Cannot remove a callback more than once");
      }
    };
  }

  replaceLibrary(cb: (prevlibraryItems: LibraryItems) => LibraryItems) {
    this.loadedPromise.then(() => {
      this.libraryItems = cb(this.libraryItems);
      for (const callback of this.callbacks) {
        callback(this.libraryItems);
      }
      this.saveLibraryToDisk();
    });
  }
}

export const globalLibraryState = new LibraryState();
