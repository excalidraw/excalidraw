import {
  FileWithHandle,
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  FileSystemHandle,
  supported as nativeFileSystemSupported,
} from "@dwelle/browser-fs-access";
import { EVENT, MIME_TYPES } from "../constants";
import { AbortError } from "../errors";

type FILE_TYPE =
  | "jpg"
  | "png"
  | "svg"
  | "json"
  | "excalidraw"
  | "excalidrawlib";

const FILE_TYPE_TO_MIME_TYPE: Record<FILE_TYPE, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  json: "application/json",
  excalidraw: MIME_TYPES.excalidraw,
  excalidrawlib: MIME_TYPES.excalidrawlib,
};

const INPUT_CHANGE_INTERVAL_MS = 500;

export const fileOpen = <M extends boolean | undefined = false>(opts: {
  extensions?: FILE_TYPE[];
  description?: string;
  multiple?: M;
}): Promise<
  M extends false | undefined ? FileWithHandle : FileWithHandle[]
> => {
  // an unsafe TS hack, alas not much we can do AFAIK
  type RetType = M extends false | undefined
    ? FileWithHandle
    : FileWithHandle[];

  const mimeTypes = opts.extensions?.reduce((mimeTypes, type) => {
    mimeTypes.push(FILE_TYPE_TO_MIME_TYPE[type]);

    return mimeTypes;
  }, [] as string[]);

  const extensions = opts.extensions?.reduce((acc, ext) => {
    if (ext === "jpg") {
      return acc.concat(".jpg", ".jpeg");
    }
    return acc.concat(`.${ext}`);
  }, [] as string[]);

  return _fileOpen({
    description: opts.description,
    extensions,
    mimeTypes,
    multiple: opts.multiple ?? false,
    legacySetup: (resolve, rejectHandler, input) => {
      requestAnimationFrame(() => {
        document.addEventListener(EVENT.KEYUP, rejectHandler);
        document.addEventListener(EVENT.POINTER_UP, rejectHandler);
      });
      const interval = window.setInterval(() => {
        // this hack might not work when expecting multiple files
        if (input.files?.length) {
          const ret = opts.multiple ? [...input.files] : input.files[0];
          resolve(ret as RetType);
        }
      }, INPUT_CHANGE_INTERVAL_MS);
      return (reject) => {
        clearInterval(interval);
        document.removeEventListener(EVENT.KEYUP, rejectHandler);
        document.removeEventListener(EVENT.POINTER_UP, rejectHandler);
        if (reject) {
          // so that something is shown in console if we need to debug this
          console.warn("Opening the file was canceled (legacy-fs).");
          reject(new AbortError());
        }
      };
    },
  }) as Promise<RetType>;
};

export const fileSave = (
  blob: Blob,
  opts: {
    /** supply without the extension */
    name: string;
    /** file extension */
    fileType: FILE_TYPE;
    description?: string;
    /** existing FileSystemHandle */
    fileHandle?: FileSystemHandle | null;
  },
) => {
  return _fileSave(
    blob,
    {
      fileName: `${opts.name}.${opts.fileType}`,
      description: opts.description,
      extensions: [`.${opts.fileType}`],
    },
    opts.fileHandle,
  );
};

export type { FileSystemHandle };
export { nativeFileSystemSupported };
