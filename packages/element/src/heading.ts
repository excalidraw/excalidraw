import { invariant, isDevEnv, isTestEnv } from "@excalidraw/common";

import {
  pointFrom,
  pointFromVector,
  pointRotateRads,
  pointScaleFromOrigin,
  pointsEqual,
  triangleIncludesPoint,
  vectorCross,
  vectorFromPoint,
  vectorScale,
} from "@excalidraw/math";

import type {
  LocalPoint,
  GlobalPoint,
  Triangle,
  Vector,
} from "@excalidraw/math";

import { getCenterForBounds, type Bounds } from "./bounds";

import type { ExcalidrawBindableElement } from "./types";

export const HEADING_RIGHT = [1, 0] as Heading;
export const HEADING_DOWN = [0, 1] as Heading;
export const HEADING_LEFT = [-1, 0] as Heading;
export const HEADING_UP = [0, -1] as Heading;
export type Heading = [1, 0] | [0, 1] | [-1, 0] | [0, -1];

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

const headingForPointFromDiamondElement = (
  element: Readonly<ExcalidrawBindableElement>,
  aabb: Readonly<Bounds>,
  point: Readonly<GlobalPoint>,
): Heading => {
  const midPoint = getCenterForBounds(aabb);

  if (isDevEnv() || isTestEnv()) {
    invariant(
      element.width > 0 && element.height > 0,
      "Diamond element has no width or height",
    );
    invariant(
      !pointsEqual(midPoint, point),
      "The point is too close to the element mid point to determine heading",
    );
  }

  const SHRINK = 0.95; // Rounded elements tolerance
  const top = pointFromVector(
    vectorScale(
      vectorFromPoint(
        pointRotateRads(
          pointFrom<GlobalPoint>(element.x + element.width / 2, element.y),
          midPoint,
          element.angle,
        ),
        midPoint,
      ),
      SHRINK,
    ),
    midPoint,
  );
  const right = pointFromVector(
    vectorScale(
      vectorFromPoint(
        pointRotateRads(
          pointFrom<GlobalPoint>(
            element.x + element.width,
            element.y + element.height / 2,
          ),
          midPoint,
          element.angle,
        ),
        midPoint,
      ),
      SHRINK,
    ),
    midPoint,
  );
  const bottom = pointFromVector(
    vectorScale(
      vectorFromPoint(
        pointRotateRads(
          pointFrom<GlobalPoint>(
            element.x + element.width / 2,
            element.y + element.height,
          ),
          midPoint,
          element.angle,
        ),
        midPoint,
      ),
      SHRINK,
    ),
    midPoint,
  );
  const left = pointFromVector(
    vectorScale(
      vectorFromPoint(
        pointRotateRads(
          pointFrom<GlobalPoint>(element.x, element.y + element.height / 2),
          midPoint,
          element.angle,
        ),
        midPoint,
      ),
      SHRINK,
    ),
    midPoint,
  );

  // Corners
  if (
    vectorCross(vectorFromPoint(point, top), vectorFromPoint(top, right)) <=
      0 &&
    vectorCross(vectorFromPoint(point, top), vectorFromPoint(top, left)) > 0
  ) {
    return headingForPoint(top, midPoint);
  } else if (
    vectorCross(
      vectorFromPoint(point, right),
      vectorFromPoint(right, bottom),
    ) <= 0 &&
    vectorCross(vectorFromPoint(point, right), vectorFromPoint(right, top)) > 0
  ) {
    return headingForPoint(right, midPoint);
  } else if (
    vectorCross(
      vectorFromPoint(point, bottom),
      vectorFromPoint(bottom, left),
    ) <= 0 &&
    vectorCross(
      vectorFromPoint(point, bottom),
      vectorFromPoint(bottom, right),
    ) > 0
  ) {
    return headingForPoint(bottom, midPoint);
  } else if (
    vectorCross(vectorFromPoint(point, left), vectorFromPoint(left, top)) <=
      0 &&
    vectorCross(vectorFromPoint(point, left), vectorFromPoint(left, bottom)) > 0
  ) {
    return headingForPoint(left, midPoint);
  }

  // Sides
  if (
    vectorCross(
      vectorFromPoint(point, midPoint),
      vectorFromPoint(top, midPoint),
    ) <= 0 &&
    vectorCross(
      vectorFromPoint(point, midPoint),
      vectorFromPoint(right, midPoint),
    ) > 0
  ) {
    const p = element.width > element.height ? top : right;
    return headingForPoint(p, midPoint);
  } else if (
    vectorCross(
      vectorFromPoint(point, midPoint),
      vectorFromPoint(right, midPoint),
    ) <= 0 &&
    vectorCross(
      vectorFromPoint(point, midPoint),
      vectorFromPoint(bottom, midPoint),
    ) > 0
  ) {
    const p = element.width > element.height ? bottom : right;
    return headingForPoint(p, midPoint);
  } else if (
    vectorCross(
      vectorFromPoint(point, midPoint),
      vectorFromPoint(bottom, midPoint),
    ) <= 0 &&
    vectorCross(
      vectorFromPoint(point, midPoint),
      vectorFromPoint(left, midPoint),
    ) > 0
  ) {
    const p = element.width > element.height ? bottom : left;
    return headingForPoint(p, midPoint);
  }

  const p = element.width > element.height ? top : left;
  return headingForPoint(p, midPoint);
};

// Gets the heading for the point by creating a bounding box around the rotated
// close fitting bounding box, then creating 4 search cones around the center of
// the external bbox.
export const headingForPointFromElement = <Point extends GlobalPoint>(
  element: Readonly<ExcalidrawBindableElement>,
  aabb: Readonly<Bounds>,
  p: Readonly<Point>,
): Heading => {
  const SEARCH_CONE_MULTIPLIER = 2;

  const midPoint = getCenterForBounds(aabb);

  if (element.type === "diamond") {
    return headingForPointFromDiamondElement(element, aabb, p);
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
