import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { isImageElement } from "@excalidraw/element";
import { randomId } from "@excalidraw/common";
import type {
  BinaryFileData,
  DataURL,
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawImperativeAPI,
  FileId,
} from "@excalidraw/excalidraw/types";

export type ImageEditHistoryEntry = {
  op: string;
  ts: number;
  fileId: FileId;
  width: number;
  height: number;
  prevFileId: FileId;
  prevWidth: number;
  prevHeight: number;
};

export type ImageCustomData = {
  source?: string;
  originalFileId?: FileId;
  editHistory?: ImageEditHistoryEntry[];
  [key: string]: unknown;
};

export const blobToDataURL = (blob: Blob): Promise<DataURL> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as DataURL);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const dataURLToBlob = async (dataURL: string): Promise<Blob> => {
  const response = await fetch(dataURL);
  return response.blob();
};

export const buildBinaryFileData = async (
  blob: Blob,
  fileId?: FileId,
): Promise<BinaryFileData> => {
  const dataURL = await blobToDataURL(blob);
  return {
    id: (fileId ?? randomId()) as FileId,
    dataURL,
    mimeType: (blob.type || "image/png") as BinaryFileData["mimeType"],
    created: Date.now(),
  };
};

export const getImageDimensions = async (
  blob: Blob,
): Promise<{ width: number; height: number }> => {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return { width: bitmap.width, height: bitmap.height };
  }

  const dataURL = await blobToDataURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Unable to load image"));
    image.src = dataURL;
  });
};

const getImageElementOrThrow = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  elementId: string,
): ExcalidrawImageElement => {
  const element = excalidrawAPI
    .getSceneElements()
    .find((el) => el.id === elementId);

  if (!element || !isImageElement(element)) {
    throw new Error("Selected element is not an image.");
  }

  return element as ExcalidrawImageElement;
};

const buildUpdatedImageElement = (
  element: ExcalidrawImageElement,
  nextFileId: FileId,
  nextWidth: number,
  nextHeight: number,
  customDataPatch?: Partial<ImageCustomData>,
  historyEntry?: ImageEditHistoryEntry,
): ExcalidrawImageElement => {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;

  const previousCustomData = (element.customData ?? {}) as ImageCustomData;
  const history = Array.isArray(previousCustomData.editHistory)
    ? previousCustomData.editHistory
    : [];

  const updatedCustomData: ImageCustomData = {
    ...previousCustomData,
    ...customDataPatch,
    originalFileId: previousCustomData.originalFileId ?? element.fileId,
    editHistory: historyEntry ? [...history, historyEntry] : history,
  };

  return newElementWith(element, {
    fileId: nextFileId,
    width: nextWidth,
    height: nextHeight,
    x: centerX - nextWidth / 2,
    y: centerY - nextHeight / 2,
    customData: updatedCustomData,
  }) as ExcalidrawImageElement;
};

export const updateImageElement = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  elementId: string,
  patch: Partial<ExcalidrawImageElement>,
  customDataPatch?: Partial<ImageCustomData>,
) => {
  const currentElements = excalidrawAPI.getSceneElements();
  const element = getImageElementOrThrow(excalidrawAPI, elementId);

  const updatedElement = newElementWith(element, {
    ...patch,
    customData: {
      ...(element.customData ?? {}),
      ...customDataPatch,
    },
  }) as ExcalidrawImageElement;

  const nextElements = currentElements.map((el) =>
    el.id === elementId ? updatedElement : el,
  );

  excalidrawAPI.updateScene({
    elements: nextElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};

export const replaceImageFile = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  elementId: string,
  blob: Blob,
  mimeType?: string,
  nextWidth?: number,
  nextHeight?: number,
  customDataPatch?: Partial<ImageCustomData>,
  op = "edit",
) => {
  const element = getImageElementOrThrow(excalidrawAPI, elementId);
  const binaryFile = await buildBinaryFileData(
    mimeType ? new Blob([blob], { type: mimeType }) : blob,
  );

  const dimensions =
    nextWidth && nextHeight
      ? { width: nextWidth, height: nextHeight }
      : await getImageDimensions(blob);

  const historyEntry: ImageEditHistoryEntry = {
    op,
    ts: Date.now(),
    fileId: binaryFile.id,
    width: dimensions.width,
    height: dimensions.height,
    prevFileId: element.fileId,
    prevWidth: element.width,
    prevHeight: element.height,
  };

  excalidrawAPI.addFiles([binaryFile]);

  const currentElements = excalidrawAPI.getSceneElements();
  const updatedElement = buildUpdatedImageElement(
    element,
    binaryFile.id,
    dimensions.width,
    dimensions.height,
    customDataPatch,
    historyEntry,
  );

  const nextElements = currentElements.map((el) =>
    el.id === elementId ? updatedElement : el,
  );

  excalidrawAPI.updateScene({
    elements: nextElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  return {
    fileId: binaryFile.id,
    width: dimensions.width,
    height: dimensions.height,
  };
};

export const getSelectedImageElement = (
  elements: readonly ExcalidrawElement[],
  selectedElementIds: Record<string, boolean> | null | undefined,
): ExcalidrawImageElement | null => {
  if (!selectedElementIds) {
    return null;
  }

  const selectedIds = Object.keys(selectedElementIds).filter(
    (id) => selectedElementIds[id],
  );

  const selected = elements.find((el) => selectedIds.includes(el.id));
  return selected && isImageElement(selected)
    ? (selected as ExcalidrawImageElement)
    : null;
};

export const duplicateImageElement = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  elementId: string,
) => {
  const element = getImageElementOrThrow(excalidrawAPI, elementId);
  const currentElements = excalidrawAPI.getSceneElements();

  const duplicated = newElementWith(element, {
    id: randomId(),
    x: element.x + 24,
    y: element.y + 24,
    customData: {
      ...(element.customData ?? {}),
      duplicatedFrom: element.id,
    },
  }) as ExcalidrawImageElement;

  excalidrawAPI.updateScene({
    elements: [...currentElements, duplicated],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};
