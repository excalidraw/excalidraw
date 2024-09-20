import type { AppState, Offsets, PointerCoords, Zoom } from "../types";
import type { ExcalidrawElement } from "../element/types";
import {
  getCommonBounds,
  getClosestElementBounds,
  getVisibleElements,
} from "../element";

import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "../utils";

const isOutsideViewPort = (appState: AppState, cords: Array<number>) => {
  const [x1, y1, x2, y2] = cords;
  const { x: viewportX1, y: viewportY1 } = sceneCoordsToViewportCoords(
    { sceneX: x1, sceneY: y1 },
    appState,
  );
  const { x: viewportX2, y: viewportY2 } = sceneCoordsToViewportCoords(
    { sceneX: x2, sceneY: y2 },
    appState,
  );
  return (
    viewportX2 - viewportX1 > appState.width ||
    viewportY2 - viewportY1 > appState.height
  );
};

export const centerScrollOn = ({
  scenePoint,
  viewportDimensions,
  zoom,
  offsets,
}: {
  scenePoint: PointerCoords;
  viewportDimensions: { height: number; width: number };
  zoom: Zoom;
  offsets?: Offsets;
}) => {
  let scrollX =
    (viewportDimensions.width - (offsets?.right ?? 0)) / 2 / zoom.value -
    scenePoint.x;

  scrollX += (offsets?.left ?? 0) / 2 / zoom.value;

  let scrollY =
    (viewportDimensions.height - (offsets?.bottom ?? 0)) / 2 / zoom.value -
    scenePoint.y;

  scrollY += (offsets?.top ?? 0) / 2 / zoom.value;

  return {
    scrollX,
    scrollY,
  };
};

export const calculateScrollCenter = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): { scrollX: number; scrollY: number } => {
  elements = getVisibleElements(elements);

  if (!elements.length) {
    return {
      scrollX: 0,
      scrollY: 0,
    };
  }
  let [x1, y1, x2, y2] = getCommonBounds(elements);

  if (isOutsideViewPort(appState, [x1, y1, x2, y2])) {
    [x1, y1, x2, y2] = getClosestElementBounds(
      elements,
      viewportCoordsToSceneCoords(
        { clientX: appState.scrollX, clientY: appState.scrollY },
        appState,
      ),
    );
  }

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  return centerScrollOn({
    scenePoint: { x: centerX, y: centerY },
    viewportDimensions: { width: appState.width, height: appState.height },
    zoom: appState.zoom,
  });
};
