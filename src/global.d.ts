interface Document {
  fonts?: {
    ready?: Promise<void>;
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

declare module "quill/dist/quill.core";
declare module "quill/dist/quill.bubble.css";
declare module "quill/core";
declare module "quill/modules/toolbar";
declare module "quill/themes/snow";
declare module "quill/themes/bubble";
declare module "quill/formats/bold";
declare module "quill/formats/italic";
declare module "quill/formats/color";
declare module "quill/formats/size";
declare module "quill/formats/font";
