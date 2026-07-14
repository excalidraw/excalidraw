import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { a11yHelpDialogAtom } from "../a11y/A11yHelpDialog";
import { editorJotaiStore } from "../editor-jotai";

import { register } from "./register";

export const actionA11yHelp = register({
  name: "a11yHelp",
  label: "a11y.helpDialog.title",
  trackEvent: { category: "menu" },
  viewMode: true,
  perform: (elements, appState) => {
    editorJotaiStore.set(a11yHelpDialogAtom, true);
    return {
      elements,
      appState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    event.code === "KeyH" &&
    event.altKey &&
    event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionA11yFocusCanvas = register({
  name: "a11yFocusCanvas",
  label: "a11y.focusCanvas",
  trackEvent: { category: "canvas" },
  viewMode: true,
  perform: (elements, appState, value, app) => {
    app.focusCanvasRegion();
    return {
      elements,
      appState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    event.code === "KeyA" &&
    event.altKey &&
    event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD],
});
