import type {
  LocalPoint,
  GlobalPoint,
  Triangle,
  Vector,
  Radians,
} from "../../math";
import {
  point,
  pointRotateRads,
  pointScaleFromOrigin,
  radiansToDegrees,
  triangleIncludesPoint,
} from "../../math";
import { getCenterForBounds, type Bounds } from "./bounds";
import type { ExcalidrawBindableElement } from "./types";

export const HEADING_RIGHT = [1, 0] as Heading;
export const HEADING_DOWN = [0, 1] as Heading;
export const HEADING_LEFT = [-1, 0] as Heading;
export const HEADING_UP = [0, -1] as Heading;
export type Heading = [1, 0] | [0, 1] | [-1, 0] | [0, -1];

export const headingForDiamond = <Point extends GlobalPoint | LocalPoint>(
  a: Point,
  b: Point,
) => {
  const angle = radiansToDegrees(
    Math.atan2(b[1] - a[1], b[0] - a[0]) as Radians,
  );
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
export const headingForPointFromElement = <
  Point extends GlobalPoint | LocalPoint,
>(
  element: Readonly<ExcalidrawBindableElement>,
  aabb: Readonly<Bounds>,
  p: Readonly<LocalPoint | GlobalPoint>,
): Heading => {
  const SEARCH_CONE_MULTIPLIER = 2;

  const midPoint = getCenterForBounds(aabb);

  if (element.type === "diamond") {
    if (p[0] < element.x) {
      return HEADING_LEFT;
    } else if (p[1] < element.y) {
      return HEADING_UP;
    } else if (p[0] > element.x + element.width) {
      return HEADING_RIGHT;
    } else if (p[1] > element.y + element.height) {
      return HEADING_DOWN;
    }

    const top = pointRotateRads(
      pointScaleFromOrigin(
        point(element.x + element.width / 2, element.y),
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const right = pointRotateRads(
      pointScaleFromOrigin(
        point(element.x + element.width, element.y + element.height / 2),
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const bottom = pointRotateRads(
      pointScaleFromOrigin(
        point(element.x + element.width / 2, element.y + element.height),
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const left = pointRotateRads(
      pointScaleFromOrigin(
        point(element.x, element.y + element.height / 2),
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );

    if (triangleIncludesPoint([top, right, midPoint] as Triangle<Point>, p)) {
      return headingForDiamond(top, right);
    } else if (
      triangleIncludesPoint([right, bottom, midPoint] as Triangle<Point>, p)
    ) {
      return headingForDiamond(right, bottom);
    } else if (
      triangleIncludesPoint([bottom, left, midPoint] as Triangle<Point>, p)
    ) {
      return headingForDiamond(bottom, left);
    }

    return headingForDiamond(left, top);
  }

  const topLeft = pointScaleFromOrigin(
    point(aabb[0], aabb[1]),
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  ) as Point;
  const topRight = pointScaleFromOrigin(
    point(aabb[2], aabb[1]),
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  ) as Point;
  const bottomLeft = pointScaleFromOrigin(
    point(aabb[0], aabb[3]),
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  ) as Point;
  const bottomRight = pointScaleFromOrigin(
    point(aabb[2], aabb[3]),
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  ) as Point;

  return triangleIncludesPoint(
    [topLeft, topRight, midPoint] as Triangle<Point>,
    p,
  )
    ? HEADING_UP
    : triangleIncludesPoint(
        [topRight, bottomRight, midPoint] as Triangle<Point>,
        p,
      )
    ? HEADING_RIGHT
    : triangleIncludesPoint(
        [bottomRight, bottomLeft, midPoint] as Triangle<Point>,
        p,
      )
    ? HEADING_DOWN
    : HEADING_LEFT;
};

export const flipHeading = (h: Heading): Heading =>
  [
    h[0] === 0 ? 0 : h[0] > 0 ? -1 : 1,
    h[1] === 0 ? 0 : h[1] > 0 ? -1 : 1,
  ] as Heading;
