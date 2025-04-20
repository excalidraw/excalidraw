import { pointFrom, type GenericPoint } from "@excalidraw/math";

export const getCenter = <Point extends GenericPoint>(
  pointers: Map<number, Point>,
): Point => {
  const allCoords = Array.from(pointers.values());
  return pointFrom(
    sum(allCoords, ([coordsX, _]) => coordsX) / allCoords.length,
    sum(allCoords, ([_, coordsY]) => coordsY) / allCoords.length,
  );
};

export const isTwoPointerCoords = <Point extends GenericPoint>(
  arr: Point[],
): arr is [Point, Point] => {
  return arr.length === 2;
};

export const getDistance = <Point extends GenericPoint>([
  [x1, y1],
  [x2, y2],
]: readonly [Point, Point]) => Math.hypot(x1 - x2, y1 - y2);

const sum = <T>(array: readonly T[], mapper: (item: T) => number): number =>
  array.reduce((acc, item) => acc + mapper(item), 0);
