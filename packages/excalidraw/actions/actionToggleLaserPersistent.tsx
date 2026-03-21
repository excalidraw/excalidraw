import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleLaserPersistent = register({
  name: "laserPersistentMode",
  label: "buttons.laserPersistentMode",
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.laserPersistent,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        laserPersistent: !appState.laserPersistent,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.laserPersistent,
});
