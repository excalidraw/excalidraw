import { register } from "./register";
import { AppState } from "../types";
import { trackEvent } from "../analytics";

export const actionToggleAutoSave = register({
  name: "toggleAutoSave",
  perform(elements, appState) {
    trackEvent("toggle", "autoSave");
    return {
      appState: {
        ...appState,
        autoSave: !appState.autoSave,
      },
      commitToHistory: false,
    };
  },
  checked: (appState: AppState) => appState.autoSave,
  contextItemLabel: "labels.toggleAutoSave",
  keyTest: (event) => false,
});
