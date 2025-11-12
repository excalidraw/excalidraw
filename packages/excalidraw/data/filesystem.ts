import {
  supported as nativeFileSystemSupported,
  type FileSystemHandle,
} from "browser-fs-access";

import { MIME_TYPES } from "@excalidraw/common";

import { AbortError } from "../errors";

import { normalizeFile } from "./blob";

import { openFileSafe, saveFileSafe } from "./fs-adapter";

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

  const files = await openFileSafe({
    description: opts.description,
    extensions,
    mimeTypes,
    multiple: opts.multiple ?? false,
  });

  // User canceled - throw AbortError to maintain backward compatibility
  if (files === null) {
    throw new AbortError();
  }

  if (Array.isArray(files)) {
    return (await Promise.all(
      files.map((file) => normalizeFile(file)),
    )) as RetType;
  }
  return (await normalizeFile(files)) as RetType;
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
    /** existing FileSystemHandle */
    fileHandle?: FileSystemHandle | null;
  },
) => {
  const handle = await saveFileSafe(
    blob,
    {
      fileName: `${opts.name}.${opts.extension}`,
      description: opts.description,
      extensions: [`.${opts.extension}`],
      mimeTypes: opts.mimeTypes,
    },
    opts.fileHandle,
  );

  // User canceled - return null to maintain backward compatibility
  // Caller can check for null to detect cancel
  return handle;
};

export { nativeFileSystemSupported };
export type { FileSystemHandle };
