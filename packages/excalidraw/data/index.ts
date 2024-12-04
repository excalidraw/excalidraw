import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";
import {
  DEFAULT_EXPORT_PADDING,
  DEFAULT_FILENAME,
  isFirefox,
  MIME_TYPES,
} from "../constants";
import { getNonDeletedElements } from "../element";
import { isFrameLikeElement } from "../element/typeChecks";
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { t } from "../i18n";
import { isSomeElementSelected, getSelectedElements } from "../scene";
import { exportToCanvas, exportToSvg } from "../scene/export";
import type { ExportType } from "../scene/types";
import type { AppState, BinaryFiles } from "../types";
import { cloneJSON } from "../utils";
import { canvasToBlob } from "./blob";
import type { FileSystemHandle } from "./filesystem";
import { fileSave } from "./filesystem";
import { serializeAsJSON } from "./json";
import { getElementsOverlappingFrame } from "../frame";

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
    fileHandle?: FileSystemHandle | null;
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
          exportScale: data.appState.exportScale,
          exportEmbedScene: data.appState.exportEmbedScene && type === "svg",
        },
        files: data.files,
      },
      config: { exportingFrame: cfg.exportingFrame, padding: cfg.padding },
    });
    if (type === "svg") {
      return fileSave(
        svgPromise.then((svg) => {
          return new Blob([svg.outerHTML], { type: MIME_TYPES.svg });
        }),
        {
          description: "Export to SVG",
          name: cfg.name,
          extension: data.appState.exportEmbedScene ? "excalidraw.svg" : "svg",
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
    const blob = canvasToBlob(tempCanvas);
    if (data.appState.exportEmbedScene) {
      blob.then((blob) =>
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
      // FIXME reintroduce `excalidraw.png` when most people upgrade away
      // from 111.0.5563.64 (arm64), see #6349
      extension: /* appState.exportEmbedScene ? "excalidraw.png" : */ "png",
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
