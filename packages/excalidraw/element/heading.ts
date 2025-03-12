import {
  pointFrom,
  pointRotateRads,
  pointScaleFromOrigin,
  radiansToDegrees,
  triangleIncludesPoint,
  vectorFromPoint,
} from "@excalidraw/math";

import type {
  LocalPoint,
  GlobalPoint,
  Triangle,
  Vector,
  Radians,
} from "@excalidraw/math";

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

export const headingForPoint = <P extends GlobalPoint | LocalPoint>(
  p: P,
  o: P,
) => vectorToHeading(vectorFromPoint<P>(p, o));

export const headingForPointIsHorizontal = <P extends GlobalPoint | LocalPoint>(
  p: P,
  o: P,
) => headingIsHorizontal(headingForPoint<P>(p, o));

export const compareHeading = (a: Heading, b: Heading) =>
  a[0] === b[0] && a[1] === b[1];

export const headingIsHorizontal = (a: Heading) =>
  compareHeading(a, HEADING_RIGHT) || compareHeading(a, HEADING_LEFT);

export const headingIsVertical = (a: Heading) => !headingIsHorizontal(a);

// Gets the heading for the point by creating a bounding box around the rotated
// close fitting bounding box, then creating 4 search cones around the center of
// the external bbox.
export const headingForPointFromElement = <
  Point extends GlobalPoint | LocalPoint,
>(
  element: Readonly<ExcalidrawBindableElement>,
  aabb: Readonly<Bounds>,
  p: Readonly<Point>,
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
        pointFrom(element.x + element.width / 2, element.y),
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const right = pointRotateRads(
      pointScaleFromOrigin(
        pointFrom(element.x + element.width, element.y + element.height / 2),
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const bottom = pointRotateRads(
      pointScaleFromOrigin(
        pointFrom(element.x + element.width / 2, element.y + element.height),
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const left = pointRotateRads(
      pointScaleFromOrigin(
        pointFrom(element.x, element.y + element.height / 2),
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );

    if (
      triangleIncludesPoint<Point>([top, right, midPoint] as Triangle<Point>, p)
    ) {
      return headingForDiamond(top, right);
    } else if (
      triangleIncludesPoint<Point>(
        [right, bottom, midPoint] as Triangle<Point>,
        p,
      )
    ) {
      return headingForDiamond(right, bottom);
    } else if (
      triangleIncludesPoint<Point>(
        [bottom, left, midPoint] as Triangle<Point>,
        p,
      )
    ) {
      return headingForDiamond(bottom, left);
    }

    return headingForDiamond(left, top);
  }

  const topLeft = pointScaleFromOrigin(
    pointFrom(aabb[0], aabb[1]),
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  ) as Point;
  const topRight = pointScaleFromOrigin(
    pointFrom(aabb[2], aabb[1]),
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  ) as Point;
  const bottomLeft = pointScaleFromOrigin(
    pointFrom(aabb[0], aabb[3]),
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  ) as Point;
  const bottomRight = pointScaleFromOrigin(
    pointFrom(aabb[2], aabb[3]),
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  ) as Point;

  return triangleIncludesPoint<Point>(
    [topLeft, topRight, midPoint] as Triangle<Point>,
    p,
  )
    ? HEADING_UP
    : triangleIncludesPoint<Point>(
        [topRight, bottomRight, midPoint] as Triangle<Point>,
        p,
      )
    ? HEADING_RIGHT
    : triangleIncludesPoint<Point>(
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
