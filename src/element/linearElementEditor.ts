import {
  NonDeleted,
  ExcalidrawLinearElement,
  ExcalidrawElement,
} from "./types";
import { distance2d, rotate, isPathALoop } from "../math";
import { getElementAbsoluteCoords } from ".";
import { getElementPointsCoords } from "./bounds";
import { Point, AppState } from "../types";
import { mutateElement } from "./mutateElement";
import { SceneHistory } from "../history";
import { globalSceneState } from "../scene";

export class LinearElementEditor {
  public elementId: ExcalidrawElement["id"];
  public activePointIndex: number | null;
  public draggingElementPointIndex: number | null;
  public lastUncommittedPoint: Point | null;

  constructor(element: NonDeleted<ExcalidrawLinearElement>) {
    LinearElementEditor.normalizePoints(element);

    this.elementId = element.id;
    this.activePointIndex = null;
    this.lastUncommittedPoint = null;
    this.draggingElementPointIndex = null;
  }

  // ---------------------------------------------------------------------------
  // static methods
  // ---------------------------------------------------------------------------

  static POINT_HANDLE_SIZE = 20;

  static getElement(id: ExcalidrawElement["id"]) {
    const element = globalSceneState.getNonDeletedElement(id);
    if (element) {
      return element as NonDeleted<ExcalidrawLinearElement>;
    }
    return null;
  }

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
    let { draggingElementPointIndex, elementId } = editingLinearElement;

    const element = LinearElementEditor.getElement(elementId);
    if (!element) {
      return false;
    }

    const clickedPointIndex =
      draggingElementPointIndex ??
      LinearElementEditor.getPointIndexUnderCursor(
        element,
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
    const { elementId, draggingElementPointIndex } = editingLinearElement;
    const element = LinearElementEditor.getElement(elementId);
    if (!element) {
      return editingLinearElement;
    }

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

  static handlePointerDown(
    event: React.PointerEvent<HTMLCanvasElement>,
    appState: AppState,
    setState: React.Component<any, AppState>["setState"],
    history: SceneHistory,
    scenePointerX: number,
    scenePointerY: number,
  ): {
    didAddPoint: boolean;
    hitElement: ExcalidrawElement | null;
  } {
    const ret: ReturnType<typeof LinearElementEditor["handlePointerDown"]> = {
      didAddPoint: false,
      hitElement: null,
    };

    if (!appState.editingLinearElement) {
      return ret;
    }

    const { elementId } = appState.editingLinearElement;
    const element = LinearElementEditor.getElement(elementId);

    if (!element) {
      return ret;
    }

    if (event.altKey) {
      if (!appState.editingLinearElement.lastUncommittedPoint) {
        mutateElement(element, {
          points: [
            ...element.points,
            LinearElementEditor.createPointAt(
              element,
              scenePointerX,
              scenePointerY,
            ),
          ],
        });
      }
      history.resumeRecording();
      setState({
        editingLinearElement: {
          ...appState.editingLinearElement,
          activePointIndex: element.points.length - 1,
          lastUncommittedPoint: null,
        },
      });
      ret.didAddPoint = true;
      return ret;
    }

    const clickedPointIndex = LinearElementEditor.getPointIndexUnderCursor(
      element,
      appState.zoom,
      scenePointerX,
      scenePointerY,
    );

    // if we clicked on a point, set the element as hitElement otherwise
    //  it would get deselected if the point is outside the hitbox area
    if (clickedPointIndex > -1) {
      ret.hitElement = element;
    }

    setState({
      editingLinearElement: {
        ...appState.editingLinearElement,
        activePointIndex: clickedPointIndex > -1 ? clickedPointIndex : null,
      },
    });
    return ret;
  }

  static handlePointerMove(
    event: React.PointerEvent<HTMLCanvasElement>,
    scenePointerX: number,
    scenePointerY: number,
    editingLinearElement: LinearElementEditor,
  ): LinearElementEditor {
    const { elementId, lastUncommittedPoint } = editingLinearElement;
    const element = LinearElementEditor.getElement(elementId);
    if (!element) {
      return editingLinearElement;
    }

    const { points } = element;
    const lastPoint = points[points.length - 1];

    if (!event.altKey) {
      if (lastPoint === lastUncommittedPoint) {
        LinearElementEditor.movePoint(element, points.length - 1, "delete");
      }
      return editingLinearElement;
    }

    const newPoint = LinearElementEditor.createPointAt(
      element,
      scenePointerX,
      scenePointerY,
    );

    if (lastPoint === lastUncommittedPoint) {
      LinearElementEditor.movePoint(
        element,
        element.points.length - 1,
        newPoint,
      );
    } else {
      LinearElementEditor.movePoint(element, "new", newPoint);
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
    scenePointerX: number,
    scenePointerY: number,
  ): Point {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const [rotatedX, rotatedY] = rotate(
      scenePointerX,
      scenePointerY,
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
      points: points.map((point, _idx) => {
        return [point[0] - offsetX, point[1] - offsetY] as const;
      }),
      x: element.x + offsetX,
      y: element.y + offsetY,
    });
  }

  static movePoint(
    element: NonDeleted<ExcalidrawLinearElement>,
    pointIndex: number | "new",
    targetPosition: Point | "delete",
  ) {
    const { points } = element;

    // in case we're moving start point, instead of modifying its position
    //  which would break the invariant of it being at [0,0], we move
    //  all the other points in the opposite direction by delta to
    //  offset it. We do the same with actual element.x/y position, so
    //  this hacks are completely transparent to the user.
    let offsetX = 0;
    let offsetY = 0;

    let nextPoints: (readonly [number, number])[];
    if (targetPosition === "delete") {
      // remove point
      if (pointIndex === "new") {
        throw new Error("invalid args in movePoint");
      }
      nextPoints = points.slice();
      nextPoints.splice(pointIndex, 1);
      if (pointIndex === 0) {
        // if deleting first point, make the next to be [0,0] and recalculate
        //  positions of the rest with respect to it
        offsetX = nextPoints[0][0];
        offsetY = nextPoints[0][1];
        nextPoints = nextPoints.map((point, idx) => {
          if (idx === 0) {
            return [0, 0];
          }
          return [point[0] - offsetX, point[1] - offsetY];
        });
      }
    } else if (pointIndex === "new") {
      nextPoints = [...points, targetPosition];
    } else {
      const deltaX = targetPosition[0] - points[pointIndex][0];
      const deltaY = targetPosition[1] - points[pointIndex][1];
      nextPoints = points.map((point, idx) => {
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
    }

    const nextCoords = getElementPointsCoords(element, nextPoints);
    const prevCoords = getElementPointsCoords(element, points);
    const nextCenterX = (nextCoords[0] + nextCoords[2]) / 2;
    const nextCenterY = (nextCoords[1] + nextCoords[3]) / 2;
    const prevCenterX = (prevCoords[0] + prevCoords[2]) / 2;
    const prevCenterY = (prevCoords[1] + prevCoords[3]) / 2;
    const dX = prevCenterX - nextCenterX;
    const dY = prevCenterY - nextCenterY;
    const rotated = rotate(offsetX, offsetY, dX, dY, element.angle);

    mutateElement(element, {
      points: nextPoints,
      x: element.x + rotated[0],
      y: element.y + rotated[1],
    });
  }
}
