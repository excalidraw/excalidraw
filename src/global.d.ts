interface Document {
  fonts?: {
    ready?: Promise<void>;
    addEventListener?<K extends "loading" | "loadingdone" | "loadingerror">(
      type: K,
      listener: (this: Document, ev: Event) => any,
    ): void;
  };
}

interface Window {
  ClipboardItem: any;
}

interface Clipboard extends EventTarget {
  write(data: any[]): Promise<void>;
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

type ResolutionType<T extends (...args: any) => any> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;
