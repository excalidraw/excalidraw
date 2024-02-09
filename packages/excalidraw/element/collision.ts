import { isPointWithinBounds } from "../math";

import { ExcalidrawElement, ExcalidrawRectangleElement } from "./types";

import { getElementBounds } from "./bounds";
import { FrameNameBounds } from "../types";
import {
  Polygon,
  GeometricShape,
  getPolygonShape,
} from "../../utils/geometry/shape";
import { isPointInShape, isPointOnShape } from "../../utils/collision";

export type HitElementArgs = {
  x: number;
  y: number;
  shape: GeometricShape;
  shouldTestInside?: boolean;
  threshold?: number;
  frameNameBound?: FrameNameBounds | null;
};

export const hitElementItselfOnly = ({
  x,
  y,
  shape,
  shouldTestInside = false,
  threshold = 10,
  frameNameBound = null,
}: HitElementArgs) => {
  let hit = shouldTestInside
    ? isPointInShape([x, y], shape)
    : isPointOnShape([x, y], shape, threshold);

  // hit test against a frame's name
  if (!hit && frameNameBound) {
    hit = isPointInShape([x, y], {
      type: "polygon",
      data: getPolygonShape(frameNameBound as ExcalidrawRectangleElement)
        .data as Polygon,
    });
  }

  return hit;
};

export const hitElementBoundingBox = (
  x: number,
  y: number,
  element: ExcalidrawElement,
) => {
  const [x1, y1, x2, y2] = getElementBounds(element);
  return isPointWithinBounds([x1, y1], [x, y], [x2, y2]);
};

export const hitElementBoundingBoxOnly = (
  hitArgs: HitElementArgs,
  element: ExcalidrawElement,
) => {
  return (
    !hitElementItselfOnly(hitArgs) &&
    hitElementBoundingBox(hitArgs.x, hitArgs.y, element)
  );
};

export const hitElementBoundText = (
  x: number,
  y: number,
  textShape: GeometricShape | null,
) => {
  return textShape && isPointInShape([x, y], textShape);
};
