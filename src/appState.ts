import { AppState } from "./types";
import { getDateTime } from "./utils";

const DEFAULT_PROJECT_NAME = `excalidraw-${getDateTime()}`;

export function getDefaultAppState(): AppState {
  return {
    draggingElement: null,
    resizingElement: null,
    multiElement: null,
    editingElement: null,
    elementType: "selection",
    elementLocked: false,
    exportBackground: true,
    currentItemStrokeColor: "#000000",
    currentItemBackgroundColor: "transparent",
    currentItemFillStyle: "hachure",
    currentItemStrokeWidth: 1,
    currentItemRoughness: 1,
    currentItemOpacity: 100,
    currentItemFont: "20px Virgil",
    viewBackgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    cursorX: 0,
    cursorY: 0,
    scrolledOutside: false,
    name: DEFAULT_PROJECT_NAME,
    isResizing: false,
  };
}

export function clearAppStateForLocalStorage(appState: AppState) {
  const {
    draggingElement,
    resizingElement,
    multiElement,
    editingElement,
    isResizing,
    ...exportedState
  } = appState;
  return exportedState;
}

export function cleanAppStateForExport(appState: AppState) {
  return {
    viewBackgroundColor: appState.viewBackgroundColor,
  };
}
