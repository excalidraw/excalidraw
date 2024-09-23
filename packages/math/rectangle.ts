import { invariant } from "../excalidraw/utils";
import type { GenericPoint, Rectangle } from "./types";

export function rectangle<P extends GenericPoint>(
  a: P,
  b: P,
  c: P,
  d: P,
): Rectangle<P> {
  return [a, b, c, d] as Rectangle<P>;
}

export function rectangleFromQuad<P extends GenericPoint>(
  quad: [a: P, b: P, c: P, d: P],
): Rectangle<P> {
  return quad as Rectangle<P>;
}

export function rectangleFromArray<P extends GenericPoint>(
  pointArray: P[],
): Rectangle<P> {
  invariant(
    pointArray.length === 4,
    "Point array contains more or less points to create a rectangle from",
  );

  return pointArray as Rectangle<P>;
}
