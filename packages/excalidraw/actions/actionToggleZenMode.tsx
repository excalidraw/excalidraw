import { CODES, KEYS } from "../keys";
import { getUiMode } from "../utils";
import { register } from "./register";

export const actionToggleZenMode = register({
  name: "zenMode",
  viewMode: true,
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
  predicate: (elements, appState, appProps) => {
    return typeof appProps.zenModeEnabled === "undefined";
  },
  contextItemLabel: "buttons.zenMode",
  keyTest: (event) =>
    getUiMode() === "all"
      ? !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.Z
      : false,
});
