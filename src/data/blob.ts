import { getDefaultAppState, cleanAppStateForExport } from "../appState";
import { restore } from "./restore";
import { t } from "../i18n";
import { AppState } from "../types";
import { calculateScrollCenter } from "../scene";

/**
 * @param blob
 * @param appState if provided, used for centering scroll to restored scene
 */
export const loadFromBlob = async (blob: any, appState?: AppState) => {
  if (blob.handle) {
    (window as any).handle = blob.handle;
  }
  let contents;
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

  const defaultAppState = getDefaultAppState();
  let elements = [];
  let _appState = appState || defaultAppState;
  try {
    const data = JSON.parse(contents);
    if (data.type !== "excalidraw") {
      throw new Error(t("alerts.couldNotLoadInvalidFile"));
    }
    elements = data.elements || [];
    _appState = {
      ...defaultAppState,
      ...cleanAppStateForExport(data.appState as Partial<AppState>),
      ...(appState ? calculateScrollCenter(elements, appState, null) : {}),
    };
  } catch {
    throw new Error(t("alerts.couldNotLoadInvalidFile"));
  }

  return restore(elements, _appState);
};
