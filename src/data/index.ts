import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";
import { DEFAULT_EXPORT_PADDING, isFirefox, MIME_TYPES } from "../constants";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { exportToCanvas, exportToSvg } from "../scene/export";
import { ExportType } from "../scene/types";
import { AppState, BinaryFiles } from "../types";
import { canvasToBlob } from "./blob";
import { fileSave, FileSystemHandle } from "./filesystem";
import { serializeAsJSON } from "./json";

export { loadFromBlob } from "./blob";
export { loadFromJSON, saveAsJSON } from "./json";

export const exportCanvas = async (
  type: Omit<ExportType, "backend">,
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  {
    exportBackground,
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    name,
    fileHandle = null,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    name: string;
    fileHandle?: FileSystemHandle | null;
  },
) => {
  if (elements.length === 0) {
    throw new Error(t("alerts.cannotExportEmptyCanvas"));
  }
  if (type === "svg" || type === "clipboard-svg") {
    const tempSvg = await exportToSvg(
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
    );
    if (type === "svg") {
      return await fileSave(
        new Blob([tempSvg.outerHTML], { type: MIME_TYPES.svg }),
        {
          description: "Export to SVG",
          name,
          extension: appState.exportEmbedScene ? "excalidraw.svg" : "svg",
          fileHandle,
        },
      );
    } else if (type === "clipboard-svg") {
      await copyTextToSystemClipboard(tempSvg.outerHTML);
      return;
    }
  }

  const tempCanvas = await exportToCanvas(elements, appState, files, {
    exportBackground,
    viewBackgroundColor,
    exportPadding,
  });
  tempCanvas.style.display = "none";
  document.body.appendChild(tempCanvas);

  if (type === "png") {
    let blob = await canvasToBlob(tempCanvas);
    tempCanvas.remove();
    if (appState.exportEmbedScene) {
      blob = await (
        await import(/* webpackChunkName: "image" */ "./image")
      ).encodePngMetadata({
        blob,
        metadata: serializeAsJSON(elements, appState, files, "local"),
      });
    }

    return await fileSave(blob, {
      description: "Export to PNG",
      name,
      // FIXME reintroduce `excalidraw.png` when most people upgrade away
      // from 111.0.5563.64 (arm64), see #6349
      extension: /* appState.exportEmbedScene ? "excalidraw.png" : */ "png",
      fileHandle,
    });
  } else if (type === "clipboard") {
    try {
      const blob = canvasToBlob(tempCanvas);
      await copyBlobToClipboardAsPng(blob);
    } catch (error: any) {
      console.warn(error);
      if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
        throw error;
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
    } finally {
      tempCanvas.remove();
    }
  } else {
    tempCanvas.remove();
    // shouldn't happen
    throw new Error("Unsupported export type");
  }
};
