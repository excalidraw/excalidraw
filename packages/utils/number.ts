import type { MakeBrand } from "../excalidraw/utility-types";

export type OrderedArray<T extends number> = T[] & MakeBrand<"orderedarray">;

/**
 * Finds the closest number in an ordered array
 */
export const findNearestNumber = <T extends number>(
  haystack: OrderedArray<T>,
  needle: number,
): T => {
  let start = 0;
  let end = haystack.length - 1;

  while (start <= end) {
    const mid = Math.floor((start + end) / 2);

    if (haystack[mid] === needle) {
      return haystack[mid];
    }

    if (haystack[mid] < needle) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  const closest =
    needle - haystack[end] <= haystack[start] - needle
      ? haystack[end]
      : haystack[start];

  return closest;
};
