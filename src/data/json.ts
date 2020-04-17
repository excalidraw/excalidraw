import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { cleanAppStateForExport } from "../appState";

import { fileOpen, fileSave } from "browser-nativefs";
import { loadFromBlob } from "./blob";

export function serializeAsJSON(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): string {
  return JSON.stringify(
    {
      type: "excalidraw",
      version: 1,
      source: window.location.origin,
      elements: elements.filter((element) => !element.isDeleted),
      appState: cleanAppStateForExport(appState),
    },
    null,
    2,
  );
}

export async function saveAsJSON(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  const serialized = serializeAsJSON(elements, appState);

  const name = `${appState.name}.excalidraw`;
  await fileSave(
    new Blob([serialized], {
      type: /\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent)
        ? "application/json"
        : "application/vnd.excalidraw+json",
    }),
    {
      fileName: name,
      description: "Excalidraw file",
    },
    (window as any).handle,
  );
}
export async function loadFromJSON() {
  const blob = await fileOpen({
    description: "Excalidraw files",
    extensions: ["json", "excalidraw"],
    mimeTypes: ["application/json", "application/vnd.excalidraw+json"],
  });
  return loadFromBlob(blob);
}
