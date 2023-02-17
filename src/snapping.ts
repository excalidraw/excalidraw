import { getElementAbsoluteCoords } from "./element";
import {
  getBorderPointsFormCoords,
  TransformHandleDirection,
} from "./element/transformHandles";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./element/types";
import * as GA from "./ga";
import * as GALines from "./galines";
import * as GAPoints from "./gapoints";
import { getSelectedElements } from "./scene";
import { AppState } from "./types";

export type TuplePoint = [x: number, y: number];

export type Snap = {
  selectionToSnapLine: {
    distance: number;
    point: GA.Point;
    snapLine: SnapLine;
  }[];
  selectionCoordinates: Record<TransformHandleDirection, GA.Point>;
};

export type SnapLine = {
  line: GA.Line;
  points: GA.Point[];
  fromTo(addPoints?: GA.Point[]): { from: TuplePoint; to: TuplePoint };
};

const MAX_DISTANCE = 150;

const getElementCoordinates = (element: ExcalidrawElement) => {
  const coordinates = getElementAbsoluteCoords(element);
  const borderPoints = getBorderPointsFormCoords(coordinates, element.angle);

  return {
    nw: GA.point(...borderPoints.nw),
    ne: GA.point(...borderPoints.ne),
    sw: GA.point(...borderPoints.sw),
    se: GA.point(...borderPoints.se),
    n: GA.point(...borderPoints.n),
    s: GA.point(...borderPoints.s),
    w: GA.point(...borderPoints.w),
    e: GA.point(...borderPoints.e),
  };
};

const snapLine = (from: GA.Point, to: GA.Point) => ({
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
});

const getElementSnapLines = (element: ExcalidrawElement) => {
  const borderPoints = getElementCoordinates(element);

  return {
    left: snapLine(borderPoints.nw, borderPoints.sw),
    right: snapLine(borderPoints.ne, borderPoints.se),
    top: snapLine(borderPoints.nw, borderPoints.ne),
    bottom: snapLine(borderPoints.sw, borderPoints.se),
    // FIXME: handle center axes
  };
};

export const getSnap = ({
  elements,
  appState,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
}): Snap | null => {
  const selectedElements = getSelectedElements(elements, appState);

  if (selectedElements.length !== 1) {
    return null;
  }

  // FIXME: handle multi selection box
  const selectedElement = selectedElements[0];
  const selectionCoordinates = getElementCoordinates(selectedElement);

  const selectionToSnapLine = elements
    // non selected
    .filter(
      (sceneElement) =>
        selectedElements.some(
          (selectedElement) => selectedElement.id === sceneElement.id,
        ) === false,
    )
    // FIXME: filter only visible elements
    .flatMap((element) => {
      const snapLines = getElementSnapLines(element);

      return [snapLines.left, snapLines.right, snapLines.top, snapLines.bottom];
    })
    .flatMap((snapLine) =>
      Object.values(selectionCoordinates).map((point) => {
        const distance = Math.abs(
          GAPoints.distanceToLine(point, snapLine.line),
        );
        return { distance, point, snapLine };
      }),
    )
    .sort((a, b) => a.distance - b.distance)
    .filter((a) => a.distance < MAX_DISTANCE);

  return { selectionToSnapLine, selectionCoordinates };
};

export const isSnapped = (snap: Snap | null, [x, y]: TuplePoint) => {
  const currentSnap = snap?.selectionToSnapLine[0];
  if (!currentSnap) {
    return false;
  }

  return (
    Math.abs(
      GAPoints.distanceToLine(GA.point(x, y), currentSnap.snapLine.line),
    ) < 1
  );
};
