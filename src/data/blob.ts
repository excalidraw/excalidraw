import { getDefaultAppState } from "../appState";
import { restore } from "./restore";
import { t } from "../i18n";

export async function loadFromBlob(blob: any) {
  const updateAppState = (contents: string) => {
    const defaultAppState = getDefaultAppState();
    let elements = [];
    let appState = defaultAppState;
    try {
      const data = JSON.parse(contents);
      if (data.type !== "excalidraw") {
        throw new Error(t("alerts.couldNotLoadInvalidFile"));
      }
      elements = data.elements || [];
      appState = { ...defaultAppState, ...data.appState };
    } catch {
      throw new Error(t("alerts.couldNotLoadInvalidFile"));
    }
    return { elements, appState };
  };

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

  const { elements, appState } = updateAppState(contents);
  return restore(elements, appState, { scrollToContent: true });
}
