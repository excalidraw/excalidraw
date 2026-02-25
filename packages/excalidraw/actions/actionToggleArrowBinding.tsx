import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleArrowBinding = register({
  name: "arrowBinding",
  label: "labels.arrowBinding",
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.isBindingEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        isBindingEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.isBindingEnabled,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.B,
});
