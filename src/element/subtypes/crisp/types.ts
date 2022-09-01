import { SubtypeRecord } from "../../../subtypes";

// Exports
export const getCrispSubtypeRecord = () => crispSubtype;

// Use `getCrispSubtype` so we don't have to export this
const crispSubtype: SubtypeRecord = {
  subtype: "crisp",
  parents: ["line", "arrow", "rectangle", "diamond", "ellipse"],
  actionNames: [],
  disabledNames: ["changeSloppiness"],
  shortcutMap: {},
};
