import { isArrowElement, isElbowArrow } from "./typeChecks";

import type { Drawable, Options } from "roughjs/bin/core";
import type { Point as RoughPoint } from "roughjs/bin/geometry";
import type { RoughGenerator } from "roughjs/bin/generator";
import type { ExcalidrawArrowElement, ExcalidrawElement } from "./types";

/**
 * Split points break a curved simple arrow into several independent curves.
 * The arrow still has a single, continuous `points` array and the split index
 * simply marks the point where one curve ends and the next one begins, which
 * renders as a sharp transition instead of a smooth one.
 *
 * Only interior points (i.e. neither the first nor the last one) can be split,
 * and only on curved, non-elbow arrows.
 */

export const canSplitPoints = <T extends ExcalidrawElement>(
  element: T,
): element is T & ExcalidrawArrowElement =>
  isArrowElement(element) && !isElbowArrow(element) && !!element.roundness;

export const isValidSplitPointIndex = (
  element: ExcalidrawArrowElement,
  index: number,
) => Number.isInteger(index) && index > 0 && index < element.points.length - 1;

export const getSplitPoints = (
  element: ExcalidrawElement,
): readonly number[] => {
  if (!canSplitPoints(element) || !element.splitPoints?.length) {
    return [];
  }

  return element.splitPoints.filter((index) =>
    isValidSplitPointIndex(element, index),
  );
};

export const isSplitPoint = (element: ExcalidrawElement, index: number) =>
  getSplitPoints(element).includes(index);

const normalizeSplitPoints = (
  indices: readonly number[],
): readonly number[] | null => {
  const normalized = Array.from(new Set(indices)).sort((a, b) => a - b);

  return normalized.length ? normalized : null;
};

/**
 * Returns the next `splitPoints` value with `index` toggled, or `undefined` if
 * the point cannot be split (so the caller can skip the mutation).
 */
export const toggleSplitPoint = (
  element: ExcalidrawArrowElement,
  index: number,
): ExcalidrawArrowElement["splitPoints"] | undefined => {
  if (!canSplitPoints(element) || !isValidSplitPointIndex(element, index)) {
    return undefined;
  }

  const current = getSplitPoints(element);

  return normalizeSplitPoints(
    current.includes(index)
      ? current.filter((idx) => idx !== index)
      : [...current, index],
  );
};

/**
 * Keeps split indices pointing at the same points after `count` points have
 * been inserted at `insertIndex`.
 */
export const shiftSplitPointsOnInsert = (
  element: ExcalidrawElement,
  insertIndex: number,
  count = 1,
): ExcalidrawArrowElement["splitPoints"] | undefined => {
  const current = getSplitPoints(element);

  if (!current.length) {
    return undefined;
  }

  return normalizeSplitPoints(
    current.map((index) => (index >= insertIndex ? index + count : index)),
  );
};

/**
 * Keeps split indices pointing at the same points after a copy of each point in
 * `duplicatedIndices` has been inserted directly after it (as `Cmd+D` does in
 * the line editor). A split on a duplicated point stays on the original.
 */
export const shiftSplitPointsOnDuplicate = (
  element: ExcalidrawElement,
  duplicatedIndices: readonly number[],
): ExcalidrawArrowElement["splitPoints"] | undefined => {
  const current = getSplitPoints(element);

  if (!current.length || !duplicatedIndices.length) {
    return undefined;
  }

  const duplicated = new Set(duplicatedIndices);

  return normalizeSplitPoints(
    current.map(
      (index) =>
        index +
        Array.from(duplicated).filter((dupIndex) => dupIndex < index).length,
    ),
  );
};

/**
 * Keeps split indices pointing at the same points after the points at
 * `deletedIndices` have been removed. Splits on deleted points are dropped.
 */
export const shiftSplitPointsOnDelete = (
  element: ExcalidrawElement,
  deletedIndices: readonly number[],
): ExcalidrawArrowElement["splitPoints"] | undefined => {
  const current = getSplitPoints(element);

  if (!current.length) {
    return undefined;
  }

  const deleted = new Set(deletedIndices);
  const nextLastIndex =
    (element as ExcalidrawArrowElement).points.length - deleted.size - 1;

  return normalizeSplitPoints(
    current
      .filter((index) => !deleted.has(index))
      .map(
        (index) =>
          index - deletedIndices.filter((deleted) => deleted < index).length,
      )
      .filter((index) => index > 0 && index < nextLastIndex),
  );
};

/**
 * Splits `points` into overlapping groups — the split point is both the last
 * point of the preceding group and the first point of the following one, so
 * the resulting curves meet exactly at that point.
 */
export const getSplitPointGroups = <P>(
  points: readonly P[],
  splitPoints: readonly number[],
): readonly (readonly P[])[] => {
  if (!splitPoints.length || points.length < 3) {
    return [points];
  }

  const groups: P[][] = [];
  let start = 0;

  for (const index of splitPoints) {
    if (index <= start || index >= points.length - 1) {
      continue;
    }

    groups.push(points.slice(start, index + 1));
    start = index;
  }

  groups.push(points.slice(start));

  return groups;
};

/**
 * Generates one rough.js curve per split group and merges their ops into a
 * single drawable, so a split arrow is treated as one continuous shape for
 * both rendering and bounds computation.
 */
export const generateSplitCurves = <P extends readonly [number, number]>(
  generator: RoughGenerator,
  points: readonly P[],
  splitPoints: readonly number[],
  options: Options,
): Drawable => {
  const drawables = getSplitPointGroups(points, splitPoints).map((group) =>
    generator.curve(
      // SAFETY: point pairs are finite [x, y] numbers, exactly the shape
      // rough.js consumes; the cast only drops readonly
      group as unknown as RoughPoint[],
      options,
    ),
  );

  if (drawables.length === 1) {
    return drawables[0];
  }

  return {
    ...drawables[0],
    sets: drawables[0].sets.map((set, setIdx) => ({
      ...set,
      ops: drawables.flatMap((drawable) => drawable.sets[setIdx]?.ops ?? []),
    })),
  };
};
