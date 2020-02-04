import { Action } from "./types";
import { KEYS } from "../keys";
import { clearSelection } from "../scene";

export const actionFinalize: Action = {
  name: "finalize",
  perform: (elements, appState) => {
    if (window.document.activeElement instanceof HTMLElement) {
      window.document.activeElement.blur();
    }
    if (appState.multiElement) {
      appState.multiElement.points = appState.multiElement.points.slice(
        0,
        appState.multiElement.points.length - 1,
      );
      appState.multiElement.shape = null;
    }
    return {
      elements: clearSelection(elements),
      appState: {
        ...appState,
        elementType: "selection",
        draggingElement: null,
        multiElement: null,
      },
    };
  },
  keyTest: (event, appState) =>
    (event.key === KEYS.ESCAPE &&
      !appState.draggingElement &&
      appState.multiElement === null) ||
    ((event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) &&
      appState.multiElement !== null),
};
