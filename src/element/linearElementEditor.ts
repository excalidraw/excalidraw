import {
  NonDeleted,
  ExcalidrawLinearElement,
  ExcalidrawElement,
} from "./types";
import { distance2d, rotate, isPathALoop, getGridPoint } from "../math";
import { getElementAbsoluteCoords } from ".";
import { getElementPointsCoords } from "./bounds";
import { Point, AppState } from "../types";
import { mutateElement } from "./mutateElement";
import { SceneHistory } from "../history";

import Scene from "../scene/Scene";

export class LinearElementEditor {
  public elementId: ExcalidrawElement["id"] & {
    _brand: "excalidrawLinearElementId";
  };
  public activePointIndex: number | null;
  /** whether you're dragging a point */
  public isDragging: boolean;
  public lastUncommittedPoint: Point | null;
  public pointerOffset: { x: number; y: number };

  constructor(element: NonDeleted<ExcalidrawLinearElement>, scene: Scene) {
    this.elementId = element.id as string & {
      _brand: "excalidrawLinearElementId";
    };
    Scene.mapElementToScene(this.elementId, scene);
    LinearElementEditor.normalizePoints(element);

    this.activePointIndex = null;
    this.lastUncommittedPoint = null;
    this.isDragging = false;
    this.pointerOffset = { x: 0, y: 0 };
  }

  // ---------------------------------------------------------------------------
  // static methods
  // ---------------------------------------------------------------------------

  static POINT_HANDLE_SIZE = 20;

  /**
   * @param id the `elementId` from the instance of this class (so that we can
   *  statically guarantee this method returns an ExcalidrawLinearElement)
   */
  static getElement(id: InstanceType<typeof LinearElementEditor>["elementId"]) {
    const element = Scene.getScene(id)?.getNonDeletedElement(id);
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
  ): boolean {
    if (!appState.editingLinearElement) {
      return false;
    }
    const { editingLinearElement } = appState;
    const { activePointIndex, elementId, isDragging } = editingLinearElement;

    const element = LinearElementEditor.getElement(elementId);
    if (!element) {
      return false;
    }

    if (activePointIndex != null && activePointIndex > -1) {
      if (isDragging === false) {
        setState({
          editingLinearElement: {
            ...editingLinearElement,
            isDragging: true,
          },
        });
      }

      const newPoint = LinearElementEditor.createPointAt(
        element,
        scenePointerX - editingLinearElement.pointerOffset.x,
        scenePointerY - editingLinearElement.pointerOffset.y,
        appState.gridSize,
      );
      LinearElementEditor.movePoint(element, activePointIndex, newPoint);
      return true;
    }
    return false;
  }

  static handlePointerUp(
    editingLinearElement: LinearElementEditor,
  ): LinearElementEditor {
    const { elementId, activePointIndex, isDragging } = editingLinearElement;
    const element = LinearElementEditor.getElement(elementId);
    if (!element) {
      return editingLinearElement;
    }

    if (
      isDragging &&
      (activePointIndex === 0 ||
        activePointIndex === element.points.length - 1) &&
      isPathALoop(element.points)
    ) {
      LinearElementEditor.movePoint(
        element,
        activePointIndex,
        activePointIndex === 0
          ? element.points[element.points.length - 1]
          : element.points[0],
      );
    }
    return {
      ...editingLinearElement,
      isDragging: false,
      pointerOffset: { x: 0, y: 0 },
    };
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
              appState.gridSize,
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

    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const targetPoint =
      clickedPointIndex > -1 &&
      rotate(
        element.x + element.points[clickedPointIndex][0],
        element.y + element.points[clickedPointIndex][1],
        cx,
        cy,
        element.angle,
      );

    setState({
      editingLinearElement: {
        ...appState.editingLinearElement,
        activePointIndex: clickedPointIndex > -1 ? clickedPointIndex : null,
        pointerOffset: targetPoint
          ? {
              x: scenePointerX - targetPoint[0],
              y: scenePointerY - targetPoint[1],
            }
          : { x: 0, y: 0 },
      },
    });
    return ret;
  }

  static handlePointerMove(
    event: React.PointerEvent<HTMLCanvasElement>,
    scenePointerX: number,
    scenePointerY: number,
    editingLinearElement: LinearElementEditor,
    gridSize: number | null,
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
      scenePointerX - editingLinearElement.pointerOffset.x,
      scenePointerY - editingLinearElement.pointerOffset.y,
      gridSize,
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
    gridSize: number | null,
  ): Point {
    const pointerOnGrid = getGridPoint(scenePointerX, scenePointerY, gridSize);
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const [rotatedX, rotatedY] = rotate(
      pointerOnGrid[0],
      pointerOnGrid[1],
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
