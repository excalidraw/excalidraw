import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { SelectionIcon } from "../components/icons";

import { register } from "./register";

/** Toggle spotlight focus mode: dims non-selected canvas elements. */
export const actionToggleFocusMode = register({
  name: "focusMode",
  label: "buttons.focusMode",
  icon: SelectionIcon,
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.focusModeEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        focusModeEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.focusModeEnabled,
  predicate: (elements, appState, appProps, app) => {
    return app.editorInterface.formFactor !== "phone";
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.F,
});
