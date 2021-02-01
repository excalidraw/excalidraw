import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { trackEvent } from "../analytics";

export const actionToggleViewMode = register({
  name: "viewMode",
  perform(elements, appState) {
    trackEvent("view", "mode", "view");
    return {
      appState: {
        ...appState,
        viewModeEnabled: !this.checked!(appState),
        selectedElementIds: {},
      },
      commitToHistory: false,
    };
  },
  checked: (appState) => appState.viewModeEnabled,
  contextItemLabel: "labels.viewMode",
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.R,
});
