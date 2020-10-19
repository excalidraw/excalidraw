import { cleanAppStateForExport } from "../appState";
import { restore } from "./restore";
import { t } from "../i18n";
import { AppState } from "../types";
import { LibraryData, ImportedDataState } from "./types";
import { calculateScrollCenter } from "../scene";
import { MIME_TYPES } from "../constants";

export const parseFileContents = async (blob: Blob | File) => {
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

const getMimeType = (blob: Blob): string => {
  if (blob.type) {
    return blob.type;
  }
  const name = blob.name || "";
  if (/\.(excalidraw|json)$/.test(name)) {
    return "application/json";
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
    return restore(
      {
        elements: data.elements,
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
  } catch {
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
