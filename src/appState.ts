import oc from "open-color";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_ALIGN,
  EXPORT_SCALES,
  THEME,
} from "./constants";
import { t } from "./i18n";
import { AppState, NormalizedZoomValue } from "./types";
import { getDateTime } from "./utils";

const defaultExportScale = EXPORT_SCALES.includes(devicePixelRatio)
  ? devicePixelRatio
  : 1;

export const getDefaultAppState = (): Omit<
  AppState,
  "offsetTop" | "offsetLeft" | "width" | "height"
> => {
  return {
    theme: THEME.LIGHT,
    collaborators: new Map(),
    currentChartType: "bar",
    currentItemBackgroundColor: "transparent",
    currentItemEndArrowhead: "arrow",
    currentItemFillStyle: "hachure",
    currentItemFontFamily: DEFAULT_FONT_FAMILY,
    currentItemFontSize: DEFAULT_FONT_SIZE,
    currentItemLinearStrokeSharpness: "round",
    currentItemOpacity: 100,
    currentItemRoughness: 1,
    currentItemStartArrowhead: null,
    currentItemStrokeColor: oc.black,
    currentItemStrokeSharpness: "sharp",
    currentItemStrokeStyle: "solid",
    currentItemStrokeWidth: 1,
    currentItemTextAlign: DEFAULT_TEXT_ALIGN,
    cursorButton: "up",
    draggingElement: null,
    editingElement: null,
    editingGroupId: null,
    editingLinearElement: null,
    activeTool: {
      type: "selection",
      customType: null,
      locked: false,
      lastActiveToolBeforeEraser: null,
    },
    penMode: false,
    penDetected: false,
    errorMessage: null,
    exportBackground: true,
    exportScale: defaultExportScale,
    exportEmbedScene: false,
    exportWithDarkMode: false,
    fileHandle: null,
    gridSize: null,
    isBindingEnabled: true,
    isLibraryOpen: false,
    isLibraryMenuDocked: false,
    isLoading: false,
    isResizing: false,
    isRotating: false,
    lastPointerDownWith: "mouse",
    multiElement: null,
    name: `${t("labels.untitled")}-${getDateTime()}`,
    openMenu: null,
    openPopup: null,
    pasteDialog: { shown: false, data: null },
    previousSelectedElementIds: {},
    resizingElement: null,
    scrolledOutside: false,
    scrollX: 0,
    scrollY: 0,
    selectedElementIds: {},
    selectedGroupIds: {},
    selectionElement: null,
    shouldCacheIgnoreZoom: false,
    showHelpDialog: false,
    showStats: false,
    startBoundElement: null,
    suggestedBindings: [],
    toastMessage: null,
    viewBackgroundColor: oc.white,
    zenModeEnabled: false,
    zoom: {
      value: 1 as NormalizedZoomValue,
    },
    viewModeEnabled: false,
    pendingImageElementId: null,
    showHyperlinkPopup: false,
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
    /** server (shareLink/collab/...) */
    server: boolean;
  },
  T extends Record<keyof AppState, Values>,
>(config: { [K in keyof T]: K extends keyof AppState ? T[K] : never }) =>
  config)({
  theme: { browser: true, export: false, server: false },
  collaborators: { browser: false, export: false, server: false },
  currentChartType: { browser: true, export: false, server: false },
  currentItemBackgroundColor: { browser: true, export: false, server: false },
  currentItemEndArrowhead: { browser: true, export: false, server: false },
  currentItemFillStyle: { browser: true, export: false, server: false },
  currentItemFontFamily: { browser: true, export: false, server: false },
  currentItemFontSize: { browser: true, export: false, server: false },
  currentItemLinearStrokeSharpness: {
    browser: true,
    export: false,
    server: false,
  },
  currentItemOpacity: { browser: true, export: false, server: false },
  currentItemRoughness: { browser: true, export: false, server: false },
  currentItemStartArrowhead: { browser: true, export: false, server: false },
  currentItemStrokeColor: { browser: true, export: false, server: false },
  currentItemStrokeSharpness: { browser: true, export: false, server: false },
  currentItemStrokeStyle: { browser: true, export: false, server: false },
  currentItemStrokeWidth: { browser: true, export: false, server: false },
  currentItemTextAlign: { browser: true, export: false, server: false },
  cursorButton: { browser: true, export: false, server: false },
  draggingElement: { browser: false, export: false, server: false },
  editingElement: { browser: false, export: false, server: false },
  editingGroupId: { browser: true, export: false, server: false },
  editingLinearElement: { browser: false, export: false, server: false },
  activeTool: { browser: true, export: false, server: false },
  penMode: { browser: true, export: false, server: false },
  penDetected: { browser: true, export: false, server: false },
  errorMessage: { browser: false, export: false, server: false },
  exportBackground: { browser: true, export: false, server: false },
  exportEmbedScene: { browser: true, export: false, server: false },
  exportScale: { browser: true, export: false, server: false },
  exportWithDarkMode: { browser: true, export: false, server: false },
  fileHandle: { browser: false, export: false, server: false },
  gridSize: { browser: true, export: true, server: true },
  height: { browser: false, export: false, server: false },
  isBindingEnabled: { browser: false, export: false, server: false },
  isLibraryOpen: { browser: true, export: false, server: false },
  isLibraryMenuDocked: { browser: true, export: false, server: false },
  isLoading: { browser: false, export: false, server: false },
  isResizing: { browser: false, export: false, server: false },
  isRotating: { browser: false, export: false, server: false },
  lastPointerDownWith: { browser: true, export: false, server: false },
  multiElement: { browser: false, export: false, server: false },
  name: { browser: true, export: false, server: false },
  offsetLeft: { browser: false, export: false, server: false },
  offsetTop: { browser: false, export: false, server: false },
  openMenu: { browser: true, export: false, server: false },
  openPopup: { browser: false, export: false, server: false },
  pasteDialog: { browser: false, export: false, server: false },
  previousSelectedElementIds: { browser: true, export: false, server: false },
  resizingElement: { browser: false, export: false, server: false },
  scrolledOutside: { browser: true, export: false, server: false },
  scrollX: { browser: true, export: false, server: false },
  scrollY: { browser: true, export: false, server: false },
  selectedElementIds: { browser: true, export: false, server: false },
  selectedGroupIds: { browser: true, export: false, server: false },
  selectionElement: { browser: false, export: false, server: false },
  shouldCacheIgnoreZoom: { browser: true, export: false, server: false },
  showHelpDialog: { browser: false, export: false, server: false },
  showStats: { browser: true, export: false, server: false },
  startBoundElement: { browser: false, export: false, server: false },
  suggestedBindings: { browser: false, export: false, server: false },
  toastMessage: { browser: false, export: false, server: false },
  viewBackgroundColor: { browser: true, export: true, server: true },
  width: { browser: false, export: false, server: false },
  zenModeEnabled: { browser: true, export: false, server: false },
  zoom: { browser: true, export: false, server: false },
  viewModeEnabled: { browser: false, export: false, server: false },
  pendingImageElementId: { browser: false, export: false, server: false },
  showHyperlinkPopup: { browser: false, export: false, server: false },
});

const _clearAppStateForStorage = <
  ExportType extends "export" | "browser" | "server",
>(
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
      const nextValue = appState[key];

      // https://github.com/microsoft/TypeScript/issues/31445
      (stateForExport as any)[key] = nextValue;
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

export const clearAppStateForDatabase = (appState: Partial<AppState>) => {
  return _clearAppStateForStorage(appState, "server");
};

export const isEraserActive = ({
  activeTool,
}: {
  activeTool: AppState["activeTool"];
}) => activeTool.type === "eraser";
