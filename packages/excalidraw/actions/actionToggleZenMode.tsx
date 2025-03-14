import { coffeeIcon } from "../components/icons";
import { CODES, KEYS } from "../keys";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

export const actionToggleZenMode = register({
  name: "zenMode",
  label: "buttons.zenMode",
  icon: coffeeIcon,
  paletteName: "Toggle zen mode",
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
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.zenModeEnabled,
  predicate: (elements, appState, appProps) => {
    return typeof appProps.zenModeEnabled === "undefined";
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.Z,
});
