import type { FileSystemHandle } from "browser-fs-access";
import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  supported as nativeFileSystemSupported,
} from "browser-fs-access";
import { EVENT, MIME_TYPES } from "../constants";
import { AbortError } from "../errors";
import { debounce } from "../utils";

export type FileExtension = Exclude<keyof typeof MIME_TYPES, "binary">;

export type FileOpenOptions<M extends boolean | undefined = false> = {
  extensions?: FileExtension[];
  description: string;
  multiple?: M;
  /** Route an unfiltered single-scene picker to the desktop bridge, if present. */
  desktopScene?: true;
};

export type FileSaveOptions = {
  /** supply without the extension */
  name: string;
  /** file extension */
  extension: FileExtension;
  mimeTypes?: string[];
  description: string;
  /** existing FileSystemHandle */
  fileHandle?: FileSystemHandle | null;
};

export type DesktopFileBridge = {
  fileOpen: <M extends boolean | undefined = false>(
    opts: FileOpenOptions<M>,
  ) => Promise<M extends false | undefined ? File : File[]>;
  fileSave: (
    blob: Blob | Promise<Blob>,
    opts: FileSaveOptions,
  ) => Promise<FileSystemHandle | null>;
};

declare global {
  interface Window {
    /** Installed by excalidraw-app only when running inside Tauri. */
    __EXCALIDRAW_DESKTOP__?: DesktopFileBridge;
  }
}

const INPUT_CHANGE_INTERVAL_MS = 500;

export const fileOpen = <M extends boolean | undefined = false>(
  opts: FileOpenOptions<M>,
): Promise<M extends false | undefined ? File : File[]> => {
  // an unsafe TS hack, alas not much we can do AFAIK
  type RetType = M extends false | undefined ? File : File[];

  // The app-level adapter is deliberately injected through a narrow global
  // seam so this reusable package does not depend on Tauri or its plugins.
  // Image and library import remain on the browser implementation for now; the
  // desktop bridge is limited to Excalidraw scene documents.
  const desktopFileOpen =
    typeof window !== "undefined" && window.__EXCALIDRAW_DESKTOP__;
  if (
    desktopFileOpen &&
    !opts.multiple &&
    (opts.extensions === undefined
      ? opts.desktopScene === true
      : opts.extensions.length > 0 &&
        opts.extensions.every((extension) =>
          ["json", "excalidraw"].includes(extension),
        ))
  ) {
    return desktopFileOpen.fileOpen(opts) as Promise<RetType>;
  }

  const mimeTypes = opts.extensions?.reduce((mimeTypes, type) => {
    mimeTypes.push(MIME_TYPES[type]);

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
    legacySetup: (resolve, reject, input) => {
      const scheduleRejection = debounce(reject, INPUT_CHANGE_INTERVAL_MS);
      const focusHandler = () => {
        checkForFile();
        document.addEventListener(EVENT.KEYUP, scheduleRejection);
        document.addEventListener(EVENT.POINTER_UP, scheduleRejection);
        scheduleRejection();
      };
      const checkForFile = () => {
        // this hack might not work when expecting multiple files
        if (input.files?.length) {
          const ret = opts.multiple ? [...input.files] : input.files[0];
          resolve(ret as RetType);
        }
      };
      requestAnimationFrame(() => {
        window.addEventListener(EVENT.FOCUS, focusHandler);
      });
      const interval = window.setInterval(() => {
        checkForFile();
      }, INPUT_CHANGE_INTERVAL_MS);
      return (rejectPromise) => {
        clearInterval(interval);
        scheduleRejection.cancel();
        window.removeEventListener(EVENT.FOCUS, focusHandler);
        document.removeEventListener(EVENT.KEYUP, scheduleRejection);
        document.removeEventListener(EVENT.POINTER_UP, scheduleRejection);
        if (rejectPromise) {
          // so that something is shown in console if we need to debug this
          console.warn("Opening the file was canceled (legacy-fs).");
          rejectPromise(new AbortError());
        }
      };
    },
  }) as Promise<RetType>;
};

export const fileSave = (blob: Blob | Promise<Blob>, opts: FileSaveOptions) => {
  const desktopFileBridge =
    typeof window !== "undefined" && window.__EXCALIDRAW_DESKTOP__;
  if (desktopFileBridge && ["json", "excalidraw"].includes(opts.extension)) {
    return desktopFileBridge.fileSave(blob, opts);
  }

  return _fileSave(
    blob,
    {
      fileName: `${opts.name}.${opts.extension}`,
      description: opts.description,
      extensions: [`.${opts.extension}`],
      mimeTypes: opts.mimeTypes,
    },
    opts.fileHandle,
  );
};

export { nativeFileSystemSupported };
export type { FileSystemHandle };
