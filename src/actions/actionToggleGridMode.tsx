import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { GRID_SIZE } from "../constants";

export const actionToggleGridMode = register({
  name: "gridMode",
  perform(elements, appState) {
    this.checked = !this.checked;
    return {
      appState: {
        ...appState,
        gridSize: appState.gridSize ? null : GRID_SIZE,
      },
      commitToHistory: false,
    };
  },
  checked: false,
  contextItemLabel: "labels.gridMode",
  // Wrong event code
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
