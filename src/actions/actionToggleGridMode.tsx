import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { GRID_SIZE } from "../constants";
import { AppState } from "../types";
import { trackEvent } from "../analytics";

export const actionToggleGridMode = register({
  name: "gridMode",
  perform(elements, appState) {
    trackEvent("view", "mode", "grid");
    return {
      appState: {
        ...appState,
        gridSize: this.checked!(appState) ? null : GRID_SIZE,
      },
      commitToHistory: false,
    };
  },
  checked: (appState: AppState) => appState.gridSize !== null,
  contextItemLabel: "labels.showGrid",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
