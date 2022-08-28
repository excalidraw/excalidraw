import { Subtype } from "../../../subtypes";

// Exports
export const getCrispSubtype = () => crispSubtype;

// Use `getCrispSubtype` so we don't have to export this
const crispSubtype: Subtype = {
  name: "crisp",
  parents: ["line", "arrow", "rectangle", "diamond", "ellipse"],
  actionNames: [],
  disabledNames: ["changeSloppiness"],
  shortcutNames: [],
  shortcutMap: {},
};
