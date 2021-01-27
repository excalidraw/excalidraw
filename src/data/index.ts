import { fileSave } from "browser-fs-access";
import {
  copyCanvasToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { exportToCanvas, exportToSvg } from "../scene/export";
import { ExportType } from "../scene/types";
import { AppState } from "../types";
import { canvasToBlob } from "./blob";
import { serializeAsJSON } from "./json";

export { loadFromBlob } from "./blob";
export { loadFromJSON, saveAsJSON } from "./json";

export const exportCanvas = async (
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
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    name: string;
    scale?: number;
    shouldAddWatermark: boolean;
  },
) => {
  if (elements.length === 0) {
    throw new Error(t("alerts.cannotExportEmptyCanvas"));
  }
  if (type === "svg" || type === "clipboard-svg") {
    const tempSvg = exportToSvg(elements, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
      scale,
      shouldAddWatermark,
      metadata:
        appState.exportEmbedScene && type === "svg"
          ? await (
              await import(/* webpackChunkName: "image" */ "./image")
            ).encodeSvgMetadata({
              text: serializeAsJSON(elements, appState),
            })
          : undefined,
    });
    if (type === "svg") {
      await fileSave(new Blob([tempSvg.outerHTML], { type: "image/svg+xml" }), {
        fileName: `${name}.svg`,
        extensions: [".svg"],
      });
      return;
    } else if (type === "clipboard-svg") {
      copyTextToSystemClipboard(tempSvg.outerHTML);
      return;
    }
  }

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
    if (appState.exportEmbedScene) {
      blob = await (
        await import(/* webpackChunkName: "image" */ "./image")
      ).encodePngMetadata({
        blob,
        metadata: serializeAsJSON(elements, appState),
      });
    }

    await fileSave(blob, {
      fileName,
      extensions: [".png"],
    });
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
