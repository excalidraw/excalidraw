import { trackEvent } from "../analytics";
import { CODES, KEYS } from "../keys";
import { AppState } from "../types";
import { register } from "./register";

export const actionToggleGridMode = register({
  name: "gridMode",
  perform(elements, appState) {
    trackEvent("view", "mode", "grid");
    return {
      appState: {
        ...appState,
        showGrid: !appState.showGrid,
      },
      commitToHistory: false,
    };
  },
  checked: (appState: AppState) => appState.showGrid,
  contextItemLabel: "labels.gridMode",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
