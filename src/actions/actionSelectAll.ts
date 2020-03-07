import { KEYS } from "../keys";
import { register } from "./register";

export const actionSelectAll = register({
  name: "selectAll",
  perform: elements => {
    return {
      elements: elements.map(elem => ({ ...elem, isSelected: true })),
    };
  },
  contextItemLabel: "labels.selectAll",
  keyTest: event => event[KEYS.META] && event.key === "a",
});
