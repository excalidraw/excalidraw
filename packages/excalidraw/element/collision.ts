import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawRectangleElement,
} from "./types";
import { getElementBounds } from "./bounds";
import type { FrameNameBounds } from "../types";
import type { GeometricShape } from "../../utils/geometry/shape";
import { getPolygonShape } from "../../utils/geometry/shape";
import { isPointInShape, isPointOnShape } from "../../utils/collision";
import { isTransparent } from "../utils";
import {
  hasBoundTextElement,
  isIframeLikeElement,
  isImageElement,
  isTextElement,
} from "./typeChecks";
import { getBoundTextShape, isPathALoop } from "../shapes";
import type { GlobalPoint, LocalPoint, Polygon } from "../../math";
import { isPointWithinBounds, pointFrom } from "../../math";

export const shouldTestInside = (element: ExcalidrawElement) => {
  if (element.type === "arrow") {
    return false;
  }

  const isDraggableFromInside =
    !isTransparent(element.backgroundColor) ||
    hasBoundTextElement(element) ||
    isIframeLikeElement(element) ||
    isTextElement(element);

  if (element.type === "line") {
    return isDraggableFromInside && isPathALoop(element.points);
  }

  if (element.type === "freedraw") {
    return isDraggableFromInside && isPathALoop(element.points);
  }

  return isDraggableFromInside || isImageElement(element);
};

export type HitTestArgs<Point extends GlobalPoint | LocalPoint> = {
  x: number;
  y: number;
  element: ExcalidrawElement;
  shape: GeometricShape<Point>;
  threshold?: number;
  frameNameBound?: FrameNameBounds | null;
};

export const hitElementItself = <Point extends GlobalPoint | LocalPoint>({
  x,
  y,
  element,
  shape,
  threshold = 10,
  frameNameBound = null,
}: HitTestArgs<Point>) => {
  let hit = shouldTestInside(element)
    ? // Since `inShape` tests STRICTLY againt the insides of a shape
      // we would need `onShape` as well to include the "borders"
      isPointInShape(pointFrom(x, y), shape) ||
      isPointOnShape(pointFrom(x, y), shape, threshold)
    : isPointOnShape(pointFrom(x, y), shape, threshold);

  // hit test against a frame's name
  if (!hit && frameNameBound) {
    hit = isPointInShape(pointFrom(x, y), {
      type: "polygon",
      data: getPolygonShape(frameNameBound as ExcalidrawRectangleElement)
        .data as Polygon<Point>,
    });
  }

  return hit;
};

export const hitElementBoundingBox = (
  x: number,
  y: number,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  tolerance = 0,
) => {
  let [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
  x1 -= tolerance;
  y1 -= tolerance;
  x2 += tolerance;
  y2 += tolerance;
  return isPointWithinBounds(
    pointFrom(x1, y1),
    pointFrom(x, y),
    pointFrom(x2, y2),
  );
};

export const hitElementBoundingBoxOnly = <
  Point extends GlobalPoint | LocalPoint,
>(
  hitArgs: HitTestArgs<Point>,
  elementsMap: ElementsMap,
) => {
  return (
    !hitElementItself(hitArgs) &&
    // bound text is considered part of the element (even if it's outside the bounding box)
    !hitElementBoundText(
      hitArgs.x,
      hitArgs.y,
      getBoundTextShape(hitArgs.element, elementsMap),
    ) &&
    hitElementBoundingBox(hitArgs.x, hitArgs.y, hitArgs.element, elementsMap)
  );
};

export const hitElementBoundText = <Point extends GlobalPoint | LocalPoint>(
  x: number,
  y: number,
  textShape: GeometricShape<Point> | null,
): boolean => {
  return !!textShape && isPointInShape(pointFrom(x, y), textShape);
};
