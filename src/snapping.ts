import {
  getCommonBounds,
  getDraggedElementsBounds,
  getElementAbsoluteCoords,
  getElementBounds,
} from "./element/bounds";
import { isBoundToContainer, isFrameElement } from "./element/typeChecks";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./element/types";
import * as GA from "./ga";
import * as GALines from "./galines";
import * as GAPoints from "./gapoints";
import { getMaximumGroups } from "./groups";
import { KEYS } from "./keys";
import {
  distance2d,
  rangeIntersection,
  rangesOverlap,
  rotatePoint,
} from "./math";
import { getVisibleAndNonSelectedElements } from "./scene/selection";
import { AppState, Point, Zoom } from "./types";

const SNAP_DISTANCE = 8;

export const getSnapThreshold = (zoomValue: number) => {
  return SNAP_DISTANCE / zoomValue;
};

// handle floating point errors
export const SNAP_PRECISION = 0.001;

export type SnapLine = {
  id: string;
  line: GA.Line;
  point: GA.Point;
  direction: "vertical" | "horizontal";
};

export type Snap = {
  distance: number;
  point: GA.Point;
  snapLine: SnapLine;
  isSnapped: boolean;
};

export type Gap = {
  //  start edge ↓     length
  // ┌───────────┐◄───────────────►
  // │           │-----------------┌───────────┐
  // │  start    │       ↑         │           │
  // │  element  │  intersection   │  end      │
  // │           │       ↓         │  element  │
  // └───────────┘-----------------│           │
  //                               └───────────┘
  //                               ↑ end edge

  startElement: ExcalidrawElement;
  endElement: ExcalidrawElement;
  startEdge: [Point, Point];
  endEdge: [Point, Point];
  length: number;
  intersection: [number, number];
};

export type GapSnap = {
  type: "gap";
  direction:
    | "center_horizontal"
    | "center_vertical"
    | "side_left"
    | "side_right"
    | "side_top"
    | "side_bottom";
  gap: Gap;
  offset: number;
};

export type GapSnaps = GapSnap[];

export type Snaps = Snap[];

const shouldSnap = (snap: Snap, zoom: Zoom) =>
  snap.distance < SNAP_DISTANCE / zoom.value / 2;

export const isSnappingEnabled = ({
  event,
  appState,
  selectedElements,
}: {
  appState: AppState;
  event: PointerEvent | MouseEvent | KeyboardEvent | null;
  selectedElements: NonDeletedExcalidrawElement[];
}) => {
  // do not suggest snaps for an arrow to give way to binding
  if (selectedElements.length === 1 && selectedElements[0].type === "arrow") {
    return false;
  }

  if (event) {
    return (
      (appState.objectsSnapModeEnabled && !event[KEYS.CTRL_OR_CMD]) ||
      (!appState.objectsSnapModeEnabled && event[KEYS.CTRL_OR_CMD])
    );
  }
  return appState.objectsSnapModeEnabled;
};

export const round = (x: number) => {
  // round numbers to avoid glitches for floating point rounding errors
  const decimalPlacesTolerance = 8;
  return (
    Math.round(x * 10 ** decimalPlacesTolerance) / 10 ** decimalPlacesTolerance
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

// find out which point the given snap should be snapped to
export const snapToPoint = (snap: Snap): Point => {
  const from = GAPoints.toTuple(snap.snapLine.point);
  const to = GAPoints.toTuple(snap.point);

  return snap.snapLine.direction === "horizontal"
    ? [to[0], from[1]]
    : [from[0], to[1]];
};

export const areRoughlyEqual = (
  a: number,
  b: number,
  precision = SNAP_PRECISION,
) => {
  return Math.abs(a - b) <= precision;
};

export const getElementsCorners = (
  elements: ExcalidrawElement[],
  {
    omitCenter,
    boundingBoxCorners,
  }: {
    omitCenter?: boolean;
    boundingBoxCorners?: boolean;
  } = {
    omitCenter: false,
    boundingBoxCorners: false,
  },
): Point[] => {
  if (elements.length === 1) {
    const element = elements[0];

    const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(element);

    const halfWidth = (x2 - x1) / 2;
    const halfHeight = (y2 - y1) / 2;

    if (
      (element.type === "diamond" || element.type === "ellipse") &&
      !boundingBoxCorners
    ) {
      const leftMid = rotatePoint(
        [x1, y1 + halfHeight],
        [cx, cy],
        element.angle,
      );
      const topMid = rotatePoint([x1 + halfWidth, y1], [cx, cy], element.angle);
      const rightMid = rotatePoint(
        [x2, y1 + halfHeight],
        [cx, cy],
        element.angle,
      );
      const bottomMid = rotatePoint(
        [x1 + halfWidth, y2],
        [cx, cy],
        element.angle,
      );
      const center: Point = [cx, cy];

      return omitCenter
        ? [leftMid, topMid, rightMid, bottomMid]
        : [leftMid, topMid, rightMid, bottomMid, center];
    }

    const topLeft = rotatePoint([x1, y1], [cx, cy], element.angle).map(
      (point) => round(point),
    ) as [number, number];
    const topRight = rotatePoint([x2, y1], [cx, cy], element.angle).map(
      (point) => round(point),
    ) as [number, number];
    const bottomLeft = rotatePoint([x1, y2], [cx, cy], element.angle).map(
      (point) => round(point),
    ) as [number, number];
    const bottomRight = rotatePoint([x2, y2], [cx, cy], element.angle).map(
      (point) => round(point),
    ) as [number, number];
    const center: Point = [cx, cy].map((point) => round(point)) as [
      number,
      number,
    ];

    return omitCenter
      ? [topLeft, topRight, bottomLeft, bottomRight]
      : [topLeft, topRight, bottomLeft, bottomRight, center];
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
  id: string,
): SnapLine => {
  const gaFrom = GAPoints.from([x, y]);
  const gaTo = GAPoints.from(
    direction === "vertical" ? [x, y + SNAP_DISTANCE] : [x + SNAP_DISTANCE, y],
  );

  return {
    id: `${id}_${direction}`,
    line: GALines.through(gaFrom, gaTo),
    point: gaFrom,
    direction,
  };
};

const getElementsSnapLines = (elements: ExcalidrawElement[]) => {
  const corners = getElementsCorners(elements);
  const id = elements[0].id;

  return Object.values(corners)
    .map((point) => [
      createSnapLine(point, "horizontal", id),
      createSnapLine(point, "vertical", id),
    ])
    .flat();
};

const getReferenceElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElements: NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const selectedFrames = selectedElements
    .filter((element) => isFrameElement(element))
    .map((frame) => frame.id);

  return getVisibleAndNonSelectedElements(
    elements,
    selectedElements,
    appState,
  ).filter(
    (element) => !(element.frameId && selectedFrames.includes(element.frameId)),
  );
};

export const getSnaps = ({
  elements,
  selectedElements,
  corners,
  appState,
  event = null,
  dragOffset = {
    x: 0,
    y: 0,
  },
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  selectedElements: NonDeletedExcalidrawElement[];
  corners: Point[];
  appState: AppState;
  event?: PointerEvent | MouseEvent | KeyboardEvent | null;
  dragOffset?: { x: number; y: number };
}) => {
  if (!isSnappingEnabled({ appState, event, selectedElements })) {
    return null;
  }

  if (selectedElements.length === 0) {
    return null;
  }

  let referenceElements: ExcalidrawElement[] = getReferenceElements(
    elements,
    selectedElements,
    appState,
  );

  if (appState.frameToHighlight) {
    referenceElements = referenceElements.filter(
      (element) => element.frameId === appState.frameToHighlight?.id,
    );
  } else if (
    appState.isResizing &&
    new Set(selectedElements.map((element) => element.frameId)).size === 1
  ) {
    const frameId = selectedElements[0].frameId;
    referenceElements = referenceElements.filter(
      (element) => element.frameId === frameId,
    );
  } else {
    referenceElements = referenceElements.filter((element) => !element.frameId);
  }

  const offset = GA.offset(dragOffset.x, dragOffset.y);

  const snaps = getMaximumGroups(referenceElements)
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
          const distance = round(
            Math.abs(GAPoints.distanceToLine(point, snapLine.line)),
          );

          return {
            distance,
            point,
            snapLine,
            isSnapped: false,
          };
        })
        .filter(
          (snap): snap is Snap =>
            snap !== null && shouldSnap(snap, appState.zoom),
        ),
    );

  if (snaps.length > 0) {
    if (!appState.isResizing) {
      const verticalSnaps: Snaps = [];
      const horizontalSnaps: Snaps = [];

      let leastVerticalDistance = SNAP_DISTANCE / appState.zoom.value;
      let leastHorizontalDistance = SNAP_DISTANCE / appState.zoom.value;

      for (const snap of snaps) {
        if (snap.snapLine.direction === "horizontal") {
          horizontalSnaps.push(snap);
          if (snap.distance < leastHorizontalDistance) {
            leastHorizontalDistance = snap.distance;
          }
        } else {
          verticalSnaps.push(snap);
          if (snap.distance < leastVerticalDistance) {
            leastVerticalDistance = snap.distance;
          }
        }
      }

      return [
        ...verticalSnaps.filter((snap) =>
          areRoughlyEqual(snap.distance, leastVerticalDistance),
        ),
        ...horizontalSnaps.filter((snap) =>
          areRoughlyEqual(snap.distance, leastHorizontalDistance),
        ),
      ];
    }

    return snaps;
  }

  return null;
};

// TODO: rename to something more appropriate
export const getNearestSnaps = (
  corner: Point,
  snaps: Snaps,
  appState: AppState,
  onlyKeepOne = false,
) => {
  let verticalSnap: Snap | null = null;
  let horizontalSnap: Snap | null = null;

  const snapThreshold = getSnapThreshold(appState.zoom.value);

  let leastDistanceX = snapThreshold;
  let leastDistanceY = snapThreshold;

  for (const snap of snaps) {
    const distance = round(distance2d(...snapToPoint(snap), ...corner));

    if (snap.snapLine.direction === "vertical") {
      if (distance <= leastDistanceX) {
        leastDistanceX = distance;
        verticalSnap = snap;
      }
    } else if (distance <= leastDistanceY) {
      leastDistanceY = distance;
      horizontalSnap = snap;
    }
  }

  if (onlyKeepOne) {
    if (leastDistanceX < leastDistanceY) {
      horizontalSnap = null;
    }

    if (leastDistanceY < leastDistanceX) {
      verticalSnap = null;
    }
  }

  return {
    verticalSnap,
    horizontalSnap,
  };
};

export const getVisibleGaps = (
  elements: ExcalidrawElement[],
  selectedElements: ExcalidrawElement[],
  appState: AppState,
) => {
  const referenceElements: ExcalidrawElement[] = getReferenceElements(
    elements,
    selectedElements,
    appState,
  );

  // TODO: we could cache horizontally and vertically sorted elements
  const horizontallySorted = referenceElements.sort(
    (a, b) => getElementBounds(a)[0] - getElementBounds(b)[0],
  );

  const horizontalGaps: Gap[] = [];

  for (let i = 0; i < horizontallySorted.length; i++) {
    const startElement = horizontallySorted[i];

    for (let j = i + 1; j < horizontallySorted.length; j++) {
      const endElement = horizontallySorted[j];

      const [, startMinY, startMaxX, startMaxY] =
        getElementBounds(startElement);
      const [endMinX, endMinY, , endMaxY] = getElementBounds(endElement);

      if (
        startMaxX < endMinX &&
        rangesOverlap([startMinY, startMaxY], [endMinY, endMaxY])
      ) {
        horizontalGaps.push({
          startElement,
          endElement,
          startEdge: [
            [startMaxX, startMinY],
            [startMaxX, startMaxY],
          ],
          endEdge: [
            [endMinX, endMinY],
            [endMinX, endMaxY],
          ],
          length: endMinX - startMaxX,
          intersection: rangeIntersection(
            [startMinY, startMaxY],
            [endMinY, endMaxY],
          )!,
        });
      }
    }
  }

  const verticallySorted = referenceElements.sort(
    (a, b) => getElementBounds(a)[1] - getElementBounds(b)[1],
  );

  const verticalGaps: Gap[] = [];

  for (let i = 0; i < verticallySorted.length; i++) {
    const startElement = verticallySorted[i];

    for (let j = i + 1; j < verticallySorted.length; j++) {
      const endElement = verticallySorted[j];

      const [startMinX, , startMaxX, startMaxY] =
        getElementBounds(startElement);
      const [endMinX, endMinY, endMaxX] = getElementBounds(endElement);

      if (
        startMaxY < endMinY &&
        rangesOverlap([startMinX, startMaxX], [endMinX, endMaxX])
      ) {
        verticalGaps.push({
          startElement,
          endElement,
          startEdge: [
            [startMinX, startMaxY],
            [startMaxX, startMaxY],
          ],
          endEdge: [
            [endMinX, endMinY],
            [endMaxX, endMinY],
          ],
          length: endMinY - startMaxY,
          intersection: rangeIntersection(
            [startMinX, startMaxX],
            [endMinX, endMaxX],
          )!,
        });
      }
    }
  }

  return {
    horizontalGaps,
    verticalGaps,
  };
};

export const getGapSnaps = (
  elements: ExcalidrawElement[],
  selectedElements: ExcalidrawElement[],
  dragOffset: { x: number; y: number },
  appState: AppState,
): GapSnaps => {
  const { horizontalGaps, verticalGaps } = getVisibleGaps(
    elements,
    selectedElements,
    appState,
  );

  const [minX, minY, maxX, maxY] = getDraggedElementsBounds(
    selectedElements,
    dragOffset,
  );
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let minOffsetX = SNAP_DISTANCE;
  const neartestSnapsX: GapSnaps = [];

  for (const gap of horizontalGaps) {
    if (!rangesOverlap([minY, maxY], gap.intersection)) {
      continue;
    }

    // center gap
    const gapMidX = gap.startEdge[0][0] + gap.length / 2;
    const centerOffset = gapMidX - centerX;
    const gapIsLargerThanSelection = gap.length > maxX - minX;

    if (
      gapIsLargerThanSelection &&
      round(Math.abs(centerOffset)) <= minOffsetX
    ) {
      if (round(Math.abs(centerOffset)) < minOffsetX) {
        neartestSnapsX.length = 0;
      }
      minOffsetX = Math.abs(centerOffset);

      const snap: GapSnap = {
        type: "gap",
        direction: "center_horizontal",
        gap,
        offset: centerOffset,
      };

      neartestSnapsX.push(snap);
      continue;
    }

    // side gap, from the right
    const [, , endMaxX] = getElementBounds(gap.endElement);
    const distanceToEndElementX = minX - endMaxX;
    const sideOffsetRight = distanceToEndElementX - gap.length;

    if (round(Math.abs(sideOffsetRight)) <= minOffsetX) {
      if (round(Math.abs(sideOffsetRight)) < minOffsetX) {
        neartestSnapsX.length = 0;
      }

      const snap: GapSnap = {
        type: "gap",
        direction: "side_right",
        gap,
        offset: sideOffsetRight,
      };
      neartestSnapsX.push(snap);
      continue;
    }

    // side gap, from the left
    const [startMinX, , ,] = getElementBounds(gap.startElement);
    const distanceToStartElementX = startMinX - maxX;
    const sideOffsetLeft = distanceToStartElementX - gap.length;

    if (round(Math.abs(sideOffsetLeft)) <= minOffsetX) {
      if (round(Math.abs(sideOffsetLeft)) < minOffsetX) {
        neartestSnapsX.length = 0;
      }

      const snap: GapSnap = {
        type: "gap",
        direction: "side_left",
        gap,
        offset: sideOffsetLeft,
      };
      neartestSnapsX.push(snap);
      continue;
    }
  }

  const neartestSnapsY: GapSnaps = [];
  let minOffsetY = SNAP_DISTANCE;
  for (const gap of verticalGaps) {
    if (!rangesOverlap([minX, maxX], gap.intersection)) {
      continue;
    }

    // center gap
    const gapMidY = gap.startEdge[0][1] + gap.length / 2;
    const centerOffset = gapMidY - centerY;
    const gapIsLargerThanSelection = gap.length > maxY - minY;

    if (
      gapIsLargerThanSelection &&
      round(Math.abs(centerOffset)) <= minOffsetY
    ) {
      if (round(Math.abs(centerOffset)) < minOffsetX) {
        neartestSnapsY.length = 0;
      }
      minOffsetY = Math.abs(centerOffset);

      const snap: GapSnap = {
        type: "gap",
        direction: "center_vertical",
        gap,
        offset: centerOffset,
      };

      neartestSnapsY.push(snap);
      continue;
    }

    // side gap, from the top
    const [, startMinY, ,] = getElementBounds(gap.startElement);
    const distanceToStartElementY = startMinY - maxY;
    const sideOffsetTop = distanceToStartElementY - gap.length;

    if (round(Math.abs(sideOffsetTop)) <= minOffsetX) {
      if (round(Math.abs(sideOffsetTop)) < minOffsetX) {
        neartestSnapsY.length = 0;
      }

      const snap: GapSnap = {
        type: "gap",
        direction: "side_top",
        gap,
        offset: sideOffsetTop,
      };
      neartestSnapsY.push(snap);
      continue;
    }

    // side gap, from the bottom
    const [, , , endMaxY] = getElementBounds(gap.endElement);
    const distanceToEndElementY = minY - endMaxY;
    const sideOffsetBottom = distanceToEndElementY - gap.length;

    if (round(Math.abs(sideOffsetBottom)) <= minOffsetX) {
      if (round(Math.abs(sideOffsetBottom)) < minOffsetX) {
        neartestSnapsY.length = 0;
      }

      const snap: GapSnap = {
        type: "gap",
        direction: "side_bottom",
        gap,
        offset: sideOffsetBottom,
      };
      neartestSnapsY.push(snap);
      continue;
    }
  }

  return [...neartestSnapsX, ...neartestSnapsY];
};
