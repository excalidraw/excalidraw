import oc from "open-color";
import { AppState, FlooredNumber } from "./types";
import { getDateTime } from "./utils";
import { t } from "./i18n";
import { FontFamily } from "./element/types";

export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_FONT_FAMILY: FontFamily = 1;
export const DEFAULT_TEXT_ALIGN = "left";

export const getDefaultAppState = (): AppState => {
  return {
    isLoading: false,
    errorMessage: null,
    draggingElement: null,
    resizingElement: null,
    multiElement: null,
    editingElement: null,
    editingLinearElement: null,
    elementType: "selection",
    elementLocked: false,
    exportBackground: true,
    shouldAddWatermark: false,
    currentItemStrokeColor: oc.black,
    currentItemBackgroundColor: "transparent",
    currentItemFillStyle: "hachure",
    currentItemStrokeWidth: 1,
    currentItemStrokeStyle: "solid",
    currentItemRoughness: 1,
    currentItemOpacity: 100,
    currentItemFontSize: DEFAULT_FONT_SIZE,
    currentItemFontFamily: DEFAULT_FONT_FAMILY,
    currentItemTextAlign: DEFAULT_TEXT_ALIGN,
    viewBackgroundColor: oc.white,
    scrollX: 0 as FlooredNumber,
    scrollY: 0 as FlooredNumber,
    cursorX: 0,
    cursorY: 0,
    cursorButton: "up",
    scrolledOutside: false,
    name: `${t("labels.untitled")}-${getDateTime()}`,
    username: "",
    isCollaborating: false,
    isResizing: false,
    isRotating: false,
    selectionElement: null,
    zoom: 1,
    openMenu: null,
    lastPointerDownWith: "mouse",
    selectedElementIds: {},
    previousSelectedElementIds: {},
    collaborators: new Map(),
    shouldCacheIgnoreZoom: false,
    showShortcutsDialog: false,
    zenModeEnabled: false,
    editingGroupId: null,
    selectedGroupIds: {},
  };
};

export const clearAppStateForLocalStorage = (appState: AppState) => {
  const {
    draggingElement,
    resizingElement,
    multiElement,
    editingElement,
    selectionElement,
    isResizing,
    isRotating,
    collaborators,
    isCollaborating,
    isLoading,
    errorMessage,
    showShortcutsDialog,
    editingLinearElement,
    ...exportedState
  } = appState;
  return exportedState;
};

export const cleanAppStateForExport = (appState: AppState) => {
  return {
    viewBackgroundColor: appState.viewBackgroundColor,
  };
};
