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

export const distanceToRectangleElement = (
  element: ExcalidrawRectanguloidElement,
  p: GlobalPoint,
) => {
  const center = point(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  const r = rectangle(
    pointRotateRads(
      point(element.x, element.y),
      center,
      radians(element.angle),
    ),
    pointRotateRads(
      point(element.x + element.width, element.y + element.height),
      center,
      radians(element.angle),
    ),
  );
  const roundness = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );
  const rotatedPoint = pointRotateRads(p, center, element.angle);
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

const roundedCutoffSegment = (
  s: Segment<GlobalPoint>,
  r: number,
): Segment<GlobalPoint> => {
  const t = (4 * r) / Math.sqrt(2);

  return segment(
    ellipseSegmentInterceptPoints(ellipse(s[0], radians(0), t, t), s)[0],
    ellipseSegmentInterceptPoints(ellipse(s[1], radians(0), t, t), s)[0],
  );
};

const diamondArc = (left: GlobalPoint, right: GlobalPoint, r: number) => {
  const c = point((left[0] + right[0]) / 2, left[1]);

  return arc(
    c,
    r,
    radians(Math.asin((left[1] - c[1]) / r)),
    radians(Math.asin((right[1] - c[1]) / r)),
  );
};

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
  const rotatedPoint = pointRotateRads(p, center, element.angle);
  const top = pointRotateRads<GlobalPoint>(
    point(element.x + element.width / 2, element.y),
    center,
    element.angle,
  );
  const right = pointRotateRads<GlobalPoint>(
    point(element.x + element.width, element.y + element.height / 2),
    center,
    element.angle,
  );
  const bottom = pointRotateRads<GlobalPoint>(
    point(element.x + element.width / 2, element.y + element.height),
    center,
    element.angle,
  );
  const left = pointRotateRads<GlobalPoint>(
    point(element.x, element.y + element.height / 2),
    center,
    element.angle,
  );
  const topRight = roundedCutoffSegment(segment(top, right), roundness);
  const bottomRight = roundedCutoffSegment(segment(right, bottom), roundness);
  const bottomLeft = roundedCutoffSegment(segment(bottom, left), roundness);
  const topLeft = roundedCutoffSegment(segment(left, top), roundness);

  return Math.min(
    ...[
      ...[topRight, bottomRight, bottomLeft, topLeft].map((s) =>
        segmentDistanceToPoint(rotatedPoint, s),
      ),
      ...(roundness > 0
        ? [
            diamondArc(topLeft[1], topRight[0], roundness),
            diamondArc(topRight[1], bottomRight[0], roundness),
            diamondArc(bottomRight[1], bottomLeft[0], roundness),
            diamondArc(bottomLeft[1], topLeft[0], roundness),
          ].map((a) => arcDistanceFromPoint(a, rotatedPoint))
        : []),
    ],
  );
};

export const distanceToEllipseElement = (
  element: ExcalidrawEllipseElement,
  p: GlobalPoint,
): number => {
  return ellipseDistanceFromPoint(
    p,
    ellipse(
      point(element.x + element.width / 2, element.y + element.height / 2),
      element.angle,
      element.width / 2,
      element.height / 2,
    ),
  );
};
