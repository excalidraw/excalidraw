import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { exportCanvas } from ".";
import { getNonDeletedElements } from "../element";

export const resaveAsImageWithScene = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const {
    saveType,
    exportBackground,
    viewBackgroundColor,
    name,
    fileHandle,
  } = appState;
  if (!saveType || !fileHandle) {
    throw new Error(
      "fileHandle should exist and saveType should be svg or png when resaving",
    );
  }
  appState = {
    ...appState,
    exportEmbedScene: true,
  };

  await exportCanvas(saveType, getNonDeletedElements(elements), appState, {
    exportBackground,
    viewBackgroundColor,
    name,
    fileHandle,
  });

  return { fileHandle };
};
