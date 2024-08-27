// Given two ranges, return if the two ranges overlap with each other
// e.g. [1, 3] overlaps with [2, 4] while [1, 3] does not overlap with [4, 5]
export const rangesOverlap = (
  [a0, a1]: [number, number],
  [b0, b1]: [number, number],
) => {
  if (a0 <= b0) {
    return a1 >= b0;
  }

  if (a0 >= b0) {
    return b1 >= a0;
  }

  return false;
};

// Given two ranges,return ther intersection of the two ranges if any
// e.g. the intersection of [1, 3] and [2, 4] is [2, 3]
export const rangeIntersection = (
  rangeA: [number, number],
  rangeB: [number, number],
): [number, number] | null => {
  const rangeStart = Math.max(rangeA[0], rangeB[0]);
  const rangeEnd = Math.min(rangeA[1], rangeB[1]);

  if (rangeStart <= rangeEnd) {
    return [rangeStart, rangeEnd];
  }

  return null;
};

export const isValueInRange = (value: number, min: number, max: number) => {
  return value >= min && value <= max;
};
