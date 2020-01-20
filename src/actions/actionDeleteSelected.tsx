import { Action } from "./types";
import { deleteSelectedElements } from "../scene";
import { KEYS } from "../keys";

export const actionDeleteSelected: Action = {
  name: "deleteSelectedElements",
  perform: elements => {
    return {
      elements: deleteSelectedElements(elements)
    };
  },
  contextItemLabel: "labels.delete",
  contextMenuOrder: 3,
  keyTest: event => event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE
};
