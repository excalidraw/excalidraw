import { CaptureUpdateAction } from "@excalidraw/element";

import { messageCircleIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleShowHints = register({
  name: "showHints",
  label: "labels.showHints",
  icon: messageCircleIcon,
  keywords: ["hint", "hints", "tip", "tips"],
  // hints live in the toolbar, which view mode hides entirely
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.showHints,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        showHints: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.showHints,
});
