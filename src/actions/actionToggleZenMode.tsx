import { CODES, KEYS } from "../keys";
import { register } from "./register";

export const actionToggleZenMode = register({
  name: "zenMode",
  perform(elements, appState) {
    this.checked = !this.checked;
    return {
      appState: {
        ...appState,
        zenModeEnabled: this.checked,
      },
      commitToHistory: false,
    };
  },
  checked: false,
  contextItemLabel: "buttons.zenMode",
  // Wrong event code
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
