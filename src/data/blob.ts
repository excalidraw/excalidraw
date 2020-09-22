import { cleanAppStateForExport } from "../appState";
import { restore } from "./restore";
import { t } from "../i18n";
import { AppState } from "../types";
import { LibraryData, ImportedDataState } from "./types";
import { calculateScrollCenter } from "../scene";

const loadFileContents = async (blob: any) => {
  let contents: string;
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
  return contents;
};

/**
 * @param blob
 * @param appState if provided, used for centering scroll to restored scene
 */
export const loadFromBlob = async (blob: any, appState?: AppState) => {
  if (blob.handle) {
    // TODO: Make this part of `AppState`.
    (window as any).handle = blob.handle;
  }

  const contents = await loadFileContents(blob);
  try {
    const data: ImportedDataState = JSON.parse(contents);
    if (data.type !== "excalidraw") {
      throw new Error(t("alerts.couldNotLoadInvalidFile"));
    }
    return restore({
      elements: data.elements,
      appState: {
        appearance: appState?.appearance,
        ...cleanAppStateForExport(data.appState || {}),
        ...(appState
          ? calculateScrollCenter(data.elements || [], appState, null)
          : {}),
      },
    });
  } catch {
    throw new Error(t("alerts.couldNotLoadInvalidFile"));
  }
};

export const loadLibraryFromBlob = async (blob: any) => {
  const contents = await loadFileContents(blob);
  const data: LibraryData = JSON.parse(contents);
  if (data.type !== "excalidrawlib") {
    throw new Error(t("alerts.couldNotLoadInvalidFile"));
  }
  return data;
};
