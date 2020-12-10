import { t } from "../i18n";
import { isDarwin } from "../keys";
import { getShortcutKey } from "../utils";

export type ShortcutName =
  | "copy"
  | "paste"
  | "copyStyles"
  | "pasteStyles"
  | "selectAll"
  | "delete"
  | "duplicateSelection"
  | "sendBackward"
  | "bringForward"
  | "sendToBack"
  | "bringToFront"
  | "copyAsPng"
  | "copyAsSvg"
  | "group"
  | "ungroup"
  | "toggleGridMode"
  | "toggleStats"
  | "addToLibrary";

const shortcutMap: Record<ShortcutName, string[]> = {
  copy: [getShortcutKey("CtrlOrCmd+C")],
  paste: [getShortcutKey("CtrlOrCmd+V")],
  copyStyles: [getShortcutKey("CtrlOrCmd+Alt+C")],
  pasteStyles: [getShortcutKey("CtrlOrCmd+Alt+V")],
  selectAll: [getShortcutKey("CtrlOrCmd+A")],
  delete: [getShortcutKey("Del")],
  duplicateSelection: [
    getShortcutKey("CtrlOrCmd+D"),
    getShortcutKey(`Alt+${t("shortcutsDialog.drag")}`),
  ],
  sendBackward: [getShortcutKey("CtrlOrCmd+[")],
  bringForward: [getShortcutKey("CtrlOrCmd+]")],
  sendToBack: [
    isDarwin
      ? getShortcutKey("CtrlOrCmd+Alt+[")
      : getShortcutKey("CtrlOrCmd+Shift+["),
  ],
  bringToFront: [
    isDarwin
      ? getShortcutKey("CtrlOrCmd+Alt+]")
      : getShortcutKey("CtrlOrCmd+Shift+]"),
  ],
  copyAsPng: [getShortcutKey("Shift+Alt+C")],
  copyAsSvg: [],
  group: [getShortcutKey("CtrlOrCmd+G")],
  ungroup: [getShortcutKey("CtrlOrCmd+Shift+G")],
  toggleGridMode: [getShortcutKey("CtrlOrCmd+'")],
  toggleStats: [],
  addToLibrary: [],
};

export const getShortcutFromShortcutName = (name: ShortcutName) => {
  const shortcuts = shortcutMap[name];
  // if multiple shortcuts availiable, take the first one
  return shortcuts && shortcuts.length > 0 ? shortcuts[0] : "";
};
