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

  const selectedElements = getSelectedElements(elements, appState);
  if (selectedElements.length === 0) {
    return null;
  }

  const selectionCoordinates = getElementsCoordinates(selectedElements);

  return getMaximumGroups(getVisibleAndNonSelectedElements(elements, appState))
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
    .filter((snap) => shouldSnap(snap, appState.zoom))
    .sort((a, b) => a.distance - b.distance);
};

export const isSnapped = (snaps: Snaps, [x, y]: TuplePoint) =>
  snaps.some(
    (snap) =>
      Math.abs(GAPoints.distanceToLine(GA.point(x, y), snap.snapLine.line)) < 1,
  );

export const shouldSnap = (snap: Snap, zoom: Zoom) =>
  snap.distance < SNAP_DISTANCE / zoom.value;

export const getSnapLineCoordinates = (
  snapLine: SnapLine,
  expansionFactor: number,
) => {
  const { from, to } = getLineExtremities(
    snapLine.line,
    snapLine.points as [GA.Point, GA.Point, ...GA.Point[]],
  );

  const delta = GA.mul(GA.sub(to, from), expansionFactor);

  return {
    from: GAPoints.toObject(GA.sub(from, delta)),
    to: GAPoints.toObject(GA.add(to, delta)),
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
