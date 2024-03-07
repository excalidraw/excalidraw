import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { StoreAction } from "./types";

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
      storeAction: StoreAction.NONE,
    };
  },
  checked: (appState) => appState.zenModeEnabled,
  predicate: (elements, appState, appProps) => {
    return typeof appProps.zenModeEnabled === "undefined";
  },
  contextItemLabel: "buttons.zenMode",
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.Z,
});
