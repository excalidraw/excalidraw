import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { trackEvent } from "../analytics";

export const actionToggleZenMode = register({
  name: "zenMode",
  perform(elements, appState) {
    trackEvent("view", "mode", "zen");

    return {
      appState: {
        ...appState,
        zenModeEnabled: !this.checked!(appState),
      },
      commitToHistory: false,
    };
  },
  checked: (appState) => appState.zenModeEnabled,
  contextItemLabel: "buttons.zenMode",
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.Z,
});
