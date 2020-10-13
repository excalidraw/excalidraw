import { cleanAppStateForExport } from "../appState";
import { restore } from "./restore";
import { t } from "../i18n";
import { AppState } from "../types";
import { LibraryData, ImportedDataState } from "./types";
import { calculateScrollCenter } from "../scene";
import { MIME_TYPES } from "../constants";
import { base64ToString } from "../base64";
export const parseFileContents = async (blob: Blob | File) => {
  let contents: string;
  if (blob.type === "image/png") {
    const metadata = await (await import("./png")).getTEXtChunk(blob);
    if (metadata?.keyword === MIME_TYPES.excalidraw) {
      return metadata.text;
    }
    throw new Error(t("alerts.imageDoesNotContainScene"));
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
      if (contents.includes(`payload-type:${MIME_TYPES.excalidraw}`)) {
        const match = contents.match(
          /<!-- payload-start -->(.+?)<!-- payload-end -->/,
        );
        if (!match) {
          throw new Error(t("alerts.imageDoesNotContainScene"));
        }
        return base64ToString(match[1]);
      }
      throw new Error(t("alerts.imageDoesNotContainScene"));
    }
  }
  return contents;
};

export const loadFromBlob = async (
  blob: any,
  /** @see restore.localAppState */
  localAppState: AppState | null,
) => {
  if (blob.handle) {
    // TODO: Make this part of `AppState`.
    (window as any).handle = blob.handle;
  }

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
