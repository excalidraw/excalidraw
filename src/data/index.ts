import { fileSave } from "browser-fs-access";
import {
  copyCanvasToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
// FIXME: rename these to exportToCanvasElement and exportToSvgElement?
import { exportToCanvas, exportToSvg } from "../scene/export";
import { ExportType } from "../scene/types";
import { AppState } from "../types";
import { canvasToBlob } from "./blob";
import { serializeAsJSON } from "./json";

export { loadFromBlob } from "./blob";
export { loadFromJSON, saveAsJSON } from "./json";

type ExportOptions = {
  exportBackground: boolean;
  exportPadding?: number;
  viewBackgroundColor: string;
  name: string;
  scale?: number;
  shouldAddWatermark: boolean;
  exportEmbedScene: boolean;
};

export const exportCanvas = async (
  type: ExportType,
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  canvas: HTMLCanvasElement,
  options: ExportOptions,
) => {
  if (elements.length === 0) {
    throw new Error(t("alerts.cannotExportEmptyCanvas"));
  }
  if (type === "svg" || type === "clipboard-svg") {
    await exportToSVGForReal(type, elements, appState, canvas, options);
  } else if (type === "png" || type === "clipboard") {
    exportToPNGForReal(type, elements, appState, canvas, options);
  }
};

const exportToSVGForReal = async (
  type: ExportType,
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  canvas: HTMLCanvasElement,
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    name,
    scale = 1,
    shouldAddWatermark,
    exportEmbedScene,
  }: ExportOptions,
) => {
  const tempSvg = exportToSvg(elements, {
    exportBackground,
    exportWithDarkMode: appState.exportWithDarkMode,
    viewBackgroundColor,
    exportPadding,
    scale,
    shouldAddWatermark,
    metadata:
      exportEmbedScene && type === "svg"
        ? await (
            await import(/* webpackChunkName: "image" */ "./image")
          ).encodeSvgMetadata({
            text: serializeAsJSON(elements, appState),
          })
        : undefined,
  });
  if (type === "svg") {
    // FIXME: extract this as a shared helper?
    const fileHandle = await fileSave(
      new Blob([tempSvg.outerHTML], { type: "image/svg+xml" }),
      {
        fileName: `${name}.svg`,
        extensions: [".svg"],
      },
      appState.saveType === "svg" ? appState.fileHandle : null,
    );
    if (appState.saveType === "svg") {
      appState.fileHandle = fileHandle;
    }
  } else if (type === "clipboard-svg") {
    copyTextToSystemClipboard(tempSvg.outerHTML);
  }
};

const exportToPNGForReal = async (
  type: ExportType,
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  canvas: HTMLCanvasElement,
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    name,
    scale = 1,
    shouldAddWatermark,
    exportEmbedScene,
  }: ExportOptions,
) => {
  const tempCanvas = exportToCanvas(elements, appState, {
    exportBackground,
    viewBackgroundColor,
    exportPadding,
    scale,
    shouldAddWatermark,
  });
  tempCanvas.style.display = "none";
  document.body.appendChild(tempCanvas);

  if (type === "png") {
    const fileName = `${name}.png`;
    let blob = await canvasToBlob(tempCanvas);
    if (exportEmbedScene) {
      blob = await (
        await import(/* webpackChunkName: "image" */ "./image")
      ).encodePngMetadata({
        blob,
        metadata: serializeAsJSON(elements, appState),
      });
    }

    // FIXME: extract this as a shared helper?
    const fileHandle = await fileSave(
      blob,
      {
        fileName,
        extensions: [".png"],
      },
      appState.saveType === "png" ? appState.fileHandle : null,
    );
    if (appState.saveType === "png") {
      appState.fileHandle = fileHandle;
    }
  } else if (type === "clipboard") {
    try {
      await copyCanvasToClipboardAsPng(tempCanvas);
    } catch (error) {
      if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
        throw error;
      }
      throw new Error(t("alerts.couldNotCopyToClipboard"));
    }
  }

  // clean up the DOM
  if (tempCanvas !== canvas) {
    tempCanvas.remove();
  }
};
