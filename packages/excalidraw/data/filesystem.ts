import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  supported as nativeFileSystemSupported,
} from "browser-fs-access";

import { EVENT, MIME_TYPES, debounce } from "@excalidraw/common";

import { AbortError } from "../errors";

import { normalizeFile } from "./blob";

import type { FileSystemHandle } from "browser-fs-access";

type FILE_EXTENSION = Exclude<keyof typeof MIME_TYPES, "binary">;

const INPUT_CHANGE_INTERVAL_MS = 5000;

/**
 * Check if running on Capacitor native platform (Android/iOS)
 * Uses dynamic check to avoid import errors on web
 */
export const isCapacitorNative = (): boolean => {
  try {
    // Check if Capacitor is available and we're on a native platform
    const Capacitor = (window as any).Capacitor;
    return Capacitor?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
};

/**
 * Save file using Capacitor Filesystem (for Android/iOS)
 */
const fileSaveCapacitor = async (
  blob: Blob | Promise<Blob>,
  opts: {
    name: string;
    extension: FILE_EXTENSION;
  },
): Promise<FileSystemHandle | null> => {
  const resolvedBlob = await blob;
  const fileName = `${opts.name}.${opts.extension}`;

  try {
    // Dynamically import Capacitor modules to avoid bundling issues on web
    const { Filesystem, Directory } = await import("@capacitor/filesystem");

    // Convert blob to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64 || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(resolvedBlob);
    });

    // Save to Documents directory
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });

    console.log("File saved to:", result.uri);

    // Show a toast/alert to the user about where the file was saved
    if ((window as any).alert) {
      (window as any).alert(`File saved to Documents/${fileName}`);
    }

    return null; // Capacitor doesn't use FileSystemHandle
  } catch (error) {
    console.error("Error saving file with Capacitor:", error);
    throw error;
  }
};

export const fileOpen = async <M extends boolean | undefined = false>(opts: {
  extensions?: FILE_EXTENSION[];
  description: string;
  multiple?: M;
}): Promise<M extends false | undefined ? File : File[]> => {
  // an unsafe TS hack, alas not much we can do AFAIK
  type RetType = M extends false | undefined ? File : File[];

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

  const files = await _fileOpen({
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
  });

  if (Array.isArray(files)) {
    return (await Promise.all(
      files.map((file) => normalizeFile(file)),
    )) as RetType;
  }
  return (await normalizeFile(files)) as RetType;
};

export const fileSave = (
  blob: Blob | Promise<Blob>,
  opts: {
    /** supply without the extension */
    name: string;
    /** file extension */
    extension: FILE_EXTENSION;
    mimeTypes?: string[];
    description: string;
    /** existing FileSystemHandle */
    fileHandle?: FileSystemHandle | null;
  },
) => {
  // Use Capacitor filesystem on native platforms (Android/iOS)
  if (isCapacitorNative()) {
    return fileSaveCapacitor(blob, {
      name: opts.name,
      extension: opts.extension,
    });
  }

  // Use browser-fs-access on web
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
