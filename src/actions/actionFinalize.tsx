import { Action } from "./types";
import { KEYS } from "../keys";
import { clearSelection } from "../scene";

export const actionFinalize: Action = {
  name: "finalize",
  perform: (elements, appState) => {
    return {
      elements: clearSelection(elements),
      appState: { ...appState, elementType: "selection", multiElement: null },
    };
  },
  keyTest: (event, appState) =>
    (event.key === KEYS.ESCAPE &&
      !appState.draggingElement &&
      appState.multiElement === null) ||
    ((event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) &&
      appState.multiElement !== null),
};
