import { pointsOnBezierCurves } from "points-on-curve";
import { curveToBezier } from "points-on-curve/lib/curve-to-bezier.js";

import { pointFrom, pointsEqual } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { isElbowArrow, isLinearElement } from "./typeChecks";

import type { Drawable, Op, OpSet, Options } from "roughjs/bin/core";
import type { Point as RoughPoint } from "roughjs/bin/geometry";
import type { RoughGenerator } from "roughjs/bin/generator";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  SplitPoint,
} from "./types";

/**
 * Split points break a curved arrow or line into several independent curves.
 * The element still has a single, continuous `points` array and the split
 * simply marks the point where one curve ends and the next one begins,
 * which renders as a sharp transition instead of a smooth one.
 *
 * Only interior points (i.e. neither the first nor the last one) can be split,
 * and only on curved, non-elbow arrows and lines.
 *
 * A split records the marked point's local coordinates next to its index,
 * because `points` and `splitPoints` are independent properties which can be
 * updated on their own: an undo, a remote update or a restored file can bring
 * back a `points` array that a stored index was never recorded against. The
 * coordinates are what a split is anchored to — the same way an elbow arrow's
 * `fixedSegments` are anchored to their `start`/`end` coordinates — so a stale
 * index is re-anchored on read instead of silently marking another corner.
 */

const canStoreSplitPoints = <T extends ExcalidrawElement>(
  element: T,
): element is T & ExcalidrawLinearElement =>
  isLinearElement(element) && !isElbowArrow(element);

export const canSplitPoints = <T extends ExcalidrawElement>(
  element: T,
): element is T & ExcalidrawLinearElement =>
  canStoreSplitPoints(element) && !!element.roundness;

const isInteriorPointIndex = (
  points: readonly LocalPoint[],
  index: number,
): boolean => Number.isInteger(index) && index > 0 && index < points.length - 1;

export const isValidSplitPointIndex = (
  element: ExcalidrawLinearElement,
  index: number,
) => isInteriorPointIndex(element.points, index);

/**
 * The interior point of `points` sharing `point`'s coordinates and sitting
 * closest to `preferredIndex` (duplicated points can share coordinates), or
 * `-1` when the marked point is not part of `points` at all.
 */
const findAnchoredPointIndex = (
  points: readonly LocalPoint[],
  point: LocalPoint,
  preferredIndex: number,
): number => {
  let found = -1;

  for (let index = 1; index < points.length - 1; index++) {
    if (
      pointsEqual(points[index], point) &&
      (found === -1 ||
        Math.abs(index - preferredIndex) < Math.abs(found - preferredIndex))
    ) {
      found = index;
    }
  }

  return found;
};

/**
 * Resolves stored splits against `points`, which may well be a different
 * revision of the array they were recorded against.
 */
const resolveSplitPointIndices = (
  points: readonly LocalPoint[],
  splitPoints: readonly SplitPoint[],
): readonly number[] => {
  const anchored = splitPoints.map(({ point, index }) =>
    isInteriorPointIndex(points, index) && pointsEqual(points[index], point)
      ? index
      : findAnchoredPointIndex(points, point, index),
  );

  // a marked point that is nowhere to be found means the points were moved
  // (a resize, a point drag, ...) rather than reindexed, in which case the
  // stored indices are the better reference — and resolving some splits
  // against the points and the rest against the indices would pair up two
  // revisions of the element
  return anchored.includes(-1)
    ? splitPoints
        .map(({ index }) => index)
        .filter((index) => isInteriorPointIndex(points, index))
    : anchored;
};

const normalizeSplitPoints = (
  splitPoints: readonly SplitPoint[],
  pointsLength: number,
): ExcalidrawLinearElement["splitPoints"] => {
  const byIndex = new Map<number, SplitPoint>();

  for (const splitPoint of splitPoints) {
    if (
      Number.isInteger(splitPoint.index) &&
      splitPoint.index > 0 &&
      splitPoint.index < pointsLength - 1
    ) {
      byIndex.set(splitPoint.index, splitPoint);
    }
  }

  const normalized = Array.from(byIndex.values()).sort(
    (a, b) => a.index - b.index,
  );

  return normalized.length ? normalized : null;
};

/**
 * Anchors split indices on the points they mark.
 */
export const splitPointsFromIndices = (
  points: readonly LocalPoint[],
  indices: readonly number[],
): ExcalidrawLinearElement["splitPoints"] =>
  normalizeSplitPoints(
    indices
      .filter((index) => isInteriorPointIndex(points, index))
      .map((index) => ({ point: points[index], index })),
    points.length,
  );

/**
 * Splits resolved against `points` and re-anchored on the points they ended
 * up marking.
 */
const anchorSplitPointsOn = (
  points: readonly LocalPoint[],
  splitPoints: readonly SplitPoint[],
): ExcalidrawLinearElement["splitPoints"] =>
  splitPointsFromIndices(points, resolveSplitPointIndices(points, splitPoints));

/**
 * The element's splits, resolved against its current points, whether or not
 * they currently render (a sharp element keeps its splits so that turning it
 * curved again restores the same corners).
 */
const getStoredSplitPoints = (
  element: ExcalidrawElement,
): readonly SplitPoint[] =>
  canStoreSplitPoints(element) && element.splitPoints?.length
    ? anchorSplitPointsOn(element.points, element.splitPoints) ?? []
    : [];

/**
 * Split indices resolved against an explicit `points` array, for the callers
 * measuring points the element does not carry (yet).
 */
export const getSplitPointsFor = (
  element: ExcalidrawElement,
  points: readonly LocalPoint[],
): readonly number[] =>
  canSplitPoints(element) && element.splitPoints?.length
    ? (anchorSplitPointsOn(points, element.splitPoints) ?? []).map(
        ({ index }) => index,
      )
    : [];

export const getSplitPoints = (element: ExcalidrawElement): readonly number[] =>
  canSplitPoints(element) ? getSplitPointsFor(element, element.points) : [];

export const isSplitPoint = (element: ExcalidrawElement, index: number) =>
  getSplitPoints(element).includes(index);

const splitPointsEqual = (
  a: ExcalidrawLinearElement["splitPoints"],
  b: ExcalidrawLinearElement["splitPoints"],
): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    a.length === b.length &&
    a.every(
      (splitPoint, idx) =>
        splitPoint.index === b[idx].index &&
        splitPoint.point[0] === b[idx].point[0] &&
        splitPoint.point[1] === b[idx].point[1],
    ));

/**
 * Re-anchors the stored splits on `nextPoints`, or `undefined` when there is
 * nothing to re-anchor (so the caller can skip the mutation).
 *
 * Only same length updates are handled here: those move the points without
 * changing which point sits at which index (a drag, a resize, a flip, ...).
 * A caller changing the topology owns the split update itself, and anything
 * that bypasses `mutateElement` altogether — history, remote updates — is
 * caught by the anchors on read.
 */
export const reanchorSplitPoints = (
  element: ExcalidrawElement,
  nextPoints: readonly LocalPoint[],
): ExcalidrawLinearElement["splitPoints"] | undefined => {
  if (
    !canStoreSplitPoints(element) ||
    !element.splitPoints?.length ||
    nextPoints.length !== element.points.length
  ) {
    return undefined;
  }

  const next = normalizeSplitPoints(
    getStoredSplitPoints(element).map(({ index }) => ({
      point: nextPoints[index],
      index,
    })),
    nextPoints.length,
  );

  return splitPointsEqual(element.splitPoints, next) ? undefined : next;
};

/**
 * Rebuilds the splits of an untrusted element (a restored file, the
 * programmatic API), accepting both anchored splits and bare point indices.
 */
export const restoreSplitPoints = (
  points: readonly LocalPoint[],
  splitPoints: unknown,
): ExcalidrawLinearElement["splitPoints"] => {
  if (!Array.isArray(splitPoints)) {
    return null;
  }

  const anchored: SplitPoint[] = [];

  for (const splitPoint of splitPoints) {
    if (isInteriorPointIndex(points, splitPoint)) {
      anchored.push({ point: points[splitPoint], index: splitPoint });
    } else if (
      splitPoint &&
      typeof splitPoint === "object" &&
      Number.isInteger(splitPoint.index) &&
      Array.isArray(splitPoint.point) &&
      splitPoint.point.length === 2 &&
      splitPoint.point.every((coord: unknown) => Number.isFinite(coord))
    ) {
      anchored.push({
        point: pointFrom<LocalPoint>(splitPoint.point[0], splitPoint.point[1]),
        index: splitPoint.index,
      });
    }
  }

  return anchorSplitPointsOn(points, anchored);
};

/**
 * Returns the next `splitPoints` value with `index` toggled, or `undefined` if
 * the point cannot be split (so the caller can skip the mutation).
 */
export const toggleSplitPoint = (
  element: ExcalidrawLinearElement,
  index: number,
): ExcalidrawLinearElement["splitPoints"] | undefined => {
  if (!canSplitPoints(element) || !isValidSplitPointIndex(element, index)) {
    return undefined;
  }

  const current = getStoredSplitPoints(element).map(
    (splitPoint) => splitPoint.index,
  );

  return splitPointsFromIndices(
    element.points,
    current.includes(index)
      ? current.filter((idx) => idx !== index)
      : [...current, index],
  );
};

/**
 * Keeps splits on the same points after `count` points have been inserted at
 * `insertIndex`. Only the indices shift; the marked points stay where they
 * are.
 */
export const shiftSplitPointsOnInsert = (
  element: ExcalidrawElement,
  insertIndex: number,
  count = 1,
): ExcalidrawLinearElement["splitPoints"] | undefined => {
  const current = getStoredSplitPoints(element);

  if (!current.length) {
    return undefined;
  }

  return normalizeSplitPoints(
    current.map(({ point, index }) => ({
      point,
      index: index >= insertIndex ? index + count : index,
    })),
    (element as ExcalidrawLinearElement).points.length + count,
  );
};

/**
 * Keeps splits on the same points after a copy of each point in
 * `duplicatedIndices` has been inserted directly after it (as `Cmd+D` does in
 * the line editor). A split on a duplicated point stays on the original.
 */
export const shiftSplitPointsOnDuplicate = (
  element: ExcalidrawElement,
  duplicatedIndices: readonly number[],
): ExcalidrawLinearElement["splitPoints"] | undefined => {
  const current = getStoredSplitPoints(element);

  if (!current.length || !duplicatedIndices.length) {
    return undefined;
  }

  const duplicated = Array.from(new Set(duplicatedIndices));

  return normalizeSplitPoints(
    current.map(({ point, index }) => ({
      point,
      index: index + duplicated.filter((dupIndex) => dupIndex < index).length,
    })),
    (element as ExcalidrawLinearElement).points.length + duplicated.length,
  );
};

/**
 * Keeps splits on the same points after the points at `deletedIndices` have
 * been removed. Splits on deleted points are dropped.
 */
export const shiftSplitPointsOnDelete = (
  element: ExcalidrawElement,
  deletedIndices: readonly number[],
): ExcalidrawLinearElement["splitPoints"] | undefined => {
  const current = getStoredSplitPoints(element);

  if (!current.length) {
    return undefined;
  }

  const deleted = Array.from(new Set(deletedIndices));

  return normalizeSplitPoints(
    current
      .filter(({ index }) => !deleted.includes(index))
      .map(({ point, index }) => ({
        point,
        index: index - deleted.filter((delIndex) => delIndex < index).length,
      })),
    (element as ExcalidrawLinearElement).points.length - deleted.length,
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
 * rough.js' `curve()` ignores `preserveVertices` (only `line`/`linearPath`
 * and `svgPath` honor it) and instead offsets every input point — endpoints
 * included — by a random amount scaled with `roughness`. Two curves meeting
 * at a split vertex therefore each wander off that vertex independently and
 * visibly miss each other at any non-zero roughness. This snaps the start
 * and end of every stroke (rough.js draws two per curve unless multi-stroke
 * is disabled) back onto the exact boundary vertex so consecutive curves
 * touch.
 */
const snapStrokeEndpoints = (
  ops: readonly Op[],
  start: readonly [number, number] | null,
  end: readonly [number, number] | null,
): Op[] =>
  ops.map((op, i) => {
    if (op.op === "move" && start) {
      return { ...op, data: [start[0], start[1]] };
    }

    // a stroke ends on the op right before the next `move` (or on the very
    // last op); its final coordinate pair is the stroke's endpoint
    if (end && (i === ops.length - 1 || ops[i + 1].op === "move")) {
      const data = op.data.slice();

      data[data.length - 2] = end[0];
      data[data.length - 1] = end[1];

      return { ...op, data };
    }

    return op;
  });

const FILL_SHAPE_ROUGHNESS_GAIN = 0.8;

/**
 * rough.js fills a `curve()` along the curve through all of its points, so a
 * split element would keep being filled along the smooth contour it no longer
 * draws.
 */
const generateSplitSolidFillOps = <P extends readonly [number, number]>(
  generator: RoughGenerator,
  groups: readonly (readonly P[])[],
  options: Options,
): Op[] => {
  const fillOptions: Options = {
    ...options,
    // only the fill shape's outline is needed, and rough.js roughens it a
    // little more than the stroke
    fill: undefined,
    disableMultiStroke: true,
    roughness: options.roughness
      ? options.roughness +
        (options.fillShapeRoughnessGain ?? FILL_SHAPE_ROUGHNESS_GAIN)
      : 0,
  };

  return (
    groups
      .flatMap((group, groupIdx) =>
        snapStrokeEndpoints(
          generator
            // SAFETY: point pairs are finite [x, y] numbers, exactly the shape
            // rough.js consumes; the cast only drops readonly
            .curve(group as unknown as RoughPoint[], fillOptions)
            .sets.filter((set) => set.type === "path")
            .flatMap((set) => set.ops),
          groupIdx > 0 ? group[0] : null,
          groupIdx < groups.length - 1 ? group[group.length - 1] : null,
        ),
      )
      // consecutive groups touch, so they describe one continuous region —
      // dropping the `move` that starts each of them keeps it that way
      .filter((op, idx) => idx === 0 || op.op !== "move")
  );
};

const generateSplitPatternFillSet = <P extends readonly [number, number]>(
  generator: RoughGenerator,
  groups: readonly (readonly P[])[],
  options: Options,
): OpSet | undefined => {
  const roughness = options.roughness ?? 1;
  // rough.js hands its fillers a polygon approximation of the contour, sampled
  // exactly like this
  const contour = groups.flatMap((group) =>
    group.length < 3
      ? (group as unknown as RoughPoint[])
      : (pointsOnBezierCurves(
          curveToBezier(group as unknown as RoughPoint[]),
          10,
          (1 + roughness) / 2,
        ) as RoughPoint[]),
  );

  return generator
    .polygon(contour, options)
    .sets.find((set) => set.type === "fillSketch");
};

/**
 * Generates one rough.js curve per split group and collects them into a single
 * drawable, so a split element is treated as one shape for both rendering and
 * bounds computation. Each curve keeps its own stroke `OpSet`, so consumers can
 * still tell the curves apart. The ops of one curve are a self contained chain
 * of control points, and concatenating several of them yields a chain that no
 * longer parses.
 */
export const generateSplitCurves = <P extends readonly [number, number]>(
  generator: RoughGenerator,
  points: readonly P[],
  splitPoints: readonly number[],
  options: Options,
): Drawable => {
  const groups = getSplitPointGroups(points, splitPoints);
  const curve = (group: readonly P[]) =>
    generator.curve(
      // SAFETY: point pairs are finite [x, y] numbers, exactly the shape
      // rough.js consumes; the cast only drops readonly
      group as unknown as RoughPoint[],
      options,
    );
  const whole = curve(points);

  if (groups.length === 1) {
    return whole;
  }

  const isStroke = (set: OpSet) => set.type === "path";
  const strokeSets: OpSet[] = groups.map((group, groupIdx) => {
    // pin curve boundaries that fall on a split vertex onto that exact
    // vertex; the element's own endpoints (first group start, last group end)
    // keep their sketchy random offset
    const start = groupIdx > 0 ? group[0] : null;
    const end = groupIdx < groups.length - 1 ? group[group.length - 1] : null;

    return {
      type: "path",
      ops: curve(group)
        .sets.filter(isStroke)
        .flatMap((set) => snapStrokeEndpoints(set.ops, start, end)),
    };
  });

  // the per curve stroke sets take the place of the whole element's single
  // one, so they stay in the same position relative to the fill sets
  let replaced = false;

  return {
    ...whole,
    sets: whole.sets.flatMap((set) => {
      if (isStroke(set)) {
        if (replaced) {
          return [];
        }

        replaced = true;

        return strokeSets;
      }

      if (set.type === "fillPath") {
        return [
          {
            type: "fillPath",
            ops: generateSplitSolidFillOps(generator, groups, options),
          },
        ];
      }

      if (set.type === "fillSketch") {
        return [generateSplitPatternFillSet(generator, groups, options) ?? set];
      }

      return [set];
    }),
  };
};
