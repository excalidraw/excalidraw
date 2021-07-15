import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { exportCanvas } from ".";
import { getNonDeletedElements } from "../element";
import { getFileHandleType, isImageFileHandleType } from "./blob";

export const resaveAsImageWithScene = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const { exportBackground, viewBackgroundColor, name, fileHandle } = appState;

  const fileHandleType = getFileHandleType(fileHandle);

  if (!fileHandle || !isImageFileHandleType(fileHandleType)) {
    throw new Error(
      "fileHandle should exist and should be of type svg or png when resaving",
    );
  }
  appState = {
    ...appState,
    exportEmbedScene: true,
  };

  await exportCanvas(
    fileHandleType,
    getNonDeletedElements(elements),
    appState,
    {
      exportBackground,
      viewBackgroundColor,
      name,
      fileHandle,
    },
  );

  return { fileHandle };
};
