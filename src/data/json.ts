import { fileOpen, fileSave } from "browser-fs-access";
import { cleanAppStateForExport } from "../appState";
import { EXPORT_DATA_TYPES, MIME_TYPES } from "../constants";
import { clearElementsForExport } from "../element";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { loadFromBlob } from "./blob";
import { Library } from "./library";
import { ImportedDataState } from "./types";

export const serializeAsJSON = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): string =>
  JSON.stringify(
    {
      type: EXPORT_DATA_TYPES.excalidraw,
      version: 2,
      source: window.location.origin,
      elements: clearElementsForExport(elements),
      appState: cleanAppStateForExport(appState),
    },
    null,
    2,
  );

export const saveAsJSON = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const serialized = serializeAsJSON(elements, appState);
  const blob = new Blob([serialized], {
    type: MIME_TYPES.excalidraw,
  });

  const fileHandle = await fileSave(
    blob,
    {
      fileName: `${appState.name}.excalidraw`,
      description: "Excalidraw file",
      extensions: [".excalidraw"],
    },
    appState.fileHandle,
  );
  return { fileHandle };
};

export const loadFromJSON = async (localAppState: AppState) => {
  const blob = await fileOpen({
    description: "Excalidraw files",
    // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
    // gets resolved. Else, iOS users cannot open `.excalidraw` files.
    /*
    extensions: [".json", ".excalidraw", ".png", ".svg"],
    mimeTypes: [
      MIME_TYPES.excalidraw,
      "application/json",
      "image/png",
      "image/svg+xml",
    ],
    */
  });
  return loadFromBlob(blob, localAppState);
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

export const isValidLibrary = (json: any) => {
  return (
    typeof json === "object" &&
    json &&
    json.type === EXPORT_DATA_TYPES.excalidrawLibrary &&
    json.version === 1
  );
};

export const saveLibraryAsJSON = async () => {
  const library = await Library.loadLibrary();
  const serialized = JSON.stringify(
    {
      type: EXPORT_DATA_TYPES.excalidrawLibrary,
      version: 1,
      library,
    },
    null,
    2,
  );
  const fileName = "library.excalidrawlib";
  const blob = new Blob([serialized], {
    type: MIME_TYPES.excalidrawlib,
  });
  await fileSave(blob, {
    fileName,
    description: "Excalidraw library file",
    extensions: [".excalidrawlib"],
  });
};

export const importLibraryFromJSON = async () => {
  const blob = await fileOpen({
    description: "Excalidraw library files",
    // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
    // gets resolved. Else, iOS users cannot open `.excalidraw` files.
    /*
    extensions: [".json", ".excalidrawlib"],
    */
  });
  Library.importLibrary(blob);
};
