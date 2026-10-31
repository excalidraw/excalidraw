import { KEYS, matchKey } from "@excalidraw/common";

import { register } from "./register";

export const actionToggleWrap = register({
  name: "toggleWrap",
  label: "labels.toggleWrap",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    app.scene.getSelectedElements(appState).length > 0,
  perform: (elements, appState, _, app) => app.wrap.toggle(elements, appState),
  keyTest: (event, appState, elements, app) =>
    !event[KEYS.CTRL_OR_CMD] &&
    !event.altKey &&
    !event.shiftKey &&
    matchKey(event, KEYS.W) &&
    app.scene.getSelectedElements(appState).length > 0,
});
