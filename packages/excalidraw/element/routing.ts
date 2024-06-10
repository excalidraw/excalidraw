import type { LineSegment } from "../../utils";
import type { Vector } from "../../utils/geometry/shape";
import type { Heading } from "../math";
import {
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  PointInTriangle,
  rotatePoint,
  scalePointFromOrigin,
  translatePoint,
} from "../math";
import type Scene from "../scene/Scene";
import type { Point } from "../types";
import {
  debugClear,
  debugDrawBounds,
  debugDrawPoint,
  debugDrawSegments,
} from "../visualdebug";
import type { Bounds } from "./bounds";
import { isBindableElement } from "./typeChecks";
import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
} from "./types";

export const testElbowArrow = (arrow: ExcalidrawArrowElement, scene: Scene) => {
  debugClear();

  const elementsMap = scene.getNonDeletedElementsMap();
  const [startGlobalPoint, endGlobalPoint] = [
    translatePoint(arrow.points[0], [arrow.x, arrow.y]),
    translatePoint(arrow.points[arrow.points.length - 1], [arrow.x, arrow.y]),
  ];
  const [startElement, endElement] = [
    arrow.startBinding &&
      getBindableElementForId(arrow.startBinding.elementId, elementsMap),
    arrow.endBinding &&
      getBindableElementForId(arrow.endBinding.elementId, elementsMap),
  ];
  const [startAABB, endAABB] = [
    startElement && aabbForElement(startElement),
    endElement && aabbForElement(endElement),
  ];

  [startAABB, endAABB].forEach((aabb) => aabb && debugDrawBounds(aabb));

  const [startHeading, endHeading] = [
    startElement &&
      startAABB &&
      headingForPointOnElement(startElement, startAABB, startGlobalPoint),
    endElement &&
      endAABB &&
      headingForPointOnElement(endElement, endAABB, endGlobalPoint),
  ];

  calculateGrid(
    // @ts-ignore Already filtered for null (fixed in TS 5.4+)
    [startAABB, endAABB],
    startGlobalPoint,
    startHeading,
    endGlobalPoint,
    endHeading,
  ).forEach((point) => debugDrawPoint(point));
};

/**
 * Calculates the grid from which the node points are placed on
 * based on the axis-aligned bounding boxes.
 */
const calculateGrid = (
  aabbs: Bounds[],
  start: Point,
  startHeading: Heading | null,
  end: Point,
  endHeading: Heading | null,
) => {
  const horizontal = new Set<number>();
  const vertical = new Set<number>();

  aabbs.forEach((aabb) => {
    horizontal.add(aabb[0]);
    horizontal.add(aabb[2]);
    vertical.add(aabb[1]);
    vertical.add(aabb[3]);
  });

  // Binding points are also nodes
  if (startHeading) {
    if (startHeading === HEADING_RIGHT || startHeading === HEADING_LEFT) {
      vertical.add(start[1]);
    } else {
      horizontal.add(start[0]);
      vertical.add(start[1]);
    }
  }
  if (endHeading) {
    if (endHeading === HEADING_RIGHT || endHeading === HEADING_LEFT) {
      vertical.add(end[1]);
    } else {
      horizontal.add(end[0]);
    }
  }

  // Add halfway points as well

  const verticalSorted = Array.from(vertical).sort((a, b) => a - b);
  const horizontalSorted = Array.from(horizontal).sort((a, b) => a - b);
  for (let i = 0; i < verticalSorted.length - 1; i++) {
    const v = verticalSorted[i];
    const v2 = verticalSorted[i + 1] ?? 0;
    if (v2 - v >= 4) {
      vertical.add((v + v2) / 2);
    }
  }
  for (let i = 0; i < horizontalSorted.length - 1; i++) {
    const h = horizontalSorted[i];
    const h2 = horizontalSorted[i + 1];
    if (h2 - h >= 4) {
      horizontal.add((h + h2) / 2);
    }
  }

  const _vertical = Array.from(vertical).sort((a, b) => a - b); // TODO: Do we need sorting?

  return Array.from(horizontal)
    .sort((a, b) => a - b) // TODO: Do we need sorting?
    .flatMap((x) => _vertical.map((y) => [x, y] as Point))
    .filter(filterUnique)
    .filter(
      (point) =>
        Math.max(
          ...aabbs.map((aabb) => (pointInsideOrOnBounds(point, aabb) ? 1 : 0)),
        ) === 0,
    );
};

/**
 * Get the axis-aligned bounding box for a given element
 */
const aabbForElement = (element: ExcalidrawElement, offset?: number) => {
  const bbox = {
    minX: element.x,
    minY: element.y,
    maxX: element.x + element.width,
    maxY: element.y + element.height,
    midX: element.x + element.width / 2,
    midY: element.y + element.height / 2,
  };

  const center = [bbox.midX, bbox.midY] as Point;
  const [topLeftX, topLeftY] = rotatePoint(
    [bbox.minX, bbox.minY],
    center,
    element.angle,
  );
  const [topRightX, topRightY] = rotatePoint(
    [bbox.maxX, bbox.minY],
    center,
    element.angle,
  );
  const [bottomRightX, bottomRightY] = rotatePoint(
    [bbox.maxX, bbox.maxY],
    center,
    element.angle,
  );
  const [bottomLeftX, bottomLeftY] = rotatePoint(
    [bbox.minX, bbox.maxY],
    center,
    element.angle,
  );

  const bounds = [
    Math.min(topLeftX, topRightX, bottomRightX, bottomLeftX),
    Math.min(topLeftY, topRightY, bottomRightY, bottomLeftY),
    Math.max(topLeftX, topRightX, bottomRightX, bottomLeftX),
    Math.max(topLeftY, topRightY, bottomRightY, bottomLeftY),
  ] as Bounds;

  if (offset) {
    return [
      bounds[0] - (offset ?? 0),
      bounds[1] - (offset ?? 0),
      bounds[2] + (offset ?? 0),
      bounds[3] + (offset ?? 0),
    ] as Bounds;
  }

  return bounds;
};
// Gets the heading for the point by creating a bounding box around the rotated
// close fitting bounding box, then creating 4 search cones around the center of
// the external bbox.
const headingForPointOnElement = (
  element: ExcalidrawBindableElement,
  aabb: Bounds,
  point: Point,
): Heading | null => {
  const SEARCH_CONE_MULTIPLIER = 2;

  const midPoint = getCenterForBounds(aabb);
  const ROTATION = element.type === "diamond" ? Math.PI / 4 : 0;

  const topLeft = rotatePoint(
    scalePointFromOrigin([aabb[0], aabb[1]], midPoint, SEARCH_CONE_MULTIPLIER),
    midPoint,
    ROTATION,
  );
  const topRight = rotatePoint(
    scalePointFromOrigin([aabb[2], aabb[1]], midPoint, SEARCH_CONE_MULTIPLIER),
    midPoint,
    ROTATION,
  );
  const bottomLeft = rotatePoint(
    scalePointFromOrigin([aabb[0], aabb[3]], midPoint, SEARCH_CONE_MULTIPLIER),
    midPoint,
    ROTATION,
  );
  const bottomRight = rotatePoint(
    scalePointFromOrigin([aabb[2], aabb[3]], midPoint, SEARCH_CONE_MULTIPLIER),
    midPoint,
    ROTATION,
  );

  if (element.type === "diamond") {
    // TODO: Optimize this. No need for triangle searchlights
    return PointInTriangle(point, topLeft, topRight, midPoint)
      ? HEADING_RIGHT
      : PointInTriangle(point, topRight, bottomRight, midPoint)
      ? HEADING_RIGHT
      : PointInTriangle(point, bottomRight, bottomLeft, midPoint)
      ? HEADING_LEFT
      : HEADING_LEFT;
  }

  return PointInTriangle(point, topLeft, topRight, midPoint)
    ? HEADING_UP
    : PointInTriangle(point, topRight, bottomRight, midPoint)
    ? HEADING_RIGHT
    : PointInTriangle(point, bottomRight, bottomLeft, midPoint)
    ? HEADING_DOWN
    : HEADING_LEFT;
};

const commonAABB = (aabbs: Bounds[]): Bounds => [
  Math.min(...aabbs.map((aabb) => aabb[0])),
  Math.min(...aabbs.map((aabb) => aabb[1])),
  Math.max(...aabbs.map((aabb) => aabb[2])),
  Math.max(...aabbs.map((aabb) => aabb[3])),
];

/// UTILS

const getCenterForBounds = (bounds: Bounds): Point => [
  bounds[0] + (bounds[2] - bounds[0]) / 2,
  bounds[1] + (bounds[3] - bounds[1]) / 2,
];

const getBindableElementForId = (
  id: string,
  elementsMap: ElementsMap,
): ExcalidrawBindableElement | null => {
  const element = elementsMap.get(id);
  if (element && isBindableElement(element)) {
    return element;
  }

  return null;
};

const filterUnique = <T>(item: T, idx: number, coords: T[]) =>
  coords.indexOf(item) === idx;

const pointInsideOrOnBounds = (p: Point, bounds: Bounds): boolean =>
  p[0] >= bounds[0] &&
  p[0] <= bounds[2] &&
  p[1] >= bounds[1] &&
  p[1] <= bounds[3];
