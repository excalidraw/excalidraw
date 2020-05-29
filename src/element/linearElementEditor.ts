import { NonDeleted, ExcalidrawLinearElement } from "./types";
import { distance2d, rotate, adjustXYWithRotation, isPathALoop } from "../math";
import { getElementAbsoluteCoords } from ".";
import { getElementPointsCoords } from "./bounds";
import { Point, AppState } from "../types";
import { mutateElement } from "./mutateElement";
import { KEYS } from "../keys";

export class LinearElementEditor {
  public element: NonDeleted<ExcalidrawLinearElement>;
  public activePointIndex: number | null;
  public draggingElementPointIndex: number | null;
  public lastUncommittedPoint: Point | null;

  constructor(element: LinearElementEditor["element"]) {
    LinearElementEditor.normalizePoints(element);

    this.element = element;
    this.activePointIndex = null;
    this.lastUncommittedPoint = null;
    this.draggingElementPointIndex = null;
  }

  // ---------------------------------------------------------------------------
  // static methods
  // ---------------------------------------------------------------------------

  static POINT_HANDLE_SIZE = 20;

  /** @returns whether point was dragged */
  static handlePointDragging(
    appState: AppState,
    setState: React.Component<any, AppState>["setState"],
    scenePointerX: number,
    scenePointerY: number,
    lastX: number,
    lastY: number,
  ): boolean {
    if (!appState.editingLinearElement) {
      return false;
    }
    const { editingLinearElement } = appState;
    let { draggingElementPointIndex, element } = editingLinearElement;

    const clickedPointIndex =
      draggingElementPointIndex ??
      LinearElementEditor.getPointIndexUnderCursor(
        editingLinearElement.element,
        appState.zoom,
        scenePointerX,
        scenePointerY,
      );

    draggingElementPointIndex = draggingElementPointIndex ?? clickedPointIndex;
    if (draggingElementPointIndex > -1) {
      if (
        editingLinearElement.draggingElementPointIndex !==
          draggingElementPointIndex ||
        editingLinearElement.activePointIndex !== clickedPointIndex
      ) {
        setState({
          editingLinearElement: {
            ...editingLinearElement,
            draggingElementPointIndex,
            activePointIndex: clickedPointIndex,
          },
        });
      }

      const [deltaX, deltaY] = rotate(
        scenePointerX - lastX,
        scenePointerY - lastY,
        0,
        0,
        -element.angle,
      );
      const targetPoint = element.points[clickedPointIndex];
      LinearElementEditor.movePoint(element, clickedPointIndex, [
        targetPoint[0] + deltaX,
        targetPoint[1] + deltaY,
      ]);
      return true;
    }
    return false;
  }

  static handlePointerUp(
    editingLinearElement: LinearElementEditor,
  ): LinearElementEditor {
    const { element, draggingElementPointIndex } = editingLinearElement;
    if (
      draggingElementPointIndex !== null &&
      (draggingElementPointIndex === 0 ||
        draggingElementPointIndex === element.points.length - 1) &&
      isPathALoop(element.points)
    ) {
      LinearElementEditor.movePoint(
        element,
        draggingElementPointIndex,
        draggingElementPointIndex === 0
          ? element.points[element.points.length - 1]
          : element.points[0],
      );
    }
    if (draggingElementPointIndex !== null) {
      return {
        ...editingLinearElement,
        draggingElementPointIndex: null,
      };
    }
    return editingLinearElement;
  }

  static handlePointerMove(
    event: React.PointerEvent<HTMLCanvasElement>,
    scenePointerX: number,
    scenePointerY: number,
    editingLinearElement: LinearElementEditor,
  ): LinearElementEditor {
    const { element, lastUncommittedPoint } = editingLinearElement;
    const { points } = element;
    const lastPoint = points[points.length - 1];

    if (!event[KEYS.CTRL_OR_CMD]) {
      if (lastPoint === lastUncommittedPoint) {
        mutateElement(element, {
          points: points.slice(0, -1),
        });
      }
      return editingLinearElement;
    }

    const newPoint = LinearElementEditor.createPointAt(
      element,
      scenePointerX,
      scenePointerY,
    );

    if (lastPoint === lastUncommittedPoint) {
      mutateElement(element, {
        points: [...points.slice(0, -1), newPoint],
      });
    } else {
      mutateElement(element, {
        points: [...points, newPoint],
      });
    }

    return {
      ...editingLinearElement,
      lastUncommittedPoint: element.points[element.points.length - 1],
    };
  }

  static getPointsGlobalCoordinates(
    element: NonDeleted<ExcalidrawLinearElement>,
  ) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return element.points.map((point) => {
      let { x, y } = element;
      [x, y] = rotate(x + point[0], y + point[1], cx, cy, element.angle);
      return [x, y];
    });
  }

  static getPointIndexUnderCursor(
    element: NonDeleted<ExcalidrawLinearElement>,
    zoom: AppState["zoom"],
    x: number,
    y: number,
  ) {
    const pointHandles = this.getPointsGlobalCoordinates(element);
    let idx = pointHandles.length;
    // loop from right to left because points on the right are rendered over
    //  points on the left, thus should take precedence when clicking, if they
    //  overlap
    while (--idx > -1) {
      const point = pointHandles[idx];
      if (
        distance2d(x, y, point[0], point[1]) * zoom <
        // +1px to account for outline stroke
        this.POINT_HANDLE_SIZE / 2 + 1
      ) {
        return idx;
      }
    }
    return -1;
  }

  static createPointAt(
    element: NonDeleted<ExcalidrawLinearElement>,
    pointerX: number,
    pointerY: number,
  ): Point {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const [rotatedX, rotatedY] = rotate(
      pointerX,
      pointerY,
      cx,
      cy,
      -element.angle,
    );

    return [rotatedX - element.x, rotatedY - element.y];
  }

  // element-mutating methods
  // ---------------------------------------------------------------------------

  /**
   * Normalizes line points so that the start point is at [0,0]. This is
   *  expected in various parts of the codebase.
   */
  static normalizePoints(element: NonDeleted<ExcalidrawLinearElement>) {
    const { points } = element;

    const offsetX = points[0][0];
    const offsetY = points[0][1];

    mutateElement(element, {
      points: points.map((point, idx) => {
        return [point[0] - offsetX, point[1] - offsetY] as const;
      }),
      x: element.x + offsetX,
      y: element.y + offsetY,
    });
  }

  static movePoint(
    element: NonDeleted<ExcalidrawLinearElement>,
    pointIndex: number,
    targetPosition: Point,
  ) {
    const { points } = element;

    // in case we're moving start point, instead of modifying its position
    //  which would break the invariant of it being at [0,0], we move
    //  all the other points in the opposite direction by delta to
    //  offset it. We do the same with actual element.x/y position, so
    //  this hacks are completely transparent to the user.
    let offsetX = 0;
    let offsetY = 0;

    const deltaX = targetPosition[0] - points[pointIndex][0];
    const deltaY = targetPosition[1] - points[pointIndex][1];
    const nextPoints = points.map((point, idx) => {
      if (idx === pointIndex) {
        if (idx === 0) {
          offsetX = deltaX;
          offsetY = deltaY;
          return point;
        }
        offsetX = 0;
        offsetY = 0;

        return [point[0] + deltaX, point[1] + deltaY] as const;
      }
      return offsetX || offsetY
        ? ([point[0] - offsetX, point[1] - offsetY] as const)
        : point;
    });

    const nextCoords = getElementPointsCoords(element, nextPoints);
    const prevCoords = getElementPointsCoords(element, points);
    const centerX = (prevCoords[0] + prevCoords[2]) / 2;
    const centerY = (prevCoords[1] + prevCoords[3]) / 2;
    const side = ((targetPosition[1] < centerY ? "n" : "s") +
      (targetPosition[0] < centerX ? "w" : "e")) as "nw" | "ne" | "sw" | "se";
    const adjustedXY = adjustXYWithRotation(
      side,
      element.x,
      element.y,
      element.angle,
      (prevCoords[0] - nextCoords[0]) / 2,
      (prevCoords[1] - nextCoords[1]) / 2,
      (prevCoords[2] - nextCoords[2]) / 2,
      (prevCoords[3] - nextCoords[3]) / 2,
      false,
    );

    mutateElement(element, {
      points: nextPoints,
      x: adjustedXY[0],
      y: adjustedXY[1],
    });
  }
}
