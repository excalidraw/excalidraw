import type { ExcalidrawElement } from "../element/types";
import type { AppState, BinaryFiles } from "../types";
import { prepareElementsForExport } from ".";
import { exportAsImage } from ".";
import { getFileHandleType, isImageFileHandleType } from "./blob";

export const resaveAsImageWithScene = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  name: string,
) => {
  const { exportBackground, viewBackgroundColor, fileHandle } = appState;

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

  const { exportedElements, exportingFrame } = prepareElementsForExport(
    elements,
    appState,
    false,
  );

  await exportAsImage({
    type: fileHandleType,
    data: { elements: exportedElements, appState, files },
    config: {
      exportBackground,
      viewBackgroundColor,
      name,
      fileHandle,
      exportingFrame,
    },
  });

  return { fileHandle };
};
