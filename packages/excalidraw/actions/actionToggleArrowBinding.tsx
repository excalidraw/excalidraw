import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleArrowBinding = register({
  name: "arrowBinding",
  label: "labels.arrowBinding",
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.bindingPreference === "disabled",
  },
  perform(elements, appState) {
    const newPreference =
      appState.bindingPreference === "enabled" ? "disabled" : "enabled";
    return {
      appState: {
        ...appState,
        bindingPreference: newPreference,
        isBindingEnabled: newPreference === "enabled",
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.bindingPreference === "enabled",
});
