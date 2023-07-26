// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Document {
  fonts?: {
    ready?: Promise<void>;
    check?: (font: string, text?: string) => boolean;
    load?: (font: string, text?: string) => Promise<FontFace[]>;
    addEventListener?(
      type: "loading" | "loadingdone" | "loadingerror",
      listener: (this: Document, ev: Event) => any,
    ): void;
  };
}

interface Window {
  ClipboardItem: any;
  __EXCALIDRAW_SHA__: string | undefined;
  EXCALIDRAW_ASSET_PATH: string | undefined;
  EXCALIDRAW_EXPORT_SOURCE: string;
  EXCALIDRAW_THROTTLE_RENDER: boolean | undefined;
  gtag: Function;
  sa_event: Function;
  fathom: { trackEvent: Function };
}

interface CanvasRenderingContext2D {
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/roundRect
  roundRect?: (
    x: number,
    y: number,
    width: number,
    height: number,
    radii:
      | number // [all-corners]
      | [number] // [all-corners]
      | [number, number] // [top-left-and-bottom-right, top-right-and-bottom-left]
      | [number, number, number] // [top-left, top-right-and-bottom-left, bottom-right]
      | [number, number, number, number], // [top-left, top-right, bottom-right, bottom-left]
  ) => void;
}

// https://github.com/facebook/create-react-app/blob/ddcb7d5/packages/react-scripts/lib/react-app.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_BACKEND_V2_GET_URL: string;
    readonly REACT_APP_BACKEND_V2_POST_URL: string;
    readonly REACT_APP_PORTAL_URL: string;
    readonly REACT_APP_FIREBASE_CONFIG: string;
  }
}

interface Clipboard extends EventTarget {
  write(data: any[]): Promise<void>;
}

// PNG encoding/decoding
// -----------------------------------------------------------------------------
type TEXtChunk = { name: "tEXt"; data: Uint8Array };

declare module "png-chunk-text" {
  function encode(
    name: string,
    value: string,
  ): { name: "tEXt"; data: Uint8Array };
  function decode(data: Uint8Array): { keyword: string; text: string };
}
declare module "png-chunks-encode" {
  function encode(chunks: TEXtChunk[]): Uint8Array;
  export = encode;
}
declare module "png-chunks-extract" {
  function extract(buffer: Uint8Array): TEXtChunk[];
  export = extract;
}
// -----------------------------------------------------------------------------

interface Blob {
  handle?: import("browser-fs-acces").FileSystemHandle;
  name?: string;
}

declare module "*.scss";

// --------------------------------------------------------------------------—
// ensure Uint8Array isn't assignable to ArrayBuffer
// (due to TS structural typing)
// https://github.com/microsoft/TypeScript/issues/31311#issuecomment-490690695
interface ArrayBuffer {
  _brand?: "ArrayBuffer";
}
interface Uint8Array {
  _brand?: "Uint8Array";
}
// --------------------------------------------------------------------------—

// https://github.com/nodeca/image-blob-reduce/issues/23#issuecomment-783271848
declare module "image-blob-reduce" {
  import { PicaResizeOptions, Pica } from "pica";
  namespace ImageBlobReduce {
    interface ImageBlobReduce {
      toBlob(file: File, options: ImageBlobReduceOptions): Promise<Blob>;
      _create_blob(
        this: { pica: Pica },
        env: {
          out_canvas: HTMLCanvasElement;
          out_blob: Blob;
        },
      ): Promise<any>;
    }

    interface ImageBlobReduceStatic {
      new (options?: any): ImageBlobReduce;

      (options?: any): ImageBlobReduce;
    }

    interface ImageBlobReduceOptions extends PicaResizeOptions {
      max: number;
    }
  }
  const reduce: ImageBlobReduce.ImageBlobReduceStatic;
  export = reduce;
}
