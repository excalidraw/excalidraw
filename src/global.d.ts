interface Document {
  fonts?: {
    ready?: Promise<void>;
    addEventListener?(
      type: "loading" | "loadingdone" | "loadingerror",
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

// https://github.com/krzkaczor/ts-essentials
type MarkOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
