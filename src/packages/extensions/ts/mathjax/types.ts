import { getShortcutKey } from "../../../../utils";
import { SubtypeRecord } from "../../../../subtypes";

// Exports
export const getMathSubtypeRecord = () => mathSubtype;

// Use `getMathSubtype` so we don't have to export this
const mathSubtype: SubtypeRecord = {
  subtype: "math",
  parents: ["text"],
  actionNames: ["changeUseTex", "changeMathOnly"],
  disabledNames: ["changeFontFamily"],
  shortcutNames: ["changeUseTex", "changeMathOnly"],
  shortcutMap: {
    changeUseTex: [getShortcutKey("CtrlOrCmd+Shift+M")],
    changeMathOnly: [getShortcutKey("CtrlOrCmd+Shift+O")],
  },
};
