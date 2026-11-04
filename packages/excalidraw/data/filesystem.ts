import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  supported as nativeFileSystemSupported,
} from "browser-fs-access";

import { MIME_TYPES } from "@excalidraw/common";

import { normalizeFile } from "./blob";

type FILE_EXTENSION = Exclude<keyof typeof MIME_TYPES, "binary">;

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
  });

  if (Array.isArray(files)) {
    return (await Promise.all(
      files.map((file) => normalizeFile(file)),
    )) as RetType;
  }
  return (await normalizeFile(files)) as RetType;
};

/**
 * Fall back to a regular anchor download. Used when the native File System
 * Access API is present but blocked by the platform (see `fileSave`).
 */
const downloadBlob = async (
  blob: Blob | Promise<Blob>,
  fileName: string,
): Promise<null> => {
  const url = URL.createObjectURL(await blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // revoke on the next tick so the download has a chance to start
  setTimeout(() => URL.revokeObjectURL(url));
  return null;
};

export const fileSave = async (
  blob: Blob | Promise<Blob>,
  opts: {
    /** supply without the extension */
    name: string;
    /** file extension */
    extension: FILE_EXTENSION;
    mimeTypes?: string[];
    description: string;
    /** existing FileSystemFileHandle */
    fileHandle?: FileSystemFileHandle | null;
  },
) => {
  const fileName = `${opts.name}.${opts.extension}`;
  try {
    return await _fileSave(
      blob,
      {
        fileName,
        description: opts.description,
        extensions: [`.${opts.extension}`],
        mimeTypes: opts.mimeTypes,
      },
      opts.fileHandle,
      false,
    );
  } catch (error: any) {
    // user dismissed the native save picker — propagate so callers can
    // distinguish a cancel from a real failure
    if (error?.name === "AbortError") {
      throw error;
    }
    // the native File System Access API may exist but be blocked by the
    // platform (e.g. when embedded in a cross-origin iframe, or invoked
    // without a transient user activation), in which case `showSaveFilePicker`
    // throws instead of letting browser-fs-access fall back to a download.
    // Fall back manually so the export still succeeds.
    if (nativeFileSystemSupported) {
      return downloadBlob(blob, fileName);
    }
    throw error;
  }
};

export { nativeFileSystemSupported };
