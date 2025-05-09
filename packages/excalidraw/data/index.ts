import {
  DEFAULT_EXPORT_PADDING,
  DEFAULT_FILENAME,
  IMAGE_MIME_TYPES,
  isFirefox,
  MIME_TYPES,
  cloneJSON,
  SVG_DOCUMENT_PREAMBLE,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import { isFrameLikeElement } from "@excalidraw/element";

import { getElementsOverlappingFrame } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";

import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { exportToCanvas, exportToSvg } from "../scene/export";

import { canvasToBlob } from "./blob";
import { fileSave } from "./filesystem";
import { serializeAsJSON } from "./json";

import type { FileSystemHandle } from "./filesystem";

import type { ExportType } from "../scene/types";
import type { AppState, BinaryFiles } from "../types";

export { loadFromBlob } from "./blob";
export { loadFromJSON, saveAsJSON } from "./json";

export type ExportedElements = readonly NonDeletedExcalidrawElement[] & {
  _brand: "exportedElements";
};

export const prepareElementsForExport = (
  elements: readonly ExcalidrawElement[],
  { selectedElementIds }: Pick<AppState, "selectedElementIds">,
  exportSelectionOnly: boolean,
) => {
  elements = getNonDeletedElements(elements);

  const isExportingSelection =
    exportSelectionOnly &&
    isSomeElementSelected(elements, { selectedElementIds });

  let exportingFrame: ExcalidrawFrameLikeElement | null = null;
  let exportedElements = isExportingSelection
    ? getSelectedElements(
        elements,
        { selectedElementIds },
        {
          includeBoundTextElement: true,
        },
      )
    : elements;

  if (isExportingSelection) {
    if (
      exportedElements.length === 1 &&
      isFrameLikeElement(exportedElements[0])
    ) {
      exportingFrame = exportedElements[0];
      exportedElements = getElementsOverlappingFrame(elements, exportingFrame);
    } else if (exportedElements.length > 1) {
      exportedElements = getSelectedElements(
        elements,
        { selectedElementIds },
        {
          includeBoundTextElement: true,
          includeElementsInFrames: true,
        },
      );
    }
  }

  return {
    exportingFrame,
    exportedElements: cloneJSON(exportedElements) as ExportedElements,
  };
};

export const exportCanvas = async (
  type: Omit<ExportType, "backend">,
  elements: ExportedElements,
  appState: AppState,
  files: BinaryFiles,
  {
    exportBackground,
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    name = appState.name || DEFAULT_FILENAME,
    fileHandle = null,
    exportingFrame = null,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    /** filename, if applicable */
    name?: string;
    fileHandle?: FileSystemHandle | null;
    exportingFrame: ExcalidrawFrameLikeElement | null;
  },
) => {
  if (elements.length === 0) {
    throw new Error(t("alerts.cannotExportEmptyCanvas"));
  }
  if (type === "svg" || type === "clipboard-svg") {
    const svgPromise = exportToSvg(
      elements,
      {
        exportBackground,
        exportWithDarkMode: appState.exportWithDarkMode,
        viewBackgroundColor,
        exportPadding,
        exportScale: appState.exportScale,
        exportEmbedScene: appState.exportEmbedScene && type === "svg",
      },
      files,
      { exportingFrame },
    );

    if (type === "svg") {
      return fileSave(
        svgPromise.then((svg) => {
          // adding SVG preamble so that older software parse the SVG file
          // properly
          return new Blob([SVG_DOCUMENT_PREAMBLE + svg.outerHTML], {
            type: MIME_TYPES.svg,
          });
        }),
        {
          description: "Export to SVG",
          name,
          extension: appState.exportEmbedScene ? "excalidraw.svg" : "svg",
          mimeTypes: [IMAGE_MIME_TYPES.svg],
          fileHandle,
        },
      );
    } else if (type === "clipboard-svg") {
      const svg = await svgPromise.then((svg) => svg.outerHTML);
      try {
        await copyTextToSystemClipboard(svg);
      } catch (e) {
        throw new Error(t("errors.copyToSystemClipboardFailed"));
      }
      return;
    }
  }

  const tempCanvas = exportToCanvas(elements, appState, files, {
    exportBackground,
    viewBackgroundColor,
    exportPadding,
    exportingFrame,
  });

  if (type === "png") {
    let blob = canvasToBlob(tempCanvas);

    if (appState.exportEmbedScene) {
      blob = blob.then((blob) =>
        import("./image").then(({ encodePngMetadata }) =>
          encodePngMetadata({
            blob,
            metadata: serializeAsJSON(elements, appState, files, "local"),
          }),
        ),
      );
    }

    return fileSave(blob, {
      description: "Export to PNG",
      name,
      extension: appState.exportEmbedScene ? "excalidraw.png" : "png",
      mimeTypes: [IMAGE_MIME_TYPES.png],
      fileHandle,
    });
  } else if (type === "clipboard") {
    try {
      const blob = canvasToBlob(tempCanvas);
      await copyBlobToClipboardAsPng(blob);
    } catch (error: any) {
      console.warn(error);
      if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
        throw new Error(t("canvasError.canvasTooBig"));
      }
      // TypeError *probably* suggests ClipboardItem not defined, which
      // people on Firefox can enable through a flag, so let's tell them.
      if (isFirefox && error.name === "TypeError") {
        throw new Error(
          `${t("alerts.couldNotCopyToClipboard")}\n\n${t(
            "hints.firefox_clipboard_write",
          )}`,
        );
      } else {
        throw new Error(t("alerts.couldNotCopyToClipboard"));
      }
    }
  } else {
    // shouldn't happen
    throw new Error("Unsupported export type");
  }
};
