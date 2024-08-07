import { lineAngle } from "../../utils/geometry/geometry";
import type { Point, Vector } from "../../utils/geometry/shape";
import {
  getCenterForBounds,
  PointInTriangle,
  rotatePoint,
  scalePointFromOrigin,
} from "../math";
import type { Bounds } from "./bounds";
import type { ExcalidrawBindableElement } from "./types";

export const HEADING_RIGHT = [1, 0] as Heading;
export const HEADING_DOWN = [0, 1] as Heading;
export const HEADING_LEFT = [-1, 0] as Heading;
export const HEADING_UP = [0, -1] as Heading;
export type Heading = [1, 0] | [0, 1] | [-1, 0] | [0, -1];

export const headingForDiamond = (a: Point, b: Point) => {
  const angle = lineAngle([a, b]);
  if (angle >= 315 || angle < 45) {
    return HEADING_UP;
  } else if (angle >= 45 && angle < 135) {
    return HEADING_RIGHT;
  } else if (angle >= 135 && angle < 225) {
    return HEADING_DOWN;
  }
  return HEADING_LEFT;
};

export const vectorToHeading = (vec: Vector): Heading => {
  const [x, y] = vec;
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (x > absY) {
    return HEADING_RIGHT;
  } else if (x <= -absY) {
    return HEADING_LEFT;
  } else if (y > absX) {
    return HEADING_DOWN;
  }
  return HEADING_UP;
};

export const compareHeading = (a: Heading, b: Heading) =>
  a[0] === b[0] && a[1] === b[1];

// Gets the heading for the point by creating a bounding box around the rotated
// close fitting bounding box, then creating 4 search cones around the center of
// the external bbox.
export const headingForPointFromElement = (
  element: Readonly<ExcalidrawBindableElement>,
  aabb: Readonly<Bounds>,
  point: Readonly<Point>,
): Heading => {
  const SEARCH_CONE_MULTIPLIER = 2;

  const midPoint = getCenterForBounds(aabb);

  if (element.type === "diamond") {
    if (point[0] < element.x) {
      return HEADING_LEFT;
    } else if (point[1] < element.y) {
      return HEADING_UP;
    } else if (point[0] > element.x + element.width) {
      return HEADING_RIGHT;
    } else if (point[1] > element.y + element.height) {
      return HEADING_DOWN;
    }

    const top = rotatePoint(
      scalePointFromOrigin(
        [element.x + element.width / 2, element.y],
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const right = rotatePoint(
      scalePointFromOrigin(
        [element.x + element.width, element.y + element.height / 2],
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const bottom = rotatePoint(
      scalePointFromOrigin(
        [element.x + element.width / 2, element.y + element.height],
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const left = rotatePoint(
      scalePointFromOrigin(
        [element.x, element.y + element.height / 2],
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );

    if (PointInTriangle(point, top, right, midPoint)) {
      return headingForDiamond(top, right);
    } else if (PointInTriangle(point, right, bottom, midPoint)) {
      return headingForDiamond(right, bottom);
    } else if (PointInTriangle(point, bottom, left, midPoint)) {
      return headingForDiamond(bottom, left);
    }

    return headingForDiamond(left, top);
  }

  const topLeft = scalePointFromOrigin(
    [aabb[0], aabb[1]],
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  );
  const topRight = scalePointFromOrigin(
    [aabb[2], aabb[1]],
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  );
  const bottomLeft = scalePointFromOrigin(
    [aabb[0], aabb[3]],
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  );
  const bottomRight = scalePointFromOrigin(
    [aabb[2], aabb[3]],
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  );

  return PointInTriangle(point, topLeft, topRight, midPoint)
    ? HEADING_UP
    : PointInTriangle(point, topRight, bottomRight, midPoint)
    ? HEADING_RIGHT
    : PointInTriangle(point, bottomRight, bottomLeft, midPoint)
    ? HEADING_DOWN
    : HEADING_LEFT;
};
