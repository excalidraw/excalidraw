import { Pointer } from "./types";
import { normalizeScroll } from "./scene/data";

export function getCenter(pointers: readonly Pointer[]) {
  return {
    x: normalizeScroll(sum(pointers, pointer => pointer.x) / pointers.length),
    y: normalizeScroll(sum(pointers, pointer => pointer.y) / pointers.length),
  };
}

export function getDistance([a, b]: readonly Pointer[]) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sum<T>(array: readonly T[], mapper: (item: T) => number): number {
  return array.reduce((acc, item) => acc + mapper(item), 0);
}
