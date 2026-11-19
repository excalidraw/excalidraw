/**
 * Elbow arrow updates: keeps an elbow arrow's points orthogonal and routed
 * around the elements it connects whenever its endpoints, bindings or fixed
 * segments change.
 *
 * Without fixed segments, an arrow is simply (re-)routed from scratch (see
 * `elbowArrowRouting.ts`). Fixed segments (segments the user moved by hand)
 * are kept in place, and only the parts of the arrow around them are adjusted.
 */

import {
  clamp,
  pointDistance,
  pointFrom,
  pointsEqual,
  vectorFromPoint,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";

import { invariant, getSizeFromPoints, isDevEnv } from "@excalidraw/common";

import {
  BASE_PADDING,
  DEDUP_THRESHOLD,
  getBindableElementForId,
  getElbowArrowData,
  getElbowArrowRoute,
} from "./elbowArrowRouting";
import {
  compareHeading,
  flipHeading,
  headingForPointIsHorizontal,
  headingIsHorizontal,
  vectorToHeading,
  headingForPoint,
} from "./heading";

import type { ElbowArrowData } from "./elbowArrowRouting";
import type { ElementUpdate } from "./mutateElement";
import type { Heading } from "./heading";
import type {
  ExcalidrawElbowArrowElement,
  FixedPointBinding,
  FixedSegment,
  NonDeletedSceneElementsMap,
} from "./types";

export { BASE_PADDING };

/** Elbow arrow coordinates are clamped to this range (in both directions) */
const MAX_POS = 1e6;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Computes the update to an elbow arrow for the given changes to its
 * endpoints, bindings or fixed segments, re-routing it as needed.
 *
 * `updates.points` may be either all of the arrow's points (with only the
 * endpoints changed) or just the new start and end points, as the points in
 * between are always routed.
 */
export const updateElbowArrowPoints = (
  arrow: Readonly<ExcalidrawElbowArrowElement>,
  elementsMap: NonDeletedSceneElementsMap,
  updates: {
    points?: readonly LocalPoint[];
    fixedSegments?: readonly FixedSegment[] | null;
    startBinding?: FixedPointBinding | null;
    endBinding?: FixedPointBinding | null;
  },
  options?: {
    isDragging?: boolean;
    isBindingEnabled?: boolean;
    isMidpointSnappingEnabled?: boolean;
  },
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  if (arrow.points.length < 2) {
    return { points: updates.points ?? arrow.points };
  }

  if (!import.meta.env.PROD) {
    assertValidUpdate(arrow, updates);
  }

  const fixedSegments = updates.fixedSegments ?? arrow.fixedSegments ?? [];

  const updatedPoints: readonly LocalPoint[] = !updates.points
    ? arrow.points
    : updates.points.length === 2
    ? // only the new endpoints are given
      arrow.points.map((p, idx) =>
        idx === 0
          ? updates.points![0]
          : idx === arrow.points.length - 1
          ? updates.points![1]
          : p,
      )
    : updates.points;
  const areUpdatedPointsValid = validateElbowPoints(updatedPoints);

  const startBinding =
    updates.startBinding !== undefined
      ? updates.startBinding
      : arrow.startBinding;
  const endBinding =
    updates.endBinding !== undefined ? updates.endBinding : arrow.endBinding;

  // During all element replacement in the scene, the bound elements may be
  // missing (or there are no elements at all), so there's nothing to route
  // around and we just need to renormalize the arrow
  // TODO (dwelle,mtolmacs): Remove this once Scene.getScene() is removed
  const isBoundElementMissing =
    (!!startBinding &&
      !getBindableElementForId(startBinding.elementId, elementsMap)) ||
    (!!endBinding &&
      !getBindableElementForId(endBinding.elementId, elementsMap));
  const updatesOnlyBindings = Object.keys(updates).every(
    (key) => key === "startBinding" || key === "endBinding",
  );
  if (
    (areUpdatedPointsValid &&
      (isBoundElementMissing || elementsMap.size === 0)) ||
    (isBoundElementMissing && updatesOnlyBindings)
  ) {
    return normalizeArrowElementUpdate(
      updatedPoints.map((p) => toGlobalPoint(arrow, p)),
      arrow.fixedSegments,
      arrow.startIsSpecial,
      arrow.endIsSpecial,
    );
  }

  ////
  // 1. Nothing changed but the arrow needs to be renormalized
  ////
  if (
    !updates.points &&
    !updates.fixedSegments &&
    !updates.startBinding &&
    !updates.endBinding
  ) {
    return handleSegmentRenormalization(arrow, elementsMap);
  }

  // Short circuit on setting the same bindings again (and nothing else, as
  // that might need re-routing even if unchanged: e.g. the same endpoints
  // after the bound elements moved) to avoid huge performance hit
  if (
    !updates.points &&
    !updates.fixedSegments &&
    updates.startBinding === arrow.startBinding &&
    updates.endBinding === arrow.endBinding &&
    areUpdatedPointsValid
  ) {
    return {};
  }

  const elbowArrowData = getElbowArrowData(
    {
      x: arrow.x,
      y: arrow.y,
      startBinding,
      endBinding,
      startArrowhead: arrow.startArrowhead,
      endArrowhead: arrow.endArrowhead,
      points: arrow.points,
    },
    elementsMap,
    updatedPoints,
    options,
  );

  ////
  // 2. No fixed segments, so the arrow is simply routed
  ////
  if (fixedSegments.length === 0) {
    return normalizeArrowElementUpdate(
      getElbowArrowRoute(arrow, elbowArrowData, elementsMap),
      null,
      null,
      null,
    );
  }

  ////
  // 3. A fixed segment was released
  ////
  if ((arrow.fixedSegments?.length ?? 0) > fixedSegments.length) {
    return handleSegmentRelease(arrow, fixedSegments, elementsMap);
  }

  ////
  // 4. A segment is being moved by hand
  ////
  if (!updates.points) {
    return handleSegmentMove(arrow, fixedSegments, elbowArrowData);
  }

  ////
  // 5. Resize: the points and fixed segments are both given, so they're
  // taken as they are
  ////
  if (updates.fixedSegments) {
    return updates;
  }

  ////
  // 6. One or more segments are fixed and endpoints are moved
  //
  // The key insights are:
  // - When segments are fixed, the arrow will keep the exact amount of segments
  // - Fixed segments are "replacements" for exactly one segment in the old arrow
  ////
  return handleEndpointDrag(
    arrow,
    updatedPoints,
    fixedSegments,
    elbowArrowData,
  );
};

/**
 * The update routing an elbow arrow again where it is, e.g. once its
 * arrowheads change, as its route makes room for them
 */
export const updateElbowArrowRoute = <T extends ExcalidrawElbowArrowElement>(
  arrow: Readonly<T>,
  elementsMap: NonDeletedSceneElementsMap,
) =>
  updateElbowArrowPoints(arrow, elementsMap, {
    points: [arrow.points[0], arrow.points[arrow.points.length - 1]],
  }) as ElementUpdate<T>;

/** Whether every segment is horizontal or vertical (within `tolerance`) */
export const validateElbowPoints = <P extends GlobalPoint | LocalPoint>(
  points: readonly P[],
  tolerance: number = DEDUP_THRESHOLD,
) =>
  points
    .slice(1)
    .every(
      (p, i) =>
        Math.abs(p[0] - points[i][0]) < tolerance ||
        Math.abs(p[1] - points[i][1]) < tolerance,
    );

const assertValidUpdate = (
  arrow: Readonly<ExcalidrawElbowArrowElement>,
  updates: Parameters<typeof updateElbowArrowPoints>[2],
) => {
  const isOrthogonal = (segment: FixedSegment) =>
    segment.start[0] === segment.end[0] || segment.start[1] === segment.end[1];

  invariant(
    !updates.points || updates.points.length >= 2,
    "Updated point array length must match the arrow point length, contain " +
      "exactly the new start and end points or not be specified at all (i.e. " +
      "you can't add new points between start and end manually to elbow arrows)",
  );

  invariant(
    !arrow.fixedSegments || arrow.fixedSegments.every(isOrthogonal),
    "Fixed segments must be either horizontal or vertical",
  );

  invariant(
    !updates.fixedSegments || updates.fixedSegments.every(isOrthogonal),
    "Updates to fixed segments must be either horizontal or vertical",
  );

  const points = updates.points ?? arrow.points;
  invariant(
    !updates.fixedSegments?.some(
      (segment) =>
        (segment.index === 1 && pointsEqual(segment.start, points[0])) ||
        (segment.index === points.length - 1 &&
          pointsEqual(segment.end, points[points.length - 1])),
    ),
    "The first and last segments cannot be fixed",
  );
};

// -----------------------------------------------------------------------------
// Fixed segment handling
// -----------------------------------------------------------------------------

/**
 * Cleans up an arrow with fixed segments: merges consecutive segments going
 * the same way, and removes ones too short to see, keeping the fixed segment
 * indices in sync. If no fixed segments are left (bar the first and last,
 * which can't stay fixed), the arrow is routed from scratch.
 */
const handleSegmentRenormalization = (
  arrow: ExcalidrawElbowArrowElement,
  elementsMap: NonDeletedSceneElementsMap,
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  if (!arrow.fixedSegments) {
    return {
      x: arrow.x,
      y: arrow.y,
      points: arrow.points,
      fixedSegments: arrow.fixedSegments,
      startIsSpecial: arrow.startIsSpecial,
      endIsSpecial: arrow.endIsSpecial,
    };
  }

  const nextFixedSegments = arrow.fixedSegments.map((segment) => ({
    ...segment,
  }));
  const unfixSegment = (index: number) => {
    const idx = nextFixedSegments.findIndex(
      (segment) => segment.index === index,
    );
    if (idx !== -1) {
      nextFixedSegments.splice(idx, 1);
    }
  };

  const points = arrow.points.map((p) => toGlobalPoint(arrow, p));

  // Merge segments going the same way as the one before them (segment `i`
  // runs from point `i - 1` to point `i`)
  const mergedPoints: GlobalPoint[] = [];
  points.forEach((p, i) => {
    if (
      i >= 2 &&
      compareHeading(
        headingForPoint(p, points[i - 1]),
        headingForPoint(points[i - 1], points[i - 2]),
      )
    ) {
      // A fixed segment absorbs the previous segment, so it starts where
      // that one did, and the previous one can't stay fixed on its own
      const segment = nextFixedSegments.find((segment) => segment.index === i);
      if (segment) {
        segment.start = toLocalPoint(arrow, points[i - 2]);
      }
      unfixSegment(i - 1);

      // Drop the point between them
      mergedPoints.pop();
      shiftFixedSegmentIndices(nextFixedSegments, i - 1, -1);
    }

    mergedPoints.push(p);
  });

  // Remove segments too short to see, along with the one after them,
  // joining the ones before and after that
  const nextPoints: GlobalPoint[] = [];
  mergedPoints.forEach((p, i) => {
    if (
      i >= 3 &&
      pointDistance(mergedPoints[i - 2], mergedPoints[i - 1]) < DEDUP_THRESHOLD
    ) {
      unfixSegment(i - 1);
      unfixSegment(i - 2);
      nextPoints.splice(-2, 2);
      shiftFixedSegmentIndices(nextFixedSegments, i - 2, -2);

      // Align the point with the one before the removed segments
      const isHorizontal = headingForPointIsHorizontal(p, mergedPoints[i - 1]);
      nextPoints.push(
        pointFrom<GlobalPoint>(
          isHorizontal ? p[0] : mergedPoints[i - 2][0],
          isHorizontal ? mergedPoints[i - 2][1] : p[1],
        ),
      );
      return;
    }

    nextPoints.push(p);
  });

  // The first and last segments can't be fixed
  const filteredNextFixedSegments = nextFixedSegments.filter(
    (segment) => segment.index !== 1 && segment.index !== nextPoints.length - 1,
  );
  if (filteredNextFixedSegments.length === 0) {
    return normalizeArrowElementUpdate(
      getElbowArrowRoute(
        arrow,
        getElbowArrowData(
          arrow,
          elementsMap,
          nextPoints.map((p) => toLocalPoint(arrow, p)),
        ),
        elementsMap,
      ),
      filteredNextFixedSegments,
      null,
      null,
    );
  }

  isDevEnv() &&
    invariant(
      validateElbowPoints(nextPoints),
      "Invalid elbow points with fixed segments",
    );

  return normalizeArrowElementUpdate(
    nextPoints,
    filteredNextFixedSegments,
    arrow.startIsSpecial,
    arrow.endIsSpecial,
  );
};

/**
 * A fixed segment was released (removed from `fixedSegments`): re-routes the
 * part of the arrow between the fixed segments on either side of it (or the
 * arrow's ends), and keeps the rest of the arrow as it is.
 */
const handleSegmentRelease = (
  arrow: ExcalidrawElbowArrowElement,
  fixedSegments: readonly FixedSegment[],
  elementsMap: NonDeletedSceneElementsMap,
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  const oldFixedSegments = arrow.fixedSegments ?? [];
  const newFixedSegmentIndices = fixedSegments.map((segment) => segment.index);
  const releasedIdx = oldFixedSegments.findIndex(
    (segment) => !newFixedSegmentIndices.includes(segment.index),
  );
  const releasedSegment = oldFixedSegments[releasedIdx];
  if (!releasedSegment) {
    return { points: arrow.points };
  }

  const prevSegment = oldFixedSegments[releasedIdx - 1];
  const nextSegment = oldFixedSegments[releasedIdx + 1];

  // Route a sub-arrow from the end of the previous fixed segment (or the
  // arrow's start) to the start of the next one (or the arrow's end), bound
  // only where the arrow itself is
  const x = arrow.x + (prevSegment ? prevSegment.end[0] : 0);
  const y = arrow.y + (prevSegment ? prevSegment.end[1] : 0);
  const subArrowEnd =
    nextSegment?.start ?? arrow.points[arrow.points.length - 1];
  const elbowArrowData = getElbowArrowData(
    {
      x,
      y,
      startBinding: prevSegment ? null : arrow.startBinding,
      endBinding: nextSegment ? null : arrow.endBinding,
      startArrowhead: null,
      endArrowhead: null,
      points: arrow.points,
    },
    elementsMap,
    [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(
        arrow.x + subArrowEnd[0] - x,
        arrow.y + subArrowEnd[1] - y,
      ),
    ],
    { isDragging: false },
  );

  const { points: restoredPoints } = normalizeArrowElementUpdate(
    getElbowArrowRoute(arrow, elbowArrowData, elementsMap),
    fixedSegments,
    null,
    null,
  );

  if (!restoredPoints || restoredPoints.length < 2) {
    throw new Error(
      "Property 'points' is required in the update returned by normalizeArrowElementUpdate()",
    );
  }

  // The old points before the previous and after the next fixed segment,
  // with the re-routed points between them
  const nextPoints: GlobalPoint[] = [
    ...(prevSegment ? arrow.points.slice(0, prevSegment.index) : []).map((p) =>
      toGlobalPoint(arrow, p),
    ),
    ...restoredPoints.map((p) => pointFrom<GlobalPoint>(x + p[0], y + p[1])),
    ...(nextSegment ? arrow.points.slice(nextSegment.index) : []).map((p) =>
      toGlobalPoint(arrow, p),
    ),
  ];

  // The fixed segments after the re-routed part move by however many
  // segments were replaced, less the ones replacing them
  const replacedSegmentCount =
    (nextSegment?.index ?? arrow.points.length) - (prevSegment?.index ?? 0) - 1;
  const nextFixedSegments = fixedSegments.map((segment) => ({
    ...segment,
    index:
      segment.index > releasedSegment.index
        ? segment.index - replacedSegmentCount + (restoredPoints.length - 1)
        : segment.index,
  }));

  // Where the old and the re-routed points meet, merge segments going the
  // same way, and split U-turns with a zero length segment
  const simplifiedPoints = nextPoints.flatMap((p, i) => {
    const prev = nextPoints[i - 1];
    const next = nextPoints[i + 1];

    if (prev && next) {
      const prevHeading = headingForPoint(p, prev);
      const nextHeading = headingForPoint(next, p);

      if (compareHeading(prevHeading, nextHeading)) {
        shiftFixedSegmentIndices(nextFixedSegments, i, -1);
        return [];
      } else if (compareHeading(prevHeading, flipHeading(nextHeading))) {
        shiftFixedSegmentIndices(nextFixedSegments, i, 1);
        return [p, p];
      }
    }

    return [p];
  });

  return normalizeArrowElementUpdate(
    simplifiedPoints,
    nextFixedSegments,
    false,
    false,
  );
};

/**
 * A segment is being moved by hand: moves its points, stretches the segments
 * next to it to stay connected, and, if it's the first or last segment,
 * adds a segment to keep it connected to the arrow's start or end.
 */
const handleSegmentMove = (
  arrow: ExcalidrawElbowArrowElement,
  fixedSegments: readonly FixedSegment[],
  {
    startHeading,
    endHeading,
    hoveredStartElement,
    hoveredEndElement,
  }: ElbowArrowData,
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  const movedSegmentIdx = fixedSegments.findIndex((segment, i) => {
    const oldSegment = arrow.fixedSegments?.[i];
    if (!oldSegment || oldSegment.index !== segment.index) {
      return true;
    }

    const movedX =
      segment.start[0] !== oldSegment.start[0] &&
      segment.end[0] !== oldSegment.end[0];
    const movedY =
      segment.start[1] !== oldSegment.start[1] &&
      segment.end[1] !== oldSegment.end[1];

    return movedX !== movedY;
  });
  if (movedSegmentIdx === -1) {
    return { points: arrow.points };
  }

  const isFirstSegmentFixed =
    arrow.fixedSegments?.some((segment) => segment.index === 1) ?? false;
  const isLastSegmentFixed =
    arrow.fixedSegments?.some(
      (segment) => segment.index === arrow.points.length - 1,
    ) ?? false;

  // When moving the first (or last) segment of a bound arrow, leave room for
  // the segment that will connect it to the element, by the padding, or half
  // the moved segment if it's too short for that
  let { start: movedStart, end: movedEnd } = fixedSegments[movedSegmentIdx];
  const movedIndex = fixedSegments[movedSegmentIdx].index;
  const segmentLength = pointDistance(movedStart, movedEnd);
  const connectionLength =
    segmentLength < BASE_PADDING + 5 ? segmentLength / 2 : BASE_PADDING;
  if (!isFirstSegmentFixed && movedIndex === 1 && hoveredStartElement) {
    movedStart = translateAlongHeading(
      movedStart,
      startHeading,
      connectionLength,
    );
  }
  if (
    !isLastSegmentFixed &&
    movedIndex === arrow.points.length - 1 &&
    hoveredEndElement
  ) {
    movedEnd = translateAlongHeading(movedEnd, endHeading, connectionLength);
  }

  // In global coordinates
  const nextFixedSegments = fixedSegments.map((segment, i) => ({
    ...segment,
    start: toGlobalPoint(
      arrow,
      i === movedSegmentIdx ? movedStart : segment.start,
    ),
    end: toGlobalPoint(arrow, i === movedSegmentIdx ? movedEnd : segment.end),
  }));
  const movedSegment = nextFixedSegments[movedSegmentIdx];

  const newPoints = arrow.points.map((p) => toGlobalPoint(arrow, p));
  const { start, end } = movedSegment;
  const startIdx = movedSegment.index - 1;
  const endIdx = movedSegment.index;

  // The segments before and after the moved one (unless zero length) stretch
  // to stay connected to it
  const prevPoint = newPoints[startIdx - 1];
  const prevSegmentIsHorizontal =
    prevPoint && !pointsEqual(newPoints[startIdx], prevPoint)
      ? headingForPointIsHorizontal(prevPoint, newPoints[startIdx])
      : undefined;
  const nextPoint = newPoints[endIdx + 1];
  const nextSegmentIsHorizontal =
    nextPoint && !pointsEqual(newPoints[endIdx], nextPoint)
      ? headingForPointIsHorizontal(nextPoint, newPoints[endIdx])
      : undefined;

  if (prevSegmentIsHorizontal !== undefined) {
    newPoints[startIdx - 1] = alignPoint(
      prevPoint,
      start,
      prevSegmentIsHorizontal,
    );
  }
  newPoints[startIdx] = start;
  newPoints[endIdx] = end;
  if (nextSegmentIsHorizontal !== undefined) {
    newPoints[endIdx + 1] = alignPoint(nextPoint, end, nextSegmentIsHorizontal);
  }

  // Likewise for neighboring fixed segments
  const prevFixedSegment = nextFixedSegments.find(
    (segment) => segment.index === startIdx,
  );
  if (prevFixedSegment) {
    prevFixedSegment.start = alignPoint(
      prevFixedSegment.start,
      start,
      headingForPointIsHorizontal(prevFixedSegment.end, prevFixedSegment.start),
    );
    prevFixedSegment.end = start;
  }
  const nextFixedSegment = nextFixedSegments.find(
    (segment) => segment.index === endIdx + 1,
  );
  if (nextFixedSegment) {
    nextFixedSegment.end = alignPoint(
      nextFixedSegment.end,
      end,
      headingForPointIsHorizontal(nextFixedSegment.end, nextFixedSegment.start),
    );
    nextFixedSegment.start = end;
  }

  // Moving the first segment needs an additional segment (two, if bound) to
  // connect it to the arrow's start
  if (!isFirstSegmentFixed && startIdx === 0) {
    const arrowStart = toGlobalPoint(arrow, arrow.points[0]);
    const startIsHorizontal = hoveredStartElement
      ? headingIsHorizontal(startHeading)
      : headingForPointIsHorizontal(newPoints[1], newPoints[0]);
    newPoints.unshift(alignPoint(start, arrowStart, startIsHorizontal));
    if (hoveredStartElement) {
      newPoints.unshift(arrowStart);
    }

    shiftFixedSegmentIndices(
      nextFixedSegments,
      -Infinity,
      hoveredStartElement ? 2 : 1,
    );
  }

  // Likewise, moving the last segment needs an additional segment
  if (!isLastSegmentFixed && endIdx === arrow.points.length - 1) {
    const arrowEnd = toGlobalPoint(
      arrow,
      arrow.points[arrow.points.length - 1],
    );
    newPoints.push(alignPoint(end, arrowEnd, headingIsHorizontal(endHeading)));
    if (hoveredEndElement) {
      newPoints.push(arrowEnd);
    }
  }

  return normalizeArrowElementUpdate(
    newPoints,
    nextFixedSegments.map((segment) => ({
      ...segment,
      start: toLocalPoint(arrow, segment.start),
      end: toLocalPoint(arrow, segment.end),
    })),
    false, // If you move a segment, there is no special point anymore
    false, // If you move a segment, there is no special point anymore
  );
};

/**
 * The endpoints of an arrow with fixed segments are dragged: keeps all the
 * points in between as they are, and reconnects the endpoints to them.
 */
const handleEndpointDrag = (
  arrow: ExcalidrawElbowArrowElement,
  updatedPoints: readonly LocalPoint[],
  fixedSegments: readonly FixedSegment[],
  {
    startHeading,
    endHeading,
    startGlobalPoint,
    endGlobalPoint,
    hoveredStartElement,
    hoveredEndElement,
  }: ElbowArrowData,
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  let startIsSpecial = arrow.startIsSpecial ?? null;
  let endIsSpecial = arrow.endIsSpecial ?? null;

  // The old points, with the new endpoints
  const globalUpdatedPoints = updatedPoints.map((p, i) =>
    toGlobalPoint(
      arrow,
      i === 0 || i === updatedPoints.length - 1 ? p : arrow.points[i],
    ),
  );

  // The fixed segments keep their indices (and are aligned to the new points
  // at the end), unless the endpoints' connections change their number
  let nextFixedSegmentIndices = fixedSegments.map((segment) => segment.index);

  // The points after the start's connection and before the end's (the
  // second and second to last points, or the third and third to last when
  // the endpoint is special) stay as they are
  const startOffset = startIsSpecial ? 3 : 2;
  const endOffset = endIsSpecial ? 3 : 2;
  const innerPoints = globalUpdatedPoints.slice(
    startOffset,
    Math.max(startOffset, globalUpdatedPoints.length - endOffset),
  );

  const secondPoint = globalUpdatedPoints.at(startIsSpecial ? 2 : 1);
  const thirdPoint = globalUpdatedPoints.at(startIsSpecial ? 3 : 2);
  if (!secondPoint || !thirdPoint) {
    throw new Error(
      `Second and third points must exist when handling endpoint drag (${startIsSpecial})`,
    );
  }
  const startConnection = connectEndpoint(
    startGlobalPoint,
    startHeading,
    !!hoveredStartElement,
    secondPoint,
    thirdPoint,
    headingIsHorizontal(
      vectorToHeading(vectorFromPoint(secondPoint, thirdPoint)),
    ),
  );
  if (startConnection.isSpecial !== !!startIsSpecial) {
    startIsSpecial = startConnection.isSpecial;
    nextFixedSegmentIndices = nextFixedSegmentIndices.map((index) =>
      index > 1 ? index + (startConnection.isSpecial ? 1 : -1) : index,
    );
  }

  const secondToLastPoint = globalUpdatedPoints.at(
    globalUpdatedPoints.length - (endIsSpecial ? 3 : 2),
  );
  const thirdToLastPoint = globalUpdatedPoints.at(
    globalUpdatedPoints.length - (endIsSpecial ? 4 : 3),
  );
  if (!secondToLastPoint || !thirdToLastPoint) {
    throw new Error(
      `Second and third to last points must exist when handling endpoint drag (${endIsSpecial})`,
    );
  }
  const endConnection = connectEndpoint(
    endGlobalPoint,
    endHeading,
    !!hoveredEndElement,
    secondToLastPoint,
    thirdToLastPoint,
    headingForPointIsHorizontal(thirdToLastPoint, secondToLastPoint),
  );
  if (endConnection.isSpecial !== !!endIsSpecial) {
    endIsSpecial = endConnection.isSpecial;
  }

  const newPoints: GlobalPoint[] = [
    startGlobalPoint,
    ...startConnection.points,
    ...innerPoints,
    ...endConnection.points.reverse(),
    endGlobalPoint,
  ];
  const toLocal = (p: GlobalPoint) =>
    pointFrom<LocalPoint>(
      p[0] - startGlobalPoint[0],
      p[1] - startGlobalPoint[1],
    );

  return normalizeArrowElementUpdate(
    newPoints,
    nextFixedSegmentIndices.map((index) => ({
      index,
      start: toLocal(newPoints[index - 1]),
      end: toLocal(newPoints[index]),
    })),
    startIsSpecial,
    endIsSpecial,
  );
};

/**
 * The points connecting a dragged endpoint to the arrow's unchanged points
 * (`neighbor` being the closest of them to the endpoint, and `nextNeighbor`
 * the one after it), from the endpoint inwards.
 *
 * Normally, it's a single corner point. But if the endpoint is bound and
 * would leave its element along the segment it connects to, that would run
 * along the element, so it steps out by the padding first, which makes the
 * endpoint "special".
 */
const connectEndpoint = (
  endpoint: GlobalPoint,
  heading: Heading,
  isBound: boolean,
  neighbor: GlobalPoint,
  nextNeighbor: GlobalPoint,
  neighborIsHorizontal: boolean,
): { points: GlobalPoint[]; isSpecial: boolean } => {
  if (isBound && headingIsHorizontal(heading) === neighborIsHorizontal) {
    const stepOut = translateAlongHeading(endpoint, heading, BASE_PADDING);

    return {
      points: [
        stepOut,
        alignPoint(stepOut, nextNeighbor, neighborIsHorizontal),
      ],
      isSpecial: true,
    };
  }

  return {
    points: [alignPoint(endpoint, neighbor, neighborIsHorizontal)],
    isSpecial: false,
  };
};

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

const toGlobalPoint = (
  arrow: { x: number; y: number },
  p: LocalPoint,
): GlobalPoint => pointFrom<GlobalPoint>(arrow.x + p[0], arrow.y + p[1]);

const toLocalPoint = (
  arrow: { x: number; y: number },
  p: GlobalPoint,
): LocalPoint => pointFrom<LocalPoint>(p[0] - arrow.x, p[1] - arrow.y);

/**
 * `p` moved to be on the same horizontal (or vertical) line as `other`, i.e.
 * so the segment between them is horizontal (or vertical)
 */
const alignPoint = <P extends GlobalPoint | LocalPoint>(
  p: P,
  other: P,
  horizontal: boolean,
): P =>
  horizontal ? pointFrom<P>(p[0], other[1]) : pointFrom<P>(other[0], p[1]);

const translateAlongHeading = <P extends GlobalPoint | LocalPoint>(
  p: P,
  heading: Heading,
  distance: number,
): P =>
  headingIsHorizontal(heading)
    ? pointFrom<P>(p[0] + heading[0] * distance, p[1])
    : pointFrom<P>(p[0], p[1] + heading[1] * distance);

/** Moves the fixed segments after `index` by `delta` (in place) */
const shiftFixedSegmentIndices = (
  fixedSegments: { index: number }[],
  index: number,
  delta: number,
) => {
  for (const segment of fixedSegments) {
    if (segment.index > index) {
      segment.index += delta;
    }
  }
};

/**
 * The element update for the given global points: positioned at the first
 * point, with the points relative to it
 */
const normalizeArrowElementUpdate = (
  global: GlobalPoint[],
  nextFixedSegments: readonly FixedSegment[] | null,
  startIsSpecial?: ExcalidrawElbowArrowElement["startIsSpecial"],
  endIsSpecial?: ExcalidrawElbowArrowElement["endIsSpecial"],
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  const [offsetX, offsetY] = global[0];
  let points = global.map((p) =>
    pointFrom<LocalPoint>(p[0] - offsetX, p[1] - offsetY),
  );

  // NOTE (mtolmacs): This is a temporary check to see if the normalization
  // creates an overly large arrow. This should be removed once we have an answer.
  const last = global[global.length - 1];
  if (
    [offsetX, offsetY, last[0], last[1]].some(
      (v) => v < -MAX_POS || v > MAX_POS,
    )
  ) {
    console.error(
      "Elbow arrow normalization is outside reasonable bounds (> 1e6)",
      {
        x: offsetX,
        y: offsetY,
        points,
        ...getSizeFromPoints(points),
      },
    );
  }

  points = points.map(([x, y]) =>
    pointFrom<LocalPoint>(
      clamp(x, -MAX_POS, MAX_POS),
      clamp(y, -MAX_POS, MAX_POS),
    ),
  );

  return {
    points,
    x: clamp(offsetX, -MAX_POS, MAX_POS),
    y: clamp(offsetY, -MAX_POS, MAX_POS),
    fixedSegments:
      (nextFixedSegments?.length ?? 0) > 0 ? nextFixedSegments : null,
    ...getSizeFromPoints(points),
    startIsSpecial,
    endIsSpecial,
  };
};
