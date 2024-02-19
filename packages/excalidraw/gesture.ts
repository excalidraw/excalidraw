import { PointerCoords } from "./types";

export const getCenter = (pointers: Map<number, PointerCoords>) => {
  const allCoords = Array.from(pointers.values());
  return {
    x: sum(allCoords, (coords) => coords.x) / allCoords.length,
    y: sum(allCoords, (coords) => coords.y) / allCoords.length,
  };
};

export const getDistance = ([a, b]: readonly PointerCoords[]) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const sum = <T>(array: readonly T[], mapper: (item: T) => number): number =>
  array.reduce((acc, item) => acc + mapper(item), 0);
