import {
  DEFAULT_EXPORT_PADDING,
  DEFAULT_FILENAME,
  IMAGE_MIME_TYPES,
  isFirefox,
  MIME_TYPES,
  cloneJSON,
  SVG_DOCUMENT_PREAMBLE,
  arrayToMap,
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
  const elementsMap = arrayToMap(elements);

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
      exportedElements = getElementsOverlappingFrame(
        elements,
        exportingFrame,
        elementsMap,
      );
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

export const exportAsImage = async ({
  type,
  data,
  config,
}: {
  type: Omit<ExportType, "backend">;
  data: {
    elements: ExportedElements;
    appState: AppState;
    files: BinaryFiles;
  };
  config: {
    exportBackground: boolean;
    padding?: number;
    viewBackgroundColor: string;
    /** filename, if applicable */
    name?: string;
    fileHandle?: FileSystemFileHandle | null;
    exportingFrame: ExcalidrawFrameLikeElement | null;
  };
}) => {
  // clone
  const cfg = Object.assign({}, config);

  cfg.padding = cfg.padding ?? DEFAULT_EXPORT_PADDING;
  cfg.fileHandle = cfg.fileHandle ?? null;
  cfg.exportingFrame = cfg.exportingFrame ?? null;
  cfg.name = cfg.name || DEFAULT_FILENAME;

  if (data.elements.length === 0) {
    throw new Error(t("alerts.cannotExportEmptyCanvas"));
  }
  if (type === "svg" || type === "clipboard-svg") {
    const svgPromise = exportToSvg({
      data: {
        elements: data.elements,
        appState: {
          exportBackground: cfg.exportBackground,
          exportWithDarkMode: data.appState.exportWithDarkMode,
          viewBackgroundColor: data.appState.viewBackgroundColor,
          exportPadding: cfg.padding,
          exportScale: data.appState.exportScale,
          exportEmbedScene: data.appState.exportEmbedScene && type === "svg",
        },
        files: data.files,
      },
      config: { exportingFrame: cfg.exportingFrame },
    });
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
          name: cfg.name,
          extension: data.appState.exportEmbedScene ? "excalidraw.svg" : "svg",
          mimeTypes: [IMAGE_MIME_TYPES.svg],
          fileHandle: cfg.fileHandle,
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

  const tempCanvas = exportToCanvas({
    data,
    config: {
      canvasBackgroundColor: !cfg.exportBackground
        ? false
        : cfg.viewBackgroundColor,
      padding: cfg.padding,
      theme: data.appState.exportWithDarkMode ? "dark" : "light",
      scale: data.appState.exportScale,
      fit: "none",
      exportingFrame: cfg.exportingFrame,
    },
  });

  if (type === "png") {
    let blob = canvasToBlob(tempCanvas);
    if (data.appState.exportEmbedScene) {
      blob = blob.then((blob) =>
        import("./image").then(({ encodePngMetadata }) =>
          encodePngMetadata({
            blob,
            metadata: serializeAsJSON(
              data.elements,
              data.appState,
              data.files,
              "local",
            ),
          }),
        ),
      );
    }

    return fileSave(blob, {
      description: "Export to PNG",
      name: cfg.name,
      extension: data.appState.exportEmbedScene ? "excalidraw.png" : "png",
      mimeTypes: [IMAGE_MIME_TYPES.png],
      fileHandle: cfg.fileHandle,
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
