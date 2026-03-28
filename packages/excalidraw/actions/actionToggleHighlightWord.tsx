import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionToggleHighlightWord = register({
  name: "toggleHighlightWord" as any,
  label: "Toggle Highlight Word",
  icon: null,
  trackEvent: {
    category: "menu",
  },
  perform(_elements, appState) {
    return {
      appState: {
        ...appState,
        highlightWord: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.highlightWord,
});
