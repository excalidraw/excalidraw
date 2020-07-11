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
  __EXCALIDRAW_SHA__: string;
}

// https://github.com/facebook/create-react-app/blob/ddcb7d5/packages/react-scripts/lib/react-app.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_BACKEND_V1_GET_URL: string;
    readonly REACT_APP_BACKEND_V2_GET_URL: string;
    readonly REACT_APP_BACKEND_V2_POST_URL: string;
    readonly REACT_APP_SOCKET_SERVER_URL: string;
  }
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
