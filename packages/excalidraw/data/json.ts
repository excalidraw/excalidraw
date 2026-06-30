import {
  EXPORT_DATA_TYPES,
  getExportSource,
  MIME_TYPES,
  VERSIONS,
} from "@excalidraw/common";

import type { ExcalidrawElement, NonDeleted } from "@excalidraw/element/types";

import type { MaybePromise } from "@excalidraw/common/utility-types";

import { cleanAppStateForExport, clearAppStateForDatabase } from "../appState";

import { isImageFileHandle, loadFromBlob } from "./blob";
import { fileOpen, fileSave } from "./filesystem";

import type { AppState, BinaryFiles, LibraryItems } from "../types";
import type {
  ExportedDataState,
  ImportedDataState,
  ExportedLibraryData,
  ImportedLibraryData,
} from "./types";

const SCALAR_ROUNDED_KEYS = new Set(["x", "y", "width", "height"]);

// JSON.stringify encodes \x00 as \u0000 (6-char literal sequence) in the output
// string. We use this as a sentinel so we can strip the surrounding quotes
// afterward, emitting raw number tokens without a float round-trip.
const PRECISION_SENTINEL = "\x00";
const PRECISION_SENTINEL_RE = /"\\u0000([^"]+)\\u0000"/g;

export const stringifyWithPrecision = (
  value: unknown,
  precision = 2,
  space?: number | string,
): string => {
  const fmt = (n: number) =>
    `${PRECISION_SENTINEL}${n.toFixed(precision)}${PRECISION_SENTINEL}`;

  return JSON.stringify(
    value,
    (key, val) => {
      if (SCALAR_ROUNDED_KEYS.has(key) && typeof val === "number") {
        return fmt(val);
      }
      if (key === "points" && Array.isArray(val)) {
        return (val as number[][]).map((pt) =>
          Array.isArray(pt)
            ? pt.map((n) => (typeof n === "number" ? fmt(n) : n))
            : pt,
        );
      }
      return val;
    },
    space,
  ).replace(PRECISION_SENTINEL_RE, "$1");
};

export type JSONExportData = {
  elements: readonly NonDeleted<ExcalidrawElement>[];
  appState: AppState;
  files: BinaryFiles;
};

/**
 * Strips out files which are only referenced by deleted elements
 */
const filterOutDeletedFiles = (
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
) => {
  const nextFiles: BinaryFiles = {};
  for (const element of elements) {
    if (
      !element.isDeleted &&
      "fileId" in element &&
      element.fileId &&
      files[element.fileId]
    ) {
      nextFiles[element.fileId] = files[element.fileId];
    }
  }
  return nextFiles;
};

export const serializeAsJSON = (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  type: "local" | "database",
): string => {
  const data: ExportedDataState = {
    type: EXPORT_DATA_TYPES.excalidraw,
    version: VERSIONS.excalidraw,
    source: getExportSource(),
    elements,
    appState:
      type === "local"
        ? cleanAppStateForExport(appState)
        : clearAppStateForDatabase(appState),
    files:
      type === "local"
        ? filterOutDeletedFiles(elements, files)
        : // will be stripped from JSON
          undefined,
  };

  return stringifyWithPrecision(data, 2, 2);
};

export const saveAsJSON = async ({
  data,
  filename,
  fileHandle,
}: {
  data: MaybePromise<JSONExportData>;
  filename: string;
  fileHandle: AppState["fileHandle"];
}) => {
  const blob = Promise.resolve(data).then(({ elements, appState, files }) => {
    const serialized = serializeAsJSON(elements, appState, files, "local");
    return new Blob([serialized], {
      type: MIME_TYPES.excalidraw,
    });
  });

  const savedFileHandle = await fileSave(blob, {
    name: filename,
    extension: "excalidraw",
    description: "Excalidraw file",
    fileHandle: isImageFileHandle(fileHandle) ? null : fileHandle,
  });
  return { fileHandle: savedFileHandle };
};

export const loadFromJSON = async (
  localAppState: AppState,
  localElements: readonly ExcalidrawElement[] | null,
) => {
  const file = await fileOpen({
    description: "Excalidraw files",
    // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
    // gets resolved. Else, iOS users cannot open `.excalidraw` files.
    // extensions: ["json", "excalidraw", "png", "svg"],
  });
  return loadFromBlob(file, localAppState, localElements, file.handle);
};

export const isValidExcalidrawData = (data?: {
  type?: any;
  elements?: any;
  appState?: any;
}): data is ImportedDataState => {
  return (
    data?.type === EXPORT_DATA_TYPES.excalidraw &&
    (!data.elements ||
      (Array.isArray(data.elements) &&
        (!data.appState || typeof data.appState === "object")))
  );
};

export const isValidLibrary = (json: any): json is ImportedLibraryData => {
  return (
    typeof json === "object" &&
    json &&
    json.type === EXPORT_DATA_TYPES.excalidrawLibrary &&
    (json.version === 1 || json.version === 2)
  );
};

export const serializeLibraryAsJSON = (libraryItems: LibraryItems) => {
  const data: ExportedLibraryData = {
    type: EXPORT_DATA_TYPES.excalidrawLibrary,
    version: VERSIONS.excalidrawLibrary,
    source: getExportSource(),
    libraryItems,
  };
  return stringifyWithPrecision(data, 2, 2);
};

export const saveLibraryAsJSON = async (libraryItems: LibraryItems) => {
  const serialized = serializeLibraryAsJSON(libraryItems);
  await fileSave(
    new Blob([serialized], {
      type: MIME_TYPES.excalidrawlib,
    }),
    {
      name: "library",
      extension: "excalidrawlib",
      description: "Excalidraw library file",
    },
  );
};
