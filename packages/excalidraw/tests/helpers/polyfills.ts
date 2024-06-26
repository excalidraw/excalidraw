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

class DataTransferList {
  items: DataTransferItem[] = [];

  add(data: string | File, type: string = ""): void {
    if (typeof data === "string") {
      this.items.push(new DataTransferItem("string", type, data));
    } else if (data instanceof File) {
      this.items.push(new DataTransferItem("file", type, data));
    }
  }

  clear(): void {
    this.items = [];
  }
}

class DataTransfer {
  public items: DataTransferList = new DataTransferList();
  private _types: Record<string, string> = {};

  get files() {
    return this.items.items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile()!);
  }

  add(data: string | File, type: string = ""): void {
    this.items.add(data, type);
  }

  setData(type: string, value: string) {
    this._types[type] = value;
  }

  getData(type: string) {
    return this._types[type] || "";
  }
}

export const testPolyfills = {
  ClipboardEvent,
  DataTransfer,
  DataTransferItem,
  // https://github.com/vitest-dev/vitest/pull/4164#issuecomment-2172729965
  URL,
};
