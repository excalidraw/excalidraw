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
  fromTo(addPoints?: GA.Point[]): { from: TuplePoint; to: TuplePoint };
};

const SNAP_DISTANCE = 15;
// handle floating point errors
const PRECISION = 0.001;

const getElementsCoordinates = (elements: ExcalidrawElement[]) => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = maxX - minX;
  const height = maxY - minY;

  return {
    nw: GA.point(minX, maxY),
    ne: GA.point(maxX, maxY),
    sw: GA.point(minX, minY),
    se: GA.point(maxX, minY),
    n: GA.point(minX + width / 2, maxY),
    s: GA.point(minX + width / 2, minY),
    w: GA.point(minX, minY + height / 2),
    e: GA.point(maxX, minY + height / 2),
  };
};

const snapLine = (from: GA.Point, to: GA.Point) => {
  if (GA.equal(from, to, PRECISION)) {
    return null;
  }

  return {
    line: GALines.through(from, to),
    points: [from, to],
    fromTo(addPoints = []) {
      let [pa, pb, ...rest] = [
        ...this.points,
        ...addPoints.map((point) =>
          GALines.orthogonalProjection(point, this.line),
        ),
      ] as [GA.Point, GA.Point, ...GA.Point[]];

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

      return { from: GAPoints.toTuple(pa), to: GAPoints.toTuple(pb) };
    },
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
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  event: PointerEvent;
}): Snaps | null => {
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
        .map((point) => {
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

export const isSnapped = (snaps: Snaps | null, [x, y]: TuplePoint) => {
  const currentSnap = snaps?.[0];
  if (!currentSnap) {
    return false;
  }

  return (
    Math.abs(
      GAPoints.distanceToLine(GA.point(x, y), currentSnap.snapLine.line),
    ) < 1
  );
};

export const shouldSnap = (snap: Snap, zoom: Zoom) => {
  return snap.distance < SNAP_DISTANCE / zoom.value;
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
