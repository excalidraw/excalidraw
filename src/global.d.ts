interface Window {
  ClipboardItem: any;
}

interface Clipboard extends EventTarget {
  write(data: any[]): Promise<void>;
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
