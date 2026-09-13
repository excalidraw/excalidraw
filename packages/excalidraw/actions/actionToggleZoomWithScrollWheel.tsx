import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleZoomWithScrollWheel = register({
  name: "zoomWithScrollWheel",
  label: "labels.zoomWithScrollWheel",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.zoomWithScrollWheel,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        zoomWithScrollWheel: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.zoomWithScrollWheel,
});
