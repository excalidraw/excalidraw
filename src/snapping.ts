import { getCommonBounds, getElementAbsoluteCoords } from "./element/bounds";
import { isBoundToContainer } from "./element/typeChecks";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./element/types";
import * as GA from "./ga";
import * as GALines from "./galines";
import * as GAPoints from "./gapoints";
import { getMaximumGroups } from "./groups";
import { KEYS } from "./keys";
import { rotatePoint } from "./math";
import { getSelectedElements } from "./scene";
import { getVisibleAndNonSelectedElements } from "./scene/selection";
import { AppState, Point, Zoom } from "./types";

const SNAP_DISTANCE = 8;
// handle floating point errors
export const SNAP_PRECISION = 0.001;

export type SnapLine = {
  line: GA.Line;
  point: GA.Point;
};

export type Snap = {
  distance: number;
  point: GA.Point;
  snapLine: SnapLine;
};

export type Snaps = Snap[];

const shouldSnap = (snap: Snap, zoom: Zoom) =>
  snap.distance < SNAP_DISTANCE / zoom.value;

const isSnappingEnabled = ({
  event,
  appState,
  selectedElements,
}: {
  appState: AppState;
  event: PointerEvent | MouseEvent | KeyboardEvent;
  selectedElements: NonDeletedExcalidrawElement[];
}) => {
  // do not suggest snaps for an arrow to give way to binding
  if (selectedElements.length === 1 && selectedElements[0].type === "arrow") {
    return false;
  }
  return (
    (appState.objectsSnapModeEnabled && !event[KEYS.CTRL_OR_CMD]) ||
    (!appState.objectsSnapModeEnabled && event[KEYS.CTRL_OR_CMD])
  );
};

interface ProjectionOptions {
  zoom: Zoom;
  origin: { x: number; y: number };
  offset?: { x: number; y: number };
  snaps: Snaps;
}

export const snapProject = ({
  origin,
  offset = {
    x: 0,
    y: 0,
  },
  snaps,
  zoom,
}: ProjectionOptions) => {
  let totalOffset = GA.offset(0, 0);

  for (const snap of snaps) {
    if (!shouldSnap(snap, zoom)) {
      continue;
    }

    const snapReferencePoint = GA.add(snap.point, totalOffset);
    const snapProjection = GALines.orthogonalProjection(
      snapReferencePoint,
      snap.snapLine.line,
    );

    if (GA.isNaN(snapProjection)) {
      continue;
    }

    const snapOffset = GA.sub(snapReferencePoint, snapProjection);

    totalOffset = GA.sub(totalOffset, snapOffset);
  }

  return GAPoints.toTuple(
    GA.add(
      GA.point(origin.x, origin.y),
      GA.add(totalOffset, GA.offset(offset.x, offset.y)),
    ),
  );
};

const areRoughlyEqual = (a: number, b: number, precision = SNAP_PRECISION) => {
  return Math.abs(a - b) <= precision;
};

const getElementsCorners = (elements: ExcalidrawElement[]): Point[] => {
  if (elements.length === 1) {
    const element = elements[0];

    const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(element);

    const halfWidth = (x2 - x1) / 2;
    const halfHeight = (y2 - y1) / 2;

    switch (element.type) {
      case "diamond":
      case "ellipse": {
        return [
          // left-mid
          rotatePoint([x1, y1 + halfHeight], [cx, cy], element.angle),
          // top-mid
          rotatePoint([x1 + halfWidth, y1], [cx, cy], element.angle),
          // right-mid
          rotatePoint([x2, y1 + halfHeight], [cx, cy], element.angle),
          // bottom-mid
          rotatePoint([x1 + halfWidth, y2], [cx, cy], element.angle),
          // center
          [cx, cy],
        ];
      }
      case "arrow":
      case "line":
        return element.points.map(([x, y]) => [
          x + element.x,
          y + element.y,
        ]) as Point[];
      default:
        return [
          // top left
          rotatePoint([x1, y1], [cx, cy], element.angle),
          // top right
          rotatePoint([x2, y1], [cx, cy], element.angle),
          // bottom left
          rotatePoint([x1, y2], [cx, cy], element.angle),
          // bottom right
          rotatePoint([x2, y2], [cx, cy], element.angle),
          // center
          [cx, cy],
        ];
    }
  }

  if (elements.length > 1) {
    const [minX, minY, maxX, maxY] = getCommonBounds(elements);
    const width = maxX - minX;
    const height = maxY - minY;

    return [
      [minX, minY],
      [maxX, minY],
      [minX, maxY],
      [maxX, maxY],
      [minX + width / 2, minY + height / 2],
    ];
  }

  return [];
};

const createSnapLine = (
  [x, y]: Point,
  direction: "vertical" | "horizontal",
): SnapLine => {
  const gaFrom = GAPoints.from([x, y]);
  const gaTo = GAPoints.from(
    direction === "vertical" ? [x, y + SNAP_DISTANCE] : [x + SNAP_DISTANCE, y],
  );

  return {
    line: GALines.through(gaFrom, gaTo),
    point: gaFrom,
  };
};

const getElementsSnapLines = (elements: ExcalidrawElement[]) => {
  const corners = getElementsCorners(elements);

  return Object.values(corners)
    .map((point) => [
      createSnapLine(point, "horizontal"),
      createSnapLine(point, "vertical"),
    ])
    .flat();
};

export const getSnaps = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  event: PointerEvent | MouseEvent | KeyboardEvent,
  dragOffset: { x: number; y: number } = { x: 0, y: 0 },
) => {
  const selectedElements = getSelectedElements(elements, appState);

  if (!isSnappingEnabled({ appState, event, selectedElements })) {
    return null;
  }

  if (selectedElements.length === 0) {
    return null;
  }

  const corners = getElementsCorners(selectedElements);

  const offset = GA.offset(dragOffset.x, dragOffset.y);
  const snaps = getMaximumGroups(
    getVisibleAndNonSelectedElements(elements, selectedElements, appState),
  )
    .filter(
      (elementsGroup) => !elementsGroup.every((element) => element.locked),
    )
    .filter(
      (elementsGroup) =>
        !(elementsGroup.length === 1 && isBoundToContainer(elementsGroup[0])),
    )
    .flatMap(getElementsSnapLines)
    .flatMap((snapLine) =>
      corners
        .map((originPoint) => {
          const point = GA.add(GAPoints.from(originPoint), offset);
          const distance = Math.abs(
            GAPoints.distanceToLine(point, snapLine.line),
          );

          if (Number.isNaN(distance)) {
            return null;
          }

          return {
            distance,
            point,
            snapLine,
          };
        })
        .filter(
          (snap): snap is Snap =>
            snap !== null && shouldSnap(snap, appState.zoom),
        ),
    );

  if (snaps.length > 0) {
    // one group stores horizontal snaps, the other keeps vertical snaps
    const groupA: Snaps = [];
    const groupB: Snaps = [];

    for (const snap of snaps) {
      if (GALines.areParallel(snap.snapLine.line, snaps[0].snapLine.line)) {
        groupA.push(snap);
      } else {
        groupB.push(snap);
      }
    }

    const leastDistanceGroupA = Math.min(
      ...groupA.map((snap) => snap.distance),
    );
    const leastDistanceGroupB = Math.min(
      ...groupB.map((snap) => snap.distance),
    );

    return [
      ...groupA.filter((snap) =>
        areRoughlyEqual(snap.distance, leastDistanceGroupA),
      ),
      ...groupB.filter((snap) =>
        areRoughlyEqual(snap.distance, leastDistanceGroupB),
      ),
    ];
  }

  return null;
};
