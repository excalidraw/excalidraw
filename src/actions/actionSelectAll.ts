import { Action } from "./types";
import { KEYS } from "../keys";

export const actionSelectAll: Action = {
  name: "selectAll",
  perform: elements => {
    return {
      elements: elements.map(elem => ({ ...elem, isSelected: true })),
    };
  },
  contextItemLabel: "labels.selectAll",
  keyTest: event => event[KEYS.META] && event.code === "KeyA",
};
