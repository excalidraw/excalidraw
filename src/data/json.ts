import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { cleanAppStateForExport } from "../appState";

import { fileOpen, fileSave } from "browser-nativefs";
import { loadFromBlob, loadLibraryFromBlob } from "./blob";
import { loadLibrary, saveLibrary } from "./localStorage";

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
  fileHandle: any,
) => {
  const serialized = serializeAsJSON(elements, appState);
  const blob = new Blob([serialized], {
    type: "application/json",
  });
  const name = `${appState.name}.excalidraw`;
  (window as any).handle = await fileSave(
    blob,
    {
      fileName: name,
      description: "Excalidraw file",
      extensions: ["excalidraw"],
    },
    fileHandle || null,
  );
};

export const loadFromJSON = async () => {
  const blob = await fileOpen({
    description: "Excalidraw files",
    extensions: ["json", "excalidraw"],
    mimeTypes: ["application/json"],
  });
  return loadFromBlob(blob);
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
  const fileName = `library.excalidrawlib`;
  const blob = new Blob([serialized], {
    type: "application/vnd.excalidrawlib+json",
  });
  await fileSave(blob, {
    fileName,
    description: "Excalidraw library file",
    extensions: ["excalidrawlib"],
  });
};

export const loadLibraryFromJSON = async () => {
  const blob = await fileOpen({
    description: "Excalidraw library files",
    extensions: ["json", "excalidrawlib"],
    mimeTypes: ["application/json"],
  });
  const data = await loadLibraryFromBlob(blob);
  if (data) {
    const library = await loadLibrary();
    data.library && saveLibrary([...library, ...data.library!]);
  }
};
