import { URL } from "node:url";

class ClipboardEvent {
  constructor(
    type: "paste" | "copy",
    eventInitDict: {
      clipboardData: DataTransfer;
    },
  ) {
    return Object.assign(
      new Event("paste", {
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
      {
        clipboardData: eventInitDict.clipboardData,
      },
    ) as any as ClipboardEvent;
  }
}

type DataKind = "string" | "file";

class DataTransferItem {
  kind: DataKind;
  type: string;
  data: string | Blob;

  constructor(kind: DataKind, type: string, data: string | Blob) {
    this.kind = kind;
    this.type = type;
    this.data = data;
  }

  getAsString(callback: (data: string) => void): void {
    if (this.kind === "string") {
      callback(this.data as string);
    }
  }

  getAsFile(): File | null {
    if (this.kind === "file" && this.data instanceof File) {
      return this.data;
    }
    return null;
  }
}

class DataTransferItemList extends Array<DataTransferItem> {
  add(data: string | File, type: string = ""): void {
    if (typeof data === "string") {
      this.push(new DataTransferItem("string", type, data));
    } else if (data instanceof File) {
      this.push(new DataTransferItem("file", type, data));
    }
  }

  clear(): void {
    this.clear();
  }
}

class DataTransfer {
  public items: DataTransferItemList = new DataTransferItemList();

  get files() {
    return this.items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile()!);
  }

  add(data: string | File, type: string = ""): void {
    if (typeof data === "string") {
      this.items.add(data, type);
    } else {
      this.items.add(data);
    }
  }

  setData(type: string, value: string) {
    this.items.add(value, type);
  }

  getData(type: string) {
    return this.items.find((item) => item.type === type)?.data || "";
  }
}

export const testPolyfills = {
  ClipboardEvent,
  DataTransfer,
  DataTransferItem,
  // https://github.com/vitest-dev/vitest/pull/4164#issuecomment-2172729965
  URL,
};

export const PolyfillLocalStorage = () => {
  // Node.js 25+ provides a native localStorage global that shadows jsdom's,
  // and jsdom's own localStorage also uses the native one -- both are broken
  // (empty objects without Storage methods). On older Node versions, jsdom
  // provides a working localStorage. This polyfill replaces localStorage on
  // all supported versions with a standard Storage implementation backed by
  // a Map, ensuring consistent behavior regardless of the Node.js version.
  const storage = new Map<string, string>();
  const storagePolyfill: Storage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    key(index) {
      return Array.from(storage.keys())[index] ?? null;
    },
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
    removeItem(key) {
      storage.delete(key);
    },
    *[Symbol.iterator]() {
      yield* storage.entries();
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: storagePolyfill,
    writable: true,
    configurable: true,
  });
};
