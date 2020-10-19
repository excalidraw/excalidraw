import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { cleanAppStateForExport } from "../appState";

import { fileOpen, fileSave } from "browser-nativefs";
import { loadFromBlob } from "./blob";
import { loadLibrary } from "./localStorage";
import { Library } from "./library";
import { MIME_TYPES } from "../constants";

export const serializeAsJSON = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): string =>
  JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: window.location.origin,
      elements: elements.filter((element) => !element.isDeleted),
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
    type: "application/json",
  });

  const fileHandle = await fileSave(
    blob,
    {
      fileName: appState.name,
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
    extensions: [".json", ".excalidraw", ".png", ".svg"],
    mimeTypes: ["application/json", "image/png", "image/svg+xml"],
  });
  return loadFromBlob(blob, localAppState);
};

export const isValidLibrary = (json: any) => {
  return (
    typeof json === "object" &&
    json &&
    json.type === "excalidrawlib" &&
    json.version === 1
  );
};

export const saveLibraryAsJSON = async () => {
  const library = await loadLibrary();
  const serialized = JSON.stringify(
    {
      type: "excalidrawlib",
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
    extensions: [".json", ".excalidrawlib"],
    mimeTypes: ["application/json"],
  });
  Library.importLibrary(blob);
};
