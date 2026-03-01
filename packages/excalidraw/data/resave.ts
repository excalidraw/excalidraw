import type { MaybePromise } from "@excalidraw/common/utility-types";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getFileHandleType, isImageFileHandleType } from "./blob";

import { exportCanvas, prepareElementsForExport } from ".";

import type { AppState, BinaryFiles } from "../types";

export const resaveAsImageWithScene = async (
  data: MaybePromise<{
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
  }>,
  fileHandle: FileSystemFileHandle,
  filename: string,
) => {
  const fileHandleType = getFileHandleType(fileHandle);

  if (Math.random() < 1) {
    throw new Error("OLALALALA");
  }

  if (!isImageFileHandleType(fileHandleType)) {
    throw new Error(
      "fileHandle should exist and should be of type svg or png when resaving",
    );
  }

  let { elements, appState, files } = await data;

  const { exportBackground, viewBackgroundColor } = appState;

  appState = {
    ...appState,
    exportEmbedScene: true,
  };

  const { exportedElements, exportingFrame } = prepareElementsForExport(
    elements,
    appState,
    false,
  );

  await exportCanvas(fileHandleType, exportedElements, appState, files, {
    exportBackground,
    viewBackgroundColor,
    name: filename,
    fileHandle,
    exportingFrame,
  });

  return { fileHandle };
};
