import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { cleanAppStateForExport } from "../appState";

import { fileOpen, fileSave } from "browser-nativefs";
import { loadFromBlob } from "./blob";

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
  // Either "Save as" or non-supporting browser
  if (!fileHandle) {
    const name = `${appState.name}.excalidraw`;
    const handle = await fileSave(
      blob,
      {
        fileName: name,
        description: "Excalidraw file",
        extensions: ["excalidraw"],
      },
      fileHandle,
    );
    (window as any).handle = handle;
    return;
  }
  // "Save"
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
};

export const loadFromJSON = async () => {
  const blob = await fileOpen({
    description: "Excalidraw files",
    extensions: ["json", "excalidraw"],
    mimeTypes: ["application/json"],
  });
  return loadFromBlob(blob);
};
