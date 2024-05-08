import { getShortcutKey } from "../../../utils";
import type { SubtypeRecord } from "../";

// Exports
export const getMathSubtypeRecord = () => mathSubtype;

// Use `getMathSubtype` so we don't have to export this
const mathSubtype: SubtypeRecord = {
  subtype: "math",
  parents: ["text"],
  actionNames: ["useTexTrue", "useTexFalse", "resetUseTex", "changeMathOnly"],
  disabledNames: ["changeFontFamily"],
  shortcutMap: {
    resetUseTex: [getShortcutKey("Shift+R")],
  },
  alwaysEnabledNames: ["useTexTrue", "useTexFalse"],
};
