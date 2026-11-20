import { CaptureUpdateAction, isImageElement } from "@excalidraw/element";
import { getFlipAdjustedCropPosition } from "@excalidraw/element/cropElement";
import { loadHTMLImageElement } from "@excalidraw/element/image";

import { IMAGE_MIME_TYPES, MIME_TYPES } from "@excalidraw/common";

import type { ExcalidrawImageElement } from "@excalidraw/element/types";

import { downloadIcon } from "../components/icons";
import { dataURLToFile } from "../data/blob";
import { fileSave } from "../data/filesystem";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppClassProperties } from "../types";

const getExtensionFromMimeType = (mimeType: string) => {
  switch (mimeType) {
    case IMAGE_MIME_TYPES.svg:
      return "svg";
    case IMAGE_MIME_TYPES.jpg:
    case "image/jpg":
      return "jpg";
    case IMAGE_MIME_TYPES.gif:
      return "gif";
    case IMAGE_MIME_TYPES.webp:
      return "webp";
    case IMAGE_MIME_TYPES.bmp:
      return "bmp";
    case IMAGE_MIME_TYPES.ico:
      return "ico";
    case IMAGE_MIME_TYPES.avif:
      return "avif";
    case IMAGE_MIME_TYPES.jfif:
      return "jfif";
    case IMAGE_MIME_TYPES.png:
    default:
      return "png";
  }
};

const getCroppedImageBlob = async (
  element: ExcalidrawImageElement,
  app: AppClassProperties,
): Promise<Blob | null> => {
  if (!element.fileId) {
    return null;
  }
  const fileData = app.files[element.fileId];
  if (!fileData) {
    return null;
  }

  let image = await app.imageCache.get(element.fileId)?.image;
  if (!image && fileData.dataURL) {
    image = await loadHTMLImageElement(fileData.dataURL);
  }
  if (!image) {
    return null;
  }

  const crop = element.crop;
  if (!crop) {
    return null;
  }

  const canvas = app.ownerDocument.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const [scaleX, scaleY] = element.scale;
  if (scaleX === -1 || scaleY === -1) {
    ctx.save();
    ctx.translate(
      scaleX === -1 ? crop.width : 0,
      scaleY === -1 ? crop.height : 0,
    );
    ctx.scale(scaleX, scaleY);
  }

  const pos = getFlipAdjustedCropPosition(element, true) ?? {
    x: crop.x,
    y: crop.y,
  };

  ctx.drawImage(
    image,
    pos.x,
    pos.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  if (scaleX === -1 || scaleY === -1) {
    ctx.restore();
  }

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, MIME_TYPES.png);
  });
};

const downloadOriginalImage = async (
  element: ExcalidrawImageElement,
  app: AppClassProperties,
) => {
  if (!element.fileId) {
    return;
  }
  const fileData = app.files[element.fileId];
  if (!fileData) {
    return;
  }

  const extension = getExtensionFromMimeType(fileData.mimeType) as any;
  const filename = app.getName();
  const file = dataURLToFile(fileData.dataURL, filename);

  await fileSave(file, {
    name: filename,
    extension,
    description: "Download original image",
  });
};

const downloadImage = async (
  element: ExcalidrawImageElement,
  app: AppClassProperties,
) => {
  if (element.crop) {
    const blob = await getCroppedImageBlob(element, app);
    if (!blob) {
      return;
    }
    const filename = app.getName();
    await fileSave(blob, {
      name: filename,
      extension: "png",
      description: "Download cropped image",
    });
  } else {
    await downloadOriginalImage(element, app);
  }
};

export const actionDownloadImage = register({
  name: "downloadImage",
  label: (elements, appState) => {
    const selectedElement = getSelectedElements(elements, appState)[0];
    if (
      selectedElement &&
      isImageElement(selectedElement) &&
      selectedElement.crop
    ) {
      return "labels.downloadCroppedImage";
    }
    return "labels.downloadImage";
  },
  icon: downloadIcon,
  viewMode: true,
  trackEvent: { category: "menu" },
  keywords: ["image", "download", "save"],
  perform: async (elements, appState, _, app) => {
    const selectedElement = getSelectedElements(elements, appState)[0];
    if (!selectedElement || !isImageElement(selectedElement)) {
      return false;
    }

    try {
      await downloadImage(selectedElement, app);
      return {
        appState: {
          ...appState,
          toast: { message: t("toast.fileSaved"), duration: 3000 },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error(error);
        return {
          appState: {
            ...appState,
            errorMessage: error.message,
          },
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        };
      }
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
  },
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      !appState.croppingElementId &&
      selectedElements.length === 1 &&
      isImageElement(selectedElements[0])
    );
  },
});

export const actionDownloadOriginalImage = register({
  name: "downloadOriginalImage",
  label: "labels.downloadOriginalImage",
  icon: downloadIcon,
  viewMode: true,
  trackEvent: { category: "menu" },
  keywords: ["image", "download", "original", "save"],
  perform: async (elements, appState, _, app) => {
    const selectedElement = getSelectedElements(elements, appState)[0];
    if (!selectedElement || !isImageElement(selectedElement)) {
      return false;
    }

    try {
      await downloadOriginalImage(selectedElement, app);
      return {
        appState: {
          ...appState,
          toast: { message: t("toast.fileSaved"), duration: 3000 },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error(error);
        return {
          appState: {
            ...appState,
            errorMessage: error.message,
          },
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        };
      }
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
  },
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      !appState.croppingElementId &&
      selectedElements.length === 1 &&
      isImageElement(selectedElements[0]) &&
      Boolean(selectedElements[0].crop)
    );
  },
});
