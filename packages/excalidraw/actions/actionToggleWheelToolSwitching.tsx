import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleWheelToolSwitching = register({
  name: "wheelToolSwitching",
  label: "labels.wheelToolSwitching",
  // the toolbar isn't rendered in view mode
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.isWheelToolSwitchingEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        isWheelToolSwitchingEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.isWheelToolSwitchingEnabled,
});
