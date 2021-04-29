import { fileSave } from "browser-fs-access";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
// FIXME: rename these to exportToCanvasElement and exportToSvgElement?
import { serializeAsPngBlob, serializeToSvg } from "../scene/export";
import { ExportType } from "../scene/types";
import { AppState } from "../types";
import { serializeAsJSON } from "./json";

export { loadFromBlob } from "./blob";
export { saveToFilesystem, loadFromFilesystem } from "./json";

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
  const svgData = serializeToSvg(elements, {
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
      new Blob([svgData], { type: "image/svg+xml" }),
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
    copyTextToSystemClipboard(svgData);
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
  let blob = await serializeAsPngBlob(elements, appState, {
    exportBackground,
    viewBackgroundColor,
    exportPadding,
    scale,
    shouldAddWatermark,
  });

  if (type === "png") {
    const fileName = `${name}.png`;
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
      await copyBlobToClipboardAsPng(blob);
    } catch (error) {
      if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
        throw error;
      }
      throw new Error(t("alerts.couldNotCopyToClipboard"));
    }
  }
  // !!! FIXME: I have no idea what this if statement was here for.
  // !!! How could canvas === tempCanvas if we've only just created tempCanvas?
  // !!! Can we just delete the canvas argument entirely?
  // // clean up the DOM
  // if (tempCanvas !== canvas) {
  //   tempCanvas.remove();
  // }
};
