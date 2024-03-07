import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { StoreAction } from "./types";

export const actionToggleObjectsSnapMode = register({
  name: "objectsSnapMode",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.objectsSnapModeEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        objectsSnapModeEnabled: !this.checked!(appState),
        gridSize: null,
      },
      storeAction: StoreAction.NONE,
    };
  },
  checked: (appState) => appState.objectsSnapModeEnabled,
  predicate: (elements, appState, appProps) => {
    return typeof appProps.objectsSnapModeEnabled === "undefined";
  },
  contextItemLabel: "buttons.objectsSnapMode",
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.S,
});
