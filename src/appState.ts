import oc from "open-color";
import { AppState, FlooredNumber, NormalizedZoomValue } from "./types";
import { getDateTime } from "./utils";
import { t } from "./i18n";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
} from "./constants";

export const getDefaultAppState = (): Omit<
  AppState,
  "offsetTop" | "offsetLeft"
> => {
  return {
    appearance: "light",
    isLoading: false,
    errorMessage: null,
    draggingElement: null,
    resizingElement: null,
    multiElement: null,
    editingElement: null,
    startBoundElement: null,
    editingLinearElement: null,
    elementType: "selection",
    elementLocked: false,
    exportBackground: true,
    exportEmbedScene: false,
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
    currentItemStrokeSharpness: "sharp",
    currentItemLinearStrokeSharpness: "round",
    currentItemStartArrowhead: null,
    currentItemEndArrowhead: "arrow",
    viewBackgroundColor: oc.white,
    scrollX: 0 as FlooredNumber,
    scrollY: 0 as FlooredNumber,
    cursorX: 0,
    cursorY: 0,
    cursorButton: "up",
    scrolledOutside: false,
    name: `${t("labels.untitled")}-${getDateTime()}`,
    isBindingEnabled: true,
    isResizing: false,
    isRotating: false,
    selectionElement: null,
    zoom: {
      value: 1 as NormalizedZoomValue,
      translation: { x: 0, y: 0 },
    },
    openMenu: null,
    lastPointerDownWith: "mouse",
    selectedElementIds: {},
    previousSelectedElementIds: {},
    shouldCacheIgnoreZoom: false,
    showShortcutsDialog: false,
    suggestedBindings: [],
    zenModeEnabled: false,
    gridSize: null,
    editingGroupId: null,
    selectedGroupIds: {},
    width: window.innerWidth,
    height: window.innerHeight,
    isLibraryOpen: false,
    fileHandle: null,
    collaborators: new Map(),
    showStats: false,
    chartType: "line",
  };
};

/**
 * Config containing all AppState keys. Used to determine whether given state
 *  prop should be stripped when exporting to given storage type.
 */
const APP_STATE_STORAGE_CONF = (<
  Values extends {
    /** whether to keep when storing to browser storage (localStorage/IDB) */
    browser: boolean;
    /** whether to keep when exporting to file/database */
    export: boolean;
  },
  T extends Record<keyof AppState, Values>
>(
  config: { [K in keyof T]: K extends keyof AppState ? T[K] : never },
) => config)({
  appearance: { browser: true, export: false },
  currentItemBackgroundColor: { browser: true, export: false },
  currentItemFillStyle: { browser: true, export: false },
  currentItemFontFamily: { browser: true, export: false },
  currentItemFontSize: { browser: true, export: false },
  currentItemOpacity: { browser: true, export: false },
  currentItemRoughness: { browser: true, export: false },
  currentItemStrokeColor: { browser: true, export: false },
  currentItemStrokeStyle: { browser: true, export: false },
  currentItemStrokeWidth: { browser: true, export: false },
  currentItemTextAlign: { browser: true, export: false },
  currentItemStrokeSharpness: { browser: true, export: false },
  currentItemLinearStrokeSharpness: { browser: true, export: false },
  currentItemStartArrowhead: { browser: true, export: false },
  currentItemEndArrowhead: { browser: true, export: false },
  cursorButton: { browser: true, export: false },
  cursorX: { browser: true, export: false },
  cursorY: { browser: true, export: false },
  draggingElement: { browser: false, export: false },
  editingElement: { browser: false, export: false },
  startBoundElement: { browser: false, export: false },
  editingGroupId: { browser: true, export: false },
  editingLinearElement: { browser: false, export: false },
  elementLocked: { browser: true, export: false },
  elementType: { browser: true, export: false },
  errorMessage: { browser: false, export: false },
  exportBackground: { browser: true, export: false },
  exportEmbedScene: { browser: true, export: false },
  gridSize: { browser: true, export: true },
  height: { browser: false, export: false },
  isBindingEnabled: { browser: false, export: false },
  isLibraryOpen: { browser: false, export: false },
  isLoading: { browser: false, export: false },
  isResizing: { browser: false, export: false },
  isRotating: { browser: false, export: false },
  lastPointerDownWith: { browser: true, export: false },
  multiElement: { browser: false, export: false },
  name: { browser: true, export: false },
  openMenu: { browser: true, export: false },
  previousSelectedElementIds: { browser: true, export: false },
  resizingElement: { browser: false, export: false },
  scrolledOutside: { browser: true, export: false },
  scrollX: { browser: true, export: false },
  scrollY: { browser: true, export: false },
  selectedElementIds: { browser: true, export: false },
  selectedGroupIds: { browser: true, export: false },
  selectionElement: { browser: false, export: false },
  shouldAddWatermark: { browser: true, export: false },
  shouldCacheIgnoreZoom: { browser: true, export: false },
  showShortcutsDialog: { browser: false, export: false },
  suggestedBindings: { browser: false, export: false },
  viewBackgroundColor: { browser: true, export: true },
  width: { browser: false, export: false },
  zenModeEnabled: { browser: true, export: false },
  zoom: { browser: true, export: false },
  offsetTop: { browser: false, export: false },
  offsetLeft: { browser: false, export: false },
  fileHandle: { browser: false, export: false },
  collaborators: { browser: false, export: false },
  showStats: { browser: true, export: false },
  chartType: { browser: true, export: true },
});

const _clearAppStateForStorage = <ExportType extends "export" | "browser">(
  appState: Partial<AppState>,
  exportType: ExportType,
) => {
  type ExportableKeys = {
    [K in keyof typeof APP_STATE_STORAGE_CONF]: typeof APP_STATE_STORAGE_CONF[K][ExportType] extends true
      ? K
      : never;
  }[keyof typeof APP_STATE_STORAGE_CONF];
  const stateForExport = {} as { [K in ExportableKeys]?: typeof appState[K] };
  for (const key of Object.keys(appState) as (keyof typeof appState)[]) {
    const propConfig = APP_STATE_STORAGE_CONF[key];
    if (propConfig?.[exportType]) {
      // @ts-ignore see https://github.com/microsoft/TypeScript/issues/31445
      stateForExport[key] = appState[key];
    }
  }
  return stateForExport;
};

export const clearAppStateForLocalStorage = (appState: Partial<AppState>) => {
  return _clearAppStateForStorage(appState, "browser");
};

export const cleanAppStateForExport = (appState: Partial<AppState>) => {
  return _clearAppStateForStorage(appState, "export");
};
