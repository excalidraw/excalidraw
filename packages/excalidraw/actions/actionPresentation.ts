import { CODES, KEYS } from "@excalidraw/common";

import { presentationIcon } from "../components/icons";

import { getSingleSelectedFrame } from "./actionFrame";
import { register } from "./register";

export const actionTogglePresentation = register({
  name: "presentation",
  label: (elements, appState) =>
    appState.presentation ? "presentation.stop" : "presentation.start",
  icon: presentationIcon,
  keywords: ["slides", "slideshow", "present", "frames"],
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.presentation,
  },
  perform(elements, appState, _, app) {
    if (appState.presentation) {
      app.presentation.stop();
    } else {
      // start from the selected frame, if any
      app.presentation.start(getSingleSelectedFrame(appState, app)?.id);
    }
    return false;
  },
  checked: (appState) => !!appState.presentation,
  predicate: (elements, appState, _, app) =>
    app.scene.getNonDeletedFramesLikes().length > 0,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    event.altKey &&
    event.shiftKey &&
    event.code === CODES.P,
});

export const actionPresentFromFrame = register({
  name: "presentFromFrame",
  label: "presentation.startFromFrame",
  icon: presentationIcon,
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform(elements, appState, _, app) {
    app.presentation.start(getSingleSelectedFrame(appState, app)?.id);
    return false;
  },
  predicate: (elements, appState, _, app) =>
    !appState.presentation && !!getSingleSelectedFrame(appState, app),
});
