import { eyeIcon } from "../components/icons";
import { CODES, KEYS } from "../keys";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

export const actionToggleViewMode = register({
  name: "viewMode",
  label: "labels.viewMode",
  paletteName: "Toggle view mode",
  icon: eyeIcon,
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.viewModeEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        viewModeEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.viewModeEnabled,
  predicate: (elements, appState, appProps) => {
    return typeof appProps.viewModeEnabled === "undefined";
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.R,
});
