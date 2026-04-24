import { CODES, KEYS, matchKey } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { focusIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleFocusMode = register({
  name: "focusMode",
  label: "buttons.focusMode",
  icon: focusIcon,
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.isFocusMode,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        isFocusMode: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.isFocusMode,
  predicate: (elements, appState, appProps, app) => {
    return (
      app.editorInterface.formFactor !== "phone" &&
      typeof appProps.isFocusMode === "undefined"
    );
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    event.shiftKey &&
    event.altKey === false &&
    matchKey(event, KEYS.F),
});
