import { KEYS } from "../keys";
import { register } from "./register";

export const actionToggleZenMode = register({
  name: "zenMode",
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.zenModeEnabled,
  },
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
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.key === KEYS.Z,
});
