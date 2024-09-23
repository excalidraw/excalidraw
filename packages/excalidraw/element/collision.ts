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
import { getBoundTextShape } from "../shapes";
import type { GlobalPoint, LocalPoint, Polygon } from "../../math";
import { pathIsALoop, isPointWithinBounds, point } from "../../math";
import { LINE_CONFIRM_THRESHOLD } from "../constants";

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
    return (
      isDraggableFromInside &&
      pathIsALoop(element.points, LINE_CONFIRM_THRESHOLD)
    );
  }

  if (element.type === "freedraw") {
    return (
      isDraggableFromInside &&
      pathIsALoop(element.points, LINE_CONFIRM_THRESHOLD)
    );
  }

  return isDraggableFromInside || isImageElement(element);
};

export type HitTestArgs<Point extends GlobalPoint | LocalPoint> = {
  sceneCoords: Point;
  element: ExcalidrawElement;
  shape: GeometricShape<Point>;
  threshold?: number;
  frameNameBound?: FrameNameBounds | null;
};

export const hitElementItself = ({
  sceneCoords,
  element,
  shape,
  threshold = 10,
  frameNameBound = null,
}: HitTestArgs<GlobalPoint>) => {
  let hit = shouldTestInside(element)
    ? // Since `inShape` tests STRICTLY againt the insides of a shape
      // we would need `onShape` as well to include the "borders"
      isPointInShape(sceneCoords, shape) ||
      isPointOnShape(sceneCoords, shape, threshold)
    : isPointOnShape(sceneCoords, shape, threshold);

  // hit test against a frame's name
  if (!hit && frameNameBound) {
    hit = isPointInShape(sceneCoords, {
      type: "polygon",
      data: getPolygonShape(frameNameBound as ExcalidrawRectangleElement)
        .data as Polygon<GlobalPoint>,
    });
  }

  return hit;
};

export const hitElementBoundingBox = (
  scenePointer: GlobalPoint,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  tolerance = 0,
) => {
  let [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
  x1 -= tolerance;
  y1 -= tolerance;
  x2 += tolerance;
  y2 += tolerance;
  return isPointWithinBounds(point(x1, y1), scenePointer, point(x2, y2));
};

export const hitElementBoundingBoxOnly = (
  hitArgs: HitTestArgs<GlobalPoint>,
  elementsMap: ElementsMap,
) => {
  return (
    !hitElementItself(hitArgs) &&
    // bound text is considered part of the element (even if it's outside the bounding box)
    !hitElementBoundText(
      hitArgs.sceneCoords,
      getBoundTextShape(hitArgs.element, elementsMap),
    ) &&
    hitElementBoundingBox(hitArgs.sceneCoords, hitArgs.element, elementsMap)
  );
};

export const hitElementBoundText = (
  scenePointer: GlobalPoint,
  textShape: GeometricShape<GlobalPoint> | null,
): boolean => {
  return !!textShape && isPointInShape(scenePointer, textShape);
};
