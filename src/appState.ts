import { AppState } from "./types";
import { getDateTime } from "./utils";

const DEFAULT_PROJECT_NAME = `excalidraw-${getDateTime()}`;

export function getDefaultAppState(): AppState {
  return {
    draggingElement: null,
    resizingElement: null,
    elementType: "selection",
    exportBackground: true,
    currentItemStrokeColor: "#000",
    currentItemBackgroundColor: "transparent",
    currentItemFont: "20px Virgil",
    viewBackgroundColor: "#fff",
    scrollX: 0,
    scrollY: 0,
    cursorX: 0,
    cursorY: 0,
    name: DEFAULT_PROJECT_NAME
  };
}
