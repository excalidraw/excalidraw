import oc from "open-color";
import { AppState, FlooredNumber } from "./types";
import { getDateTime } from "./utils";
import { t } from "./i18n";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
} from "./constants";

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
    gridSize: null,
    editingGroupId: null,
    selectedGroupIds: {},
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

type STORAGE_CONFIG = Record<
  keyof AppState,
  { browser: boolean; export: boolean }
>;

const STORAGE_APP_STATE: STORAGE_CONFIG = {
  isLoading: { browser: false, export: false },
  errorMessage: { browser: false, export: false },
  draggingElement: { browser: false, export: false },
  resizingElement: { browser: false, export: false },
  multiElement: { browser: false, export: false },
  editingElement: { browser: false, export: false },
  editingLinearElement: { browser: false, export: false },
  isCollaborating: { browser: false, export: false },
  isResizing: { browser: false, export: false },
  isRotating: { browser: false, export: false },
  selectionElement: { browser: false, export: false },
  collaborators: { browser: false, export: false },
  showShortcutsDialog: { browser: false, export: false },
  width: { browser: false, export: false },
  height: { browser: false, export: false },
  elementType: { browser: true, export: false },
  elementLocked: { browser: true, export: false },
  exportBackground: { browser: true, export: false },
  shouldAddWatermark: { browser: true, export: false },
  currentItemStrokeColor: { browser: true, export: false },
  currentItemBackgroundColor: { browser: true, export: false },
  currentItemFillStyle: { browser: true, export: false },
  currentItemStrokeWidth: { browser: true, export: false },
  currentItemStrokeStyle: { browser: true, export: false },
  currentItemRoughness: { browser: true, export: false },
  currentItemOpacity: { browser: true, export: false },
  currentItemFontSize: { browser: true, export: false },
  currentItemFontFamily: { browser: true, export: false },
  currentItemTextAlign: { browser: true, export: false },
  viewBackgroundColor: { browser: true, export: true },
  scrollX: { browser: true, export: false },
  scrollY: { browser: true, export: false },
  cursorX: { browser: true, export: false },
  cursorY: { browser: true, export: false },
  cursorButton: { browser: true, export: false },
  scrolledOutside: { browser: true, export: false },
  name: { browser: true, export: false },
  username: { browser: true, export: false },
  zoom: { browser: true, export: false },
  openMenu: { browser: true, export: false },
  lastPointerDownWith: { browser: true, export: false },
  selectedElementIds: { browser: true, export: false },
  previousSelectedElementIds: { browser: true, export: false },
  shouldCacheIgnoreZoom: { browser: true, export: false },
  zenModeEnabled: { browser: true, export: false },
  gridSize: { browser: true, export: true },
  editingGroupId: { browser: true, export: false },
  selectedGroupIds: { browser: true, export: false },
} as const;

const clearAppStateForStorage = <T>(
  appState: T,
  config: Record<keyof T, { browser: boolean; export: boolean }>,
  type: "browser" | "export",
) => {
  type K = keyof T;
  const exportedState = {} as Record<K, T[K]>;
  for (const [key, value] of Object.entries(appState)) {
    if (config[key as K][type]) {
      exportedState[key as K] = value;
    }
  }
  return exportedState;
};

export const clearAppStateForLocalStorage = (appState: AppState) => {
  return clearAppStateForStorage(appState, STORAGE_APP_STATE, "browser");
};

export const cleanAppStateForExport = (appState: AppState) => {
  return clearAppStateForStorage(appState, STORAGE_APP_STATE, "export");
};
