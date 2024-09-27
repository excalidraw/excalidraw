import type { GlobalPoint, Segment } from "../../math";
import {
  arc,
  arcDistanceFromPoint,
  ellipse,
  ellipseDistanceFromPoint,
  ellipseSegmentInterceptPoints,
  point,
  pointRotateRads,
  radians,
  rectangle,
  segment,
  segmentDistanceToPoint,
} from "../../math";
import { getCornerRadius } from "../shapes";
import type {
  ExcalidrawBindableElement,
  ExcalidrawDiamondElement,
  ExcalidrawEllipseElement,
  ExcalidrawRectanguloidElement,
} from "./types";

export const distanceToBindableElement = (
  element: ExcalidrawBindableElement,
  point: GlobalPoint,
): number => {
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return distanceToRectangleElement(element, point);
    case "diamond":
      return distanceToDiamondElement(element, point);
    case "ellipse":
      return distanceToEllipseElement(element, point);
  }
};

/**
 * Returns the distance of a point and the provided rectangular-shaped element,
 * accounting for roundness and rotation
 *
 * @param element The rectanguloid element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the rectanguloid element
 */
export const distanceToRectangleElement = (
  element: ExcalidrawRectanguloidElement,
  p: GlobalPoint,
) => {
  const r = rectangle(
    point(element.x, element.y),
    point(element.x + element.width, element.y + element.height),
  );
  // To emulate a rotated rectangle we rotate the point in the inverse angle
  // instead. It's all the same distance-wise.
  const rotatedPoint = pointRotateRads(
    p,
    point(element.x + element.width / 2, element.y + element.height / 2),
    radians(-element.angle),
  );
  const roundness = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );
  const sideDistances = [
    segment(
      point(r[0][0] + roundness, r[0][1]),
      point(r[1][0] - roundness, r[0][1]),
    ),
    segment(
      point(r[1][0], r[0][1] + roundness),
      point(r[1][0], r[1][1] - roundness),
    ),
    segment(
      point(r[1][0] - roundness, r[1][1]),
      point(r[0][0] + roundness, r[1][1]),
    ),
    segment(
      point(r[0][0], r[1][1] - roundness),
      point(r[0][0], r[0][1] + roundness),
    ),
  ].map((s) => segmentDistanceToPoint(rotatedPoint, s));
  const cornerDistances =
    roundness > 0
      ? [
          arc(
            point(r[0][0] + roundness, r[0][1] + roundness),
            roundness,
            radians(Math.PI),
            radians((3 / 4) * Math.PI),
          ),
          arc(
            point(r[1][0] - roundness, r[0][1] + roundness),
            roundness,
            radians((3 / 4) * Math.PI),
            radians(0),
          ),
          arc(
            point(r[1][0] - roundness, r[1][1] - roundness),
            roundness,
            radians(0),
            radians((1 / 2) * Math.PI),
          ),
          arc(
            point(r[0][0] + roundness, r[1][1] - roundness),
            roundness,
            radians((1 / 2) * Math.PI),
            radians(Math.PI),
          ),
        ].map((a) => arcDistanceFromPoint(a, rotatedPoint))
      : [];

  return Math.min(...[...sideDistances, ...cornerDistances]);
};

/**
 * Shortens a segment on both ends to accomodate the arc in the rounded
 * diamond shape
 *
 * @param s The segment to shorten
 * @param r The radius to shorten by
 * @returns The segment shortened on both ends by the same radius
 */
const createDiamondSide = (
  s: Segment<GlobalPoint>,
  r: number,
): Segment<GlobalPoint> => {
  if (r === 0) {
    return s;
  }

  const t = (4 * r) / Math.sqrt(2);

  return segment(
    ellipseSegmentInterceptPoints(ellipse(s[0], t, t), s)[0],
    ellipseSegmentInterceptPoints(ellipse(s[1], t, t), s)[0],
  );
};

/**
 * Creates an arc for the given roundness and position by taking the start
 * and end positions and determining the angle points on the hypotethical
 * circle with center point between start and end and raidus equals provided
 * roundness. I.e. the created arc is gobal point-aware, or "rotated" in-place.
 *
 * @param start
 * @param end
 * @param r
 * @returns
 */
const createDiamondArc = (start: GlobalPoint, end: GlobalPoint, r: number) => {
  const c = point((start[0] + end[0]) / 2, start[1]);

  return arc(
    c,
    r,
    radians(Math.asin((start[1] - c[1]) / r)),
    radians(Math.asin((end[1] - c[1]) / r)),
  );
};

/**
 * Returns the distance of a point and the provided diamond element, accounting
 * for roundness and rotation
 *
 * @param element The diamond element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the diamond
 */
export const distanceToDiamondElement = (
  element: ExcalidrawDiamondElement,
  p: GlobalPoint,
): number => {
  const center = point<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  const roundness = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );
  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedPoint = pointRotateRads(p, center, radians(-element.angle));
  const [top, right, bottom, left]: GlobalPoint[] = [
    point(element.x + element.width / 2, element.y),
    point(element.x + element.width, element.y + element.height / 2),
    point(element.x + element.width / 2, element.y + element.height),
    point(element.x, element.y + element.height / 2),
  ];
  const topRight = createDiamondSide(segment(top, right), roundness);
  const bottomRight = createDiamondSide(segment(right, bottom), roundness);
  const bottomLeft = createDiamondSide(segment(bottom, left), roundness);
  const topLeft = createDiamondSide(segment(left, top), roundness);

  return Math.min(
    ...[
      ...[topRight, bottomRight, bottomLeft, topLeft].map((s) =>
        segmentDistanceToPoint(rotatedPoint, s),
      ),
      ...(roundness > 0
        ? [
            createDiamondArc(topLeft[1], topRight[0], roundness),
            createDiamondArc(topRight[1], bottomRight[0], roundness),
            createDiamondArc(bottomRight[1], bottomLeft[0], roundness),
            createDiamondArc(bottomLeft[1], topLeft[0], roundness),
          ].map((a) => arcDistanceFromPoint(a, rotatedPoint))
        : []),
    ],
  );
};

/**
 * Returns the distance of a point and the provided ellipse element, accounting
 * for roundness and rotation
 *
 * @param element The ellipse element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the ellipse
 */
export const distanceToEllipseElement = (
  element: ExcalidrawEllipseElement,
  p: GlobalPoint,
): number => {
  const center = point(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  return ellipseDistanceFromPoint(
    // Instead of rotating the ellipse, rotate the point to the inverse angle
    pointRotateRads(p, center, radians(-element.angle)),
    ellipse(center, element.width / 2, element.height / 2),
  );
};
