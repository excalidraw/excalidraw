import { FlooredNumber, AppState } from "../types";
import { ExcalidrawElement } from "../element/types";
import { getCommonBounds, getClosestElementBounds } from "../element";
import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "../utils";

export function normalizeScroll(pos: number) {
  return Math.floor(pos) as FlooredNumber;
}

export function calculateScrollCenter(
  elements: readonly ExcalidrawElement[],
  from?: {
    event: React.MouseEvent<HTMLButtonElement>;
    appState: AppState;
    canvas: HTMLCanvasElement | null;
    scale: number;
  },
): { scrollX: FlooredNumber; scrollY: FlooredNumber } {
  if (!elements.length) {
    return {
      scrollX: normalizeScroll(0),
      scrollY: normalizeScroll(0),
    };
  }

  let [x1, y1, x2, y2] = getCommonBounds(elements);

  if (from) {
    const { event, appState, canvas, scale } = from;
    const { x: viewportX1, y: viewportY1 } = sceneCoordsToViewportCoords(
      { sceneX: x1, sceneY: y1 },
      appState,
      canvas,
      scale,
    );
    const { x: viewportX2, y: viewportY2 } = sceneCoordsToViewportCoords(
      { sceneX: x2, sceneY: y2 },
      appState,
      canvas,
      scale,
    );
    const outOfViewport =
      viewportX2 - viewportX1 > window.innerWidth ||
      viewportY2 - viewportY1 > window.innerHeight;

    if (outOfViewport) {
      [x1, y1, x2, y2] = getClosestElementBounds(
        elements,
        viewportCoordsToSceneCoords(event, appState, canvas, scale),
      );
    }
  }

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  return {
    scrollX: normalizeScroll(window.innerWidth / 2 - centerX),
    scrollY: normalizeScroll(window.innerHeight / 2 - centerY),
  };
}
