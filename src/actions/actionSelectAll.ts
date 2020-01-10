import { Action } from "./types";
import { META_KEY } from "../keys";

export const actionSelectAll: Action = {
  name: "selectAll",
  perform: elements => {
    return {
      elements: elements.map(elem => ({ ...elem, isSelected: true }))
    };
  },
  contextItemLabel: "Delete",
  keyTest: event => event[META_KEY] && event.code === "KeyA"
};
