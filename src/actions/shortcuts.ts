import { t } from "../i18n";
import { isDarwin } from "../keys";
import { getShortcutKey } from "../utils";
import { ActionName } from "./types";

export type ShortcutName = SubtypeOf<
  ActionName,
  | "cut"
  | "copy"
  | "paste"
  | "copyStyles"
  | "pasteStyles"
  | "selectAll"
  | "deleteSelectedElements"
  | "duplicateSelection"
  | "sendBackward"
  | "bringForward"
  | "sendToBack"
  | "bringToFront"
  | "copyAsPng"
  | "copyAsSvg"
  | "group"
  | "ungroup"
  | "gridMode"
  | "zenMode"
  | "stats"
  | "addToLibrary"
  | "viewMode"
  | "flipHorizontal"
  | "flipVertical"
  | "hyperlink"
  | "lock"
>;

const shortcutMap: Record<ShortcutName, string[]> = {
  cut: [getShortcutKey("CtrlOrCmd+X")],
  copy: [getShortcutKey("CtrlOrCmd+C")],
  paste: [getShortcutKey("CtrlOrCmd+V")],
  copyStyles: [getShortcutKey("CtrlOrCmd+Alt+C")],
  pasteStyles: [getShortcutKey("CtrlOrCmd+Alt+V")],
  selectAll: [getShortcutKey("CtrlOrCmd+A")],
  deleteSelectedElements: [getShortcutKey("Del")],
  duplicateSelection: [
    getShortcutKey("CtrlOrCmd+D"),
    getShortcutKey(`Alt+${t("helpDialog.drag")}`),
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
  gridMode: [getShortcutKey("CtrlOrCmd+'")],
  zenMode: [getShortcutKey("Alt+Z")],
  stats: [getShortcutKey("Alt+/")],
  addToLibrary: [],
  flipHorizontal: [getShortcutKey("Shift+H")],
  flipVertical: [getShortcutKey("Shift+V")],
  viewMode: [getShortcutKey("Alt+R")],
  hyperlink: [getShortcutKey("CtrlOrCmd+K")],
  lock: [getShortcutKey("CtrlOrCmd+Shift+K")],
};

export const getShortcutFromShortcutName = (name: ShortcutName) => {
  const shortcuts = shortcutMap[name];
  // if multiple shortcuts available, take the first one
  return shortcuts && shortcuts.length > 0 ? shortcuts[0] : "";
};
