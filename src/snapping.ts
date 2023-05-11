import { getElementsHandleCoordinates } from "./element/bounds";
import { TransformHandleDirection } from "./element/transformHandles";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./element/types";
import * as GA from "./ga";
import * as GALines from "./galines";
import * as GAPoints from "./gapoints";
import { getMaximumGroups } from "./groups";
import { getSelectedElements } from "./scene";
import { getVisibleAndNonSelectedElements } from "./scene/selection";
import { AppState, Point, Zoom } from "./types";

export type Snap = {
  distance: number;
  point: GA.Point;
  direction: TransformHandleDirection;
  snapLine: SnapLine;
};

export type Snaps = Snap[];

export type SnapLine = {
  line: GA.Line;
  points: GA.Point[];
};

const SNAP_DISTANCE = 15;
// handle floating point errors
export const SNAP_PRECISION = 0.001;

const snapLine = (from: Point, to: Point): SnapLine | null => {
  const gaFrom = GAPoints.from(from);
  const gaTo = GAPoints.from(to);

  if (GA.equal(gaFrom, gaTo, SNAP_PRECISION)) {
    return null;
  }

  return {
    line: GALines.through(gaFrom, gaTo),
    points: [gaFrom, gaTo],
  };
};

const getElementsSnapLines = (elements: ExcalidrawElement[]) => {
  const borderPoints = getElementsHandleCoordinates(elements);

  return [
    // left
    snapLine(borderPoints.nw, borderPoints.sw),
    // right
    snapLine(borderPoints.ne, borderPoints.se),
    // top
    snapLine(borderPoints.nw, borderPoints.ne),
    // bottom
    snapLine(borderPoints.sw, borderPoints.se),
    // center vertical
    snapLine(borderPoints.n, borderPoints.s),
    // center horizontal
    snapLine(borderPoints.w, borderPoints.e),
  ].filter((snapLine): snapLine is SnapLine => snapLine !== null);
};

/**
 * Given a list of elements and `appState`, `getSnaps` returns
 * only the nearest horizontal and vertical snaps to the selected elements
 */
export const getSnaps = ({
  elements,
  appState,
  event,
  dragOffset,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  event: PointerEvent;
  dragOffset: { x: number; y: number };
}): Snaps | null => {
  const offset = GA.offset(dragOffset.x, dragOffset.y);
  if (!isSnappingEnabled({ appState, event })) {
    return null;
  }

  const selectedElements = getSelectedElements(elements, appState, true);
  if (selectedElements.length === 0) {
    return null;
  }

  const selectionCoordinates = getElementsHandleCoordinates(selectedElements);

  // get snaps that are within the "shouldSnap" distance
  const snaps = getMaximumGroups(
    getVisibleAndNonSelectedElements(elements, selectedElements, appState),
  )
    .filter(
      (elementsGroup) => !elementsGroup.every((element) => element.locked),
    )
    .flatMap(getElementsSnapLines)
    .flatMap((snapLine) =>
      Object.entries(selectionCoordinates)
        .map(([handle, originPoint]) => {
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
            direction: handle as TransformHandleDirection,
          };
        })
        .filter(
          (snap): snap is Snap =>
            snap !== null && shouldSnap(snap, appState.zoom),
        ),
    );

  // IMPORTANT: select and return only the nearest horizontal & vertical snaps
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

const shouldSnap = (snap: Snap, zoom: Zoom) =>
  snap.distance < SNAP_DISTANCE / zoom.value;

//
/**
 * return the extremity coordinates for the given snapline
 * which in turn decide how long we should render the snapline
 *
 * optional `expansionFactor` can be supplied so that the snapline
 * is rendered with extra width proportional to its length
 */
export const getSnapLineEndPointsCoords = (
  snapLine: SnapLine,
  expansionFactor = 0,
) => {
  const { from, to } = getLineExtremities(
    snapLine.line,
    snapLine.points as [GA.Point, GA.Point, ...GA.Point[]],
  );

  const expansion = GA.mul(GA.sub(to, from), expansionFactor);

  return {
    from: GAPoints.toObject(GA.sub(from, expansion)),
    to: GAPoints.toObject(GA.add(to, expansion)),
  };
};

const isSnappingEnabled = ({
  event,
  appState,
}: {
  appState: AppState;
  event: PointerEvent;
}) =>
  (appState.objectsSnapModeEnabled && !event.metaKey) ||
  (!appState.objectsSnapModeEnabled && event.metaKey);

/**
 * given a line and some points (not necessarily on the line)
 * return coordinates of the extremity projection points on the line
 * from the given points
 */
const getLineExtremities = (
  line: GA.Line,
  points: [GA.Point, GA.Point, ...GA.Point[]],
) => {
  let [pa, pb, ...rest] = points.map((point) =>
    GALines.orthogonalProjection(point, line),
  );

  let d = GAPoints.distance(pa, pb);
  for (const p of rest) {
    const da = GAPoints.distance(p, pa);
    const db = GAPoints.distance(p, pb);
    if (da > d && da > db) {
      pb = p;
      d = da;
    } else if (db > d && db > da) {
      pa = p;
      d = db;
    }
  }

  return { from: pa, to: pb };
};

interface ProjectionOptions {
  zoom: Zoom;
  origin: { x: number; y: number };
  offset: { x: number; y: number };
  snaps: Snaps;
}

export const snapProject = ({
  origin,
  offset,
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
