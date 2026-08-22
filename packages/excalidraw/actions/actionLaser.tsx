import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleLaserPersistent = register({
  name: "laserPersistentMode",
  label: "buttons.laserPersistentMode",
  viewMode: true,
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
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.laserPersistent,
  predicate: (elements, appState, appProps, app) =>
    app.isToolSupported("laser"),
});

export const actionClearLaserTrails = register({
  name: "clearLaserTrails",
  label: "buttons.clearLaserTrails",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform(elements, appState, value, app) {
    app.clearLaserTrails();
    return {
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  predicate: (elements, appState, appProps, app) =>
    appState.laserPersistent && app.isToolSupported("laser"),
});
