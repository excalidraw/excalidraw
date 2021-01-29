import { CODES, KEYS } from "../keys";
import { register } from "./register";

export const actionToggleZenMode = register({
  name: "zenMode",
  perform(elements, appState) {
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
  // Wrong event code
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
