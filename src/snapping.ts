import { getCommonBounds } from "./element";
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
import { AppState, Zoom } from "./types";

export type TuplePoint = [x: number, y: number];

export type Snap = {
  distance: number;
  point: GA.Point;
  snapLine: SnapLine;
};

export type Snaps = Snap[];

export type SnapLine = {
  line: GA.Line;
  points: GA.Point[];
};

const SNAP_DISTANCE = 15;
// handle floating point errors
const PRECISION = 0.001;

const getElementsCoordinates = (elements: ExcalidrawElement[]) => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = maxX - minX;
  const height = maxY - minY;

  return {
    nw: GA.point(minX, minY),
    ne: GA.point(maxX, minY),
    sw: GA.point(minX, maxY),
    se: GA.point(maxX, maxY),
    n: GA.point(minX + width / 2, minY),
    s: GA.point(minX + width / 2, maxY),
    w: GA.point(minX, minY + height / 2),
    e: GA.point(maxX, minY + height / 2),
  };
};

const snapLine = (from: GA.Point, to: GA.Point): SnapLine | null => {
  if (GA.equal(from, to, PRECISION)) {
    return null;
  }

  return {
    line: GALines.through(from, to),
    points: [from, to],
  };
};

const getElementsSnapLines = (elements: ExcalidrawElement[]) => {
  const borderPoints = getElementsCoordinates(elements);

  return [
    // left
    snapLine(borderPoints.nw, borderPoints.sw),
    // right
    snapLine(borderPoints.ne, borderPoints.se),
    // top
    snapLine(borderPoints.nw, borderPoints.ne),
    // bottom
    snapLine(borderPoints.sw, borderPoints.se),
    // FIXME: handle center axes
  ].filter((snapLine): snapLine is SnapLine => snapLine !== null);
};

/**
 * return only the nearest horizontal and vertical snaps to the given elements
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
  if (!isSnapEnabled({ appState, event })) {
    return null;
  }

  const selectedElements = getSelectedElements(elements, appState, true);
  if (selectedElements.length === 0) {
    return null;
  }

  const selectionCoordinates = getElementsCoordinates(selectedElements);

  const snaps = getMaximumGroups(
    getVisibleAndNonSelectedElements(elements, selectedElements),
  )
    .filter(
      (elementsGroup) => !elementsGroup.every((element) => element.locked),
    )
    .flatMap(getElementsSnapLines)
    .flatMap((snapLine) =>
      Object.values(selectionCoordinates)
        .map((originPoint) => {
          const point = GA.add(originPoint, offset);
          const distance = Math.abs(
            GAPoints.distanceToLine(point, snapLine.line),
          );

          if (Number.isNaN(distance)) {
            return null;
          }

          return { distance, point, snapLine };
        })
        .filter((snap): snap is Snap => snap !== null),
    )
    .filter((snap) => shouldSnap(snap, appState.zoom));

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

export const isSnapped = (snaps: Snaps, [x, y]: TuplePoint) =>
  snaps.some(
    (snap) =>
      Math.abs(GAPoints.distanceToLine(GA.point(x, y), snap.snapLine.line)) < 1,
  );

export const shouldSnap = (snap: Snap, zoom: Zoom) =>
  snap.distance < SNAP_DISTANCE / zoom.value;

// return the extremity coordinates for the given snapline
// which in turn decide how long the rendered snapline will be
export const getSnapLineCoordinates = (
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

const isSnapEnabled = ({
  event,
  appState,
}: {
  appState: AppState;
  event: PointerEvent;
}) =>
  (appState.objectsSnapModeEnabled && !event.metaKey) ||
  (!appState.objectsSnapModeEnabled && event.metaKey);

// given a line and some points (not necessarily on the line)
// return coordinates of the extremity projection points on the line
// from the given points
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

export interface ProjectionOptions {
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

  for (const snap of keepOnlyClosestPoints(snaps)) {
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

  return GAPoints.toObject(
    GA.add(
      GA.point(origin.x, origin.y),
      GA.add(totalOffset, GA.offset(offset.x, offset.y)),
    ),
  );
};

/**
 * Group all snap lines that are using the same axe (parallel and close enough)
 */
const keepOnlyClosestPoints = (snaps: Snaps) => {
  const groups = snaps.reduce((axes, snap) => {
    const axeIndex = axes.findIndex(
      (axe) =>
        GALines.areParallel(axe.snapLine.line, snap.snapLine.line, PRECISION) &&
        GALines.distance(axe.snapLine.line, snap.snapLine.line) < PRECISION,
    );

    if (axeIndex === -1) {
      axes.push(snap);
    } else if (snap.distance < axes[axeIndex].distance) {
      axes[axeIndex] = snap;
    }

    return axes;
  }, [] as Snaps);

  return groups;
};

const areRoughlyEqual = (a: number, b: number, precision = PRECISION) => {
  return Math.abs(a - b) <= precision;
};
