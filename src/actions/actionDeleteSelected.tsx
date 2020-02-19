import { Action } from "./types";
import { deleteSelectedElements, isSomeElementSelected } from "../scene";
import { KEYS } from "../keys";

export const actionDeleteSelected: Action = {
  name: "deleteSelectedElements",
  perform: (elements, appState) => {
    return {
      elements: deleteSelectedElements(elements),
      appState: { ...appState, elementType: "selection", multiElement: null },
    };
  },
  contextItemLabel: "labels.delete",
  contextMenuOrder: 3,
  commitToHistory: (_, elements) => isSomeElementSelected(elements),
  keyTest: event => event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE,
};
