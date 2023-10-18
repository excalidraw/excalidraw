import { zoomToFit } from "../actions/actionCanvas";
import { AppState } from "../types";
import { ExcalidrawElement } from "./types";

export const zoomToFitAllElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  return zoomToFit({
    targetElements: elements,
    appState,
    fitToViewport: true,
    viewportZoomFactor: 1,
  }).appState;
};
