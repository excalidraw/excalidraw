import type { ImportedDataState } from "../../packages/excalidraw/data/types";
import { STORAGE_KEYS } from "../app_constants";

export const initLocalStorage = (data: ImportedDataState) => {
  if (data.elements) {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify(data.elements),
    );
  }
  if (data.appState) {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(data.appState),
    );
  }
};
