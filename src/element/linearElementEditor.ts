import { NonDeleted, ExcalidrawLinearElement } from "./types";
import { distance2d, rotate } from "../math";
import { getElementAbsoluteCoords } from ".";
import { Point } from "../types";
import { mutateElement } from "./mutateElement";

export class LinearElementEditor {
  public element: NonDeleted<ExcalidrawLinearElement>;
  public activePointIndex: number | null;
  public lastUncommittedPoint: Point | null;

  constructor(element: LinearElementEditor["element"]) {
    LinearElementEditor.normalizePoints(element);

    this.element = element;
    this.activePointIndex = null;
    this.lastUncommittedPoint = null;
  }

  // ---------------------------------------------------------------------------
  // static methods
  // ---------------------------------------------------------------------------

  static POINT_HANDLE_SIZE = 20;

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
    x: number,
    y: number,
  ) {
    const pointHandles = this.getPointsGlobalCoordinates(element);
    return pointHandles.findIndex((point) => {
      return distance2d(x, y, point[0], point[1]) < this.POINT_HANDLE_SIZE / 2;
    });
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

    mutateElement(element, {
      points: points.map((point, idx) => {
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
      }),
      x: element.x + (pointIndex === 0 ? deltaX : 0),
      y: element.y + (pointIndex === 0 ? deltaY : 0),
    });
  }
}
