import { cleanAppStateForExport } from "../appState";
import { MIME_TYPES } from "../constants";
import { clearElementsForExport } from "../element";
import { CanvasError } from "../errors";
import { t } from "../i18n";
import { calculateScrollCenter } from "../scene";
import { AppState } from "../types";
import { restore } from "./restore";
import { ImportedDataState, LibraryData } from "./types";

const parseFileContents = async (blob: Blob | File) => {
  let contents: string;

  if (blob.type === "image/png") {
    try {
      return await (
        await import(/* webpackChunkName: "image" */ "./image")
      ).decodePngMetadata(blob);
    } catch (error) {
      if (error.message === "INVALID") {
        throw new Error(t("alerts.imageDoesNotContainScene"));
      } else {
        throw new Error(t("alerts.cannotRestoreFromImage"));
      }
    }
  } else {
    if ("text" in Blob) {
      contents = await blob.text();
    } else {
      contents = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsText(blob, "utf8");
        reader.onloadend = () => {
          if (reader.readyState === FileReader.DONE) {
            resolve(reader.result as string);
          }
        };
      });
    }
    if (blob.type === "image/svg+xml") {
      try {
        return await (
          await import(/* webpackChunkName: "image" */ "./image")
        ).decodeSvgMetadata({
          svg: contents,
        });
      } catch (error) {
        if (error.message === "INVALID") {
          throw new Error(t("alerts.imageDoesNotContainScene"));
        } else {
          throw new Error(t("alerts.cannotRestoreFromImage"));
        }
      }
    }
  }
  return contents;
};

export const getMimeType = (blob: Blob | string): string => {
  let name: string;
  if (typeof blob === "string") {
    name = blob;
  } else {
    if (blob.type) {
      return blob.type;
    }
    name = blob.name || "";
  }
  if (/\.(excalidraw|json)$/.test(name)) {
    return "application/json";
  } else if (/\.png$/.test(name)) {
    return "image/png";
  } else if (/\.jpe?g$/.test(name)) {
    return "image/jpeg";
  } else if (/\.svg$/.test(name)) {
    return "image/svg+xml";
  }
  return "";
};

export const loadFromBlob = async (
  blob: Blob,
  /** @see restore.localAppState */
  localAppState: AppState | null,
) => {
  const contents = await parseFileContents(blob);
  try {
    const data: ImportedDataState = JSON.parse(contents);
    if (data.type !== "excalidraw") {
      throw new Error(t("alerts.couldNotLoadInvalidFile"));
    }
    const result = restore(
      {
        elements: clearElementsForExport(data.elements || []),
        appState: {
          appearance: localAppState?.appearance,
          fileHandle:
            blob.handle &&
            ["application/json", MIME_TYPES.excalidraw].includes(
              getMimeType(blob),
            )
              ? blob.handle
              : null,
          ...cleanAppStateForExport(data.appState || {}),
          ...(localAppState
            ? calculateScrollCenter(data.elements || [], localAppState, null)
            : {}),
        },
      },
      localAppState,
    );

    return result;
  } catch (error) {
    console.error(error.message);
    throw new Error(t("alerts.couldNotLoadInvalidFile"));
  }
};

export const loadLibraryFromBlob = async (blob: Blob) => {
  const contents = await parseFileContents(blob);
  const data: LibraryData = JSON.parse(contents);
  if (data.type !== "excalidrawlib") {
    throw new Error(t("alerts.couldNotLoadInvalidFile"));
  }
  return data;
};

export const canvasToBlob = async (
  canvas: HTMLCanvasElement,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          return reject(
            new CanvasError(
              t("canvasError.canvasTooBig"),
              "CANVAS_POSSIBLY_TOO_BIG",
            ),
          );
        }
        resolve(blob);
      });
    } catch (error) {
      reject(error);
    }
  });
};
