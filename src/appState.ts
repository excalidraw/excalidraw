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
    /** whether to keep when exporting to a text file */
    text: boolean;
    /** whether to keep when exporting to an image file */
    image: boolean;
    /** server (shareLink/collab/...) */
    server: boolean;
  },
  T extends Record<keyof AppState, Values>,
>(config: { [K in keyof T]: K extends keyof AppState ? T[K] : never }) =>
  config)({
  theme: { browser: true, text: false, image: false, server: false },
  collaborators: { browser: false, text: false, image: false, server: false },
  currentChartType: { browser: true, text: false, image: false, server: false },
  currentItemBackgroundColor: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemEndArrowhead: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemFillStyle: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemFontFamily: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemFontSize: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemLinearStrokeSharpness: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemOpacity: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemRoughness: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemStartArrowhead: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemStrokeColor: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemStrokeSharpness: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemStrokeStyle: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemStrokeWidth: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  currentItemTextAlign: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  cursorButton: { browser: true, text: false, image: false, server: false },
  draggingElement: { browser: false, text: false, image: false, server: false },
  editingElement: { browser: false, text: false, image: false, server: false },
  editingGroupId: { browser: true, text: false, image: false, server: false },
  editingLinearElement: {
    browser: false,
    text: false,
    image: false,
    server: false,
  },
  activeTool: { browser: true, text: false, image: false, server: false },
  penMode: { browser: true, text: false, image: false, server: false },
  penDetected: { browser: true, text: false, image: false, server: false },
  errorMessage: { browser: false, text: false, image: false, server: false },
  exportBackground: { browser: true, text: false, image: true, server: false },
  exportEmbedScene: { browser: true, text: false, image: true, server: false },
  exportScale: { browser: true, text: false, image: true, server: false },
  exportWithDarkMode: {
    browser: true,
    text: false,
    image: true,
    server: false,
  },
  fileHandle: { browser: false, text: false, image: false, server: false },
  gridSize: { browser: true, text: true, image: true, server: true },
  height: { browser: false, text: false, image: false, server: false },
  isBindingEnabled: {
    browser: false,
    text: false,
    image: false,
    server: false,
  },
  isLibraryOpen: { browser: true, text: false, image: false, server: false },
  isLibraryMenuDocked: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  isLoading: { browser: false, text: false, image: false, server: false },
  isResizing: { browser: false, text: false, image: false, server: false },
  isRotating: { browser: false, text: false, image: false, server: false },
  lastPointerDownWith: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  multiElement: { browser: false, text: false, image: false, server: false },
  name: { browser: true, text: false, image: false, server: false },
  offsetLeft: { browser: false, text: false, image: false, server: false },
  offsetTop: { browser: false, text: false, image: false, server: false },
  openMenu: { browser: true, text: false, image: false, server: false },
  openPopup: { browser: false, text: false, image: false, server: false },
  pasteDialog: { browser: false, text: false, image: false, server: false },
  previousSelectedElementIds: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  resizingElement: { browser: false, text: false, image: false, server: false },
  scrolledOutside: { browser: true, text: false, image: false, server: false },
  scrollX: { browser: true, text: false, image: false, server: false },
  scrollY: { browser: true, text: false, image: false, server: false },
  selectedElementIds: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  selectedGroupIds: { browser: true, text: false, image: false, server: false },
  selectionElement: {
    browser: false,
    text: false,
    image: false,
    server: false,
  },
  shouldCacheIgnoreZoom: {
    browser: true,
    text: false,
    image: false,
    server: false,
  },
  showHelpDialog: { browser: false, text: false, image: false, server: false },
  showStats: { browser: true, text: false, image: false, server: false },
  startBoundElement: {
    browser: false,
    text: false,
    image: false,
    server: false,
  },
  suggestedBindings: {
    browser: false,
    text: false,
    image: false,
    server: false,
  },
  toastMessage: { browser: false, text: false, image: false, server: false },
  viewBackgroundColor: {
    browser: true,
    text: true,
    image: true,
    server: true,
  },
  width: { browser: false, text: false, image: false, server: false },
  zenModeEnabled: { browser: true, text: false, image: false, server: false },
  zoom: { browser: true, text: false, image: false, server: false },
  viewModeEnabled: { browser: false, text: false, image: false, server: false },
  pendingImageElementId: {
    browser: false,
    text: false,
    image: false,
    server: false,
  },
  showHyperlinkPopup: {
    browser: false,
    text: false,
    image: false,
    server: false,
  },
});

const _clearAppStateForStorage = <
  ExportType extends "image" | "text" | "browser" | "server",
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

export const cleanAppStateForTextExport = (appState: Partial<AppState>) => {
  return _clearAppStateForStorage(appState, "text");
};

export const cleanAppStateForImageExport = (appState: Partial<AppState>) => {
  return _clearAppStateForStorage(appState, "image");
};

export const clearAppStateForDatabase = (appState: Partial<AppState>) => {
  return _clearAppStateForStorage(appState, "server");
};

export const isEraserActive = ({
  activeTool,
}: {
  activeTool: AppState["activeTool"];
}) => activeTool.type === "eraser";
