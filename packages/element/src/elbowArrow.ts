import {
  clamp,
  pointDistance,
  pointFrom,
  pointScaleFromOrigin,
  pointsEqual,
  pointTranslate,
  vector,
  vectorCross,
  vectorFromPoint,
  vectorScale,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";

import {
  BinaryHeap,
  invariant,
  isAnyTrue,
  tupleToCoors,
  getSizeFromPoints,
  isDevEnv,
} from "@excalidraw/common";

import { isPointInShape } from "@excalidraw/utils/collision";

import type { AppState } from "@excalidraw/excalidraw/types";

import {
  bindPointToSnapToElementOutline,
  FIXED_BINDING_DISTANCE,
  getHeadingForElbowArrowSnap,
  getGlobalFixedPointForBindableElement,
  snapToMid,
  getHoveredElementForBinding,
} from "./binding";
import { distanceToBindableElement } from "./distance";
import {
  compareHeading,
  flipHeading,
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  headingForPointIsHorizontal,
  headingIsHorizontal,
  vectorToHeading,
  headingForPoint,
} from "./heading";
import { type ElementUpdate } from "./mutateElement";
import { isBindableElement } from "./typeChecks";

import {
  type ExcalidrawElbowArrowElement,
  type NonDeletedSceneElementsMap,
} from "./types";

import { aabbForElement, getElementShape, pointInsideBounds } from "./shapes";

import type { Bounds } from "./bounds";
import type { Heading } from "./heading";
import type {
  Arrowhead,
  ElementsMap,
  ExcalidrawBindableElement,
  FixedPointBinding,
  FixedSegment,
  NonDeletedExcalidrawElement,
} from "./types";

type GridAddress = [number, number] & { _brand: "gridaddress" };

type Node = {
  f: number;
  g: number;
  h: number;
  closed: boolean;
  visited: boolean;
  parent: Node | null;
  pos: GlobalPoint;
  addr: GridAddress;
};

type Grid = {
  row: number;
  col: number;
  data: (Node | null)[];
};

type ElbowArrowState = {
  x: number;
  y: number;
  startBinding: FixedPointBinding | null;
  endBinding: FixedPointBinding | null;
  startArrowhead: Arrowhead | null;
  endArrowhead: Arrowhead | null;
};

type ElbowArrowData = {
  dynamicAABBs: Bounds[];
  startDonglePosition: GlobalPoint | null;
  startGlobalPoint: GlobalPoint;
  startHeading: Heading;
  endDonglePosition: GlobalPoint | null;
  endGlobalPoint: GlobalPoint;
  endHeading: Heading;
  commonBounds: Bounds;
  hoveredStartElement: ExcalidrawBindableElement | null;
  hoveredEndElement: ExcalidrawBindableElement | null;
};

const DEDUP_TRESHOLD = 1;
export const BASE_PADDING = 40;

const handleSegmentRenormalization = (
  arrow: ExcalidrawElbowArrowElement,
  elementsMap: NonDeletedSceneElementsMap,
) => {
  const nextFixedSegments: FixedSegment[] | null = arrow.fixedSegments
    ? arrow.fixedSegments.slice()
    : null;

  if (nextFixedSegments) {
    const _nextPoints: GlobalPoint[] = [];

    arrow.points
      .map((p) => pointFrom<GlobalPoint>(arrow.x + p[0], arrow.y + p[1]))
      .forEach((p, i, points) => {
        if (i < 2) {
          return _nextPoints.push(p);
        }

        const currentSegmentIsHorizontal = headingForPoint(p, points[i - 1]);
        const prevSegmentIsHorizontal = headingForPoint(
          points[i - 1],
          points[i - 2],
        );

        if (
          // Check if previous two points are on the same line
          compareHeading(currentSegmentIsHorizontal, prevSegmentIsHorizontal)
        ) {
          const prevSegmentIdx =
            nextFixedSegments?.findIndex(
              (segment) => segment.index === i - 1,
            ) ?? -1;
          const segmentIdx =
            nextFixedSegments?.findIndex((segment) => segment.index === i) ??
            -1;

          // If the current segment is a fixed segment, update its start point
          if (segmentIdx !== -1) {
            nextFixedSegments[segmentIdx].start = pointFrom<LocalPoint>(
              points[i - 2][0] - arrow.x,
              points[i - 2][1] - arrow.y,
            );
          }

          // Remove the fixed segment status from the previous segment if it is
          // a fixed segment, because we are going to unify that segment with
          // the current one
          if (prevSegmentIdx !== -1) {
            nextFixedSegments.splice(prevSegmentIdx, 1);
          }

          // Remove the duplicate point
          _nextPoints.splice(-1, 1);

          // Update fixed point indices
          nextFixedSegments.forEach((segment) => {
            if (segment.index > i - 1) {
              segment.index -= 1;
            }
          });
        }

        return _nextPoints.push(p);
      });

    const nextPoints: GlobalPoint[] = [];

    _nextPoints.forEach((p, i, points) => {
      if (i < 3) {
        return nextPoints.push(p);
      }

      if (
        // Remove segments that are too short
        pointDistance(points[i - 2], points[i - 1]) < DEDUP_TRESHOLD
      ) {
        const prevPrevSegmentIdx =
          nextFixedSegments?.findIndex((segment) => segment.index === i - 2) ??
          -1;
        const prevSegmentIdx =
          nextFixedSegments?.findIndex((segment) => segment.index === i - 1) ??
          -1;

        // Remove the previous fixed segment if it exists (i.e. the segment
        // which will be removed due to being parallel or too short)
        if (prevSegmentIdx !== -1) {
          nextFixedSegments.splice(prevSegmentIdx, 1);
        }

        // Remove the fixed segment status from the segment 2 steps back
        // if it is a fixed segment, because we are going to unify that
        // segment with the current one
        if (prevPrevSegmentIdx !== -1) {
          nextFixedSegments.splice(prevPrevSegmentIdx, 1);
        }

        nextPoints.splice(-2, 2);

        // Since we have to remove two segments, update any fixed segment
        nextFixedSegments.forEach((segment) => {
          if (segment.index > i - 2) {
            segment.index -= 2;
          }
        });

        // Remove aligned segment points
        const isHorizontal = headingForPointIsHorizontal(p, points[i - 1]);

        return nextPoints.push(
          pointFrom<GlobalPoint>(
            !isHorizontal ? points[i - 2][0] : p[0],
            isHorizontal ? points[i - 2][1] : p[1],
          ),
        );
      }

      nextPoints.push(p);
    });

    const filteredNextFixedSegments = nextFixedSegments.filter(
      (segment) =>
        segment.index !== 1 && segment.index !== nextPoints.length - 1,
    );
    if (filteredNextFixedSegments.length === 0) {
      return normalizeArrowElementUpdate(
        getElbowArrowCornerPoints(
          removeElbowArrowShortSegments(
            routeElbowArrow(
              arrow,
              getElbowArrowData(
                arrow,
                elementsMap,
                nextPoints.map((p) =>
                  pointFrom<LocalPoint>(p[0] - arrow.x, p[1] - arrow.y),
                ),
              ),
            ) ?? [],
          ),
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
  }

  return {
    x: arrow.x,
    y: arrow.y,
    points: arrow.points,
    fixedSegments: arrow.fixedSegments,
    startIsSpecial: arrow.startIsSpecial,
    endIsSpecial: arrow.endIsSpecial,
  };
};

const handleSegmentRelease = (
  arrow: ExcalidrawElbowArrowElement,
  fixedSegments: readonly FixedSegment[],
  elementsMap: NonDeletedSceneElementsMap,
) => {
  const newFixedSegmentIndices = fixedSegments.map((segment) => segment.index);
  const oldFixedSegmentIndices =
    arrow.fixedSegments?.map((segment) => segment.index) ?? [];
  const deletedSegmentIdx = oldFixedSegmentIndices.findIndex(
    (idx) => !newFixedSegmentIndices.includes(idx),
  );

  if (deletedSegmentIdx === -1 || !arrow.fixedSegments?.[deletedSegmentIdx]) {
    return {
      points: arrow.points,
    };
  }

  const deletedIdx = arrow.fixedSegments[deletedSegmentIdx].index;

  // Find prev and next fixed segments
  const prevSegment = arrow.fixedSegments[deletedSegmentIdx - 1];
  const nextSegment = arrow.fixedSegments[deletedSegmentIdx + 1];

  // We need to render a sub-arrow path to restore deleted segments
  const x = arrow.x + (prevSegment ? prevSegment.end[0] : 0);
  const y = arrow.y + (prevSegment ? prevSegment.end[1] : 0);
  const startBinding = prevSegment ? null : arrow.startBinding;
  const endBinding = nextSegment ? null : arrow.endBinding;
  const {
    startHeading,
    endHeading,
    startGlobalPoint,
    endGlobalPoint,
    hoveredStartElement,
    hoveredEndElement,
    ...rest
  } = getElbowArrowData(
    {
      x,
      y,
      startBinding,
      endBinding,
      startArrowhead: null,
      endArrowhead: null,
      points: arrow.points,
    },
    elementsMap,
    [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(
        arrow.x +
          (nextSegment?.start[0] ?? arrow.points[arrow.points.length - 1][0]) -
          x,
        arrow.y +
          (nextSegment?.start[1] ?? arrow.points[arrow.points.length - 1][1]) -
          y,
      ),
    ],
    { isDragging: false },
  );

  const { points: restoredPoints } = normalizeArrowElementUpdate(
    getElbowArrowCornerPoints(
      removeElbowArrowShortSegments(
        routeElbowArrow(arrow, {
          startHeading,
          endHeading,
          startGlobalPoint,
          endGlobalPoint,
          hoveredStartElement,
          hoveredEndElement,
          ...rest,
        }) ?? [],
      ),
    ),
    fixedSegments,
    null,
    null,
  );

  const nextPoints: GlobalPoint[] = [];

  // First part of the arrow are the old points
  if (prevSegment) {
    for (let i = 0; i < prevSegment.index; i++) {
      nextPoints.push(
        pointFrom<GlobalPoint>(
          arrow.x + arrow.points[i][0],
          arrow.y + arrow.points[i][1],
        ),
      );
    }
  }

  restoredPoints.forEach((p) => {
    nextPoints.push(
      pointFrom<GlobalPoint>(
        arrow.x + (prevSegment ? prevSegment.end[0] : 0) + p[0],
        arrow.y + (prevSegment ? prevSegment.end[1] : 0) + p[1],
      ),
    );
  });

  // Last part of the arrow are the old points too
  if (nextSegment) {
    for (let i = nextSegment.index; i < arrow.points.length; i++) {
      nextPoints.push(
        pointFrom<GlobalPoint>(
          arrow.x + arrow.points[i][0],
          arrow.y + arrow.points[i][1],
        ),
      );
    }
  }

  // Update nextFixedSegments
  const originalSegmentCountDiff =
    (nextSegment?.index ?? arrow.points.length) - (prevSegment?.index ?? 0) - 1;

  const nextFixedSegments = fixedSegments.map((segment) => {
    if (segment.index > deletedIdx) {
      return {
        ...segment,
        index:
          segment.index -
          originalSegmentCountDiff +
          (restoredPoints.length - 1),
      };
    }

    return segment;
  });

  const simplifiedPoints = nextPoints.flatMap((p, i) => {
    const prev = nextPoints[i - 1];
    const next = nextPoints[i + 1];

    if (prev && next) {
      const prevHeading = headingForPoint(p, prev);
      const nextHeading = headingForPoint(next, p);

      if (compareHeading(prevHeading, nextHeading)) {
        // Update subsequent fixed segment indices
        nextFixedSegments.forEach((segment) => {
          if (segment.index > i) {
            segment.index -= 1;
          }
        });

        return [];
      } else if (compareHeading(prevHeading, flipHeading(nextHeading))) {
        // Update subsequent fixed segment indices
        nextFixedSegments.forEach((segment) => {
          if (segment.index > i) {
            segment.index += 1;
          }
        });

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
 *
 */
const handleSegmentMove = (
  arrow: ExcalidrawElbowArrowElement,
  fixedSegments: readonly FixedSegment[],
  startHeading: Heading,
  endHeading: Heading,
  hoveredStartElement: ExcalidrawBindableElement | null,
  hoveredEndElement: ExcalidrawBindableElement | null,
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  const activelyModifiedSegmentIdx = fixedSegments
    .map((segment, i) => {
      if (
        arrow.fixedSegments == null ||
        arrow.fixedSegments[i] === undefined ||
        arrow.fixedSegments[i].index !== segment.index
      ) {
        return i;
      }

      return (segment.start[0] !== arrow.fixedSegments![i].start[0] &&
        segment.end[0] !== arrow.fixedSegments![i].end[0]) !==
        (segment.start[1] !== arrow.fixedSegments![i].start[1] &&
          segment.end[1] !== arrow.fixedSegments![i].end[1])
        ? i
        : null;
    })
    .filter((idx) => idx !== null)
    .shift();

  if (activelyModifiedSegmentIdx == null) {
    return { points: arrow.points };
  }

  const firstSegmentIdx =
    arrow.fixedSegments?.findIndex((segment) => segment.index === 1) ?? -1;
  const lastSegmentIdx =
    arrow.fixedSegments?.findIndex(
      (segment) => segment.index === arrow.points.length - 1,
    ) ?? -1;

  // Handle special case for first segment move
  const segmentLength = pointDistance(
    fixedSegments[activelyModifiedSegmentIdx].start,
    fixedSegments[activelyModifiedSegmentIdx].end,
  );
  const segmentIsTooShort = segmentLength < BASE_PADDING + 5;
  if (
    firstSegmentIdx === -1 &&
    fixedSegments[activelyModifiedSegmentIdx].index === 1 &&
    hoveredStartElement
  ) {
    const startIsHorizontal = headingIsHorizontal(startHeading);
    const startIsPositive = startIsHorizontal
      ? compareHeading(startHeading, HEADING_RIGHT)
      : compareHeading(startHeading, HEADING_DOWN);
    const padding = startIsPositive
      ? segmentIsTooShort
        ? segmentLength / 2
        : BASE_PADDING
      : segmentIsTooShort
      ? -segmentLength / 2
      : -BASE_PADDING;
    fixedSegments[activelyModifiedSegmentIdx].start = pointFrom<LocalPoint>(
      fixedSegments[activelyModifiedSegmentIdx].start[0] +
        (startIsHorizontal ? padding : 0),
      fixedSegments[activelyModifiedSegmentIdx].start[1] +
        (!startIsHorizontal ? padding : 0),
    );
  }

  // Handle special case for last segment move
  if (
    lastSegmentIdx === -1 &&
    fixedSegments[activelyModifiedSegmentIdx].index ===
      arrow.points.length - 1 &&
    hoveredEndElement
  ) {
    const endIsHorizontal = headingIsHorizontal(endHeading);
    const endIsPositive = endIsHorizontal
      ? compareHeading(endHeading, HEADING_RIGHT)
      : compareHeading(endHeading, HEADING_DOWN);
    const padding = endIsPositive
      ? segmentIsTooShort
        ? segmentLength / 2
        : BASE_PADDING
      : segmentIsTooShort
      ? -segmentLength / 2
      : -BASE_PADDING;
    fixedSegments[activelyModifiedSegmentIdx].end = pointFrom<LocalPoint>(
      fixedSegments[activelyModifiedSegmentIdx].end[0] +
        (endIsHorizontal ? padding : 0),
      fixedSegments[activelyModifiedSegmentIdx].end[1] +
        (!endIsHorizontal ? padding : 0),
    );
  }

  // Translate all fixed segments to global coordinates
  const nextFixedSegments = fixedSegments.map((segment) => ({
    ...segment,
    start: pointFrom<GlobalPoint>(
      arrow.x + segment.start[0],
      arrow.y + segment.start[1],
    ),
    end: pointFrom<GlobalPoint>(
      arrow.x + segment.end[0],
      arrow.y + segment.end[1],
    ),
  }));

  // For start, clone old arrow points
  const newPoints: GlobalPoint[] = arrow.points.map((p, i) =>
    pointFrom<GlobalPoint>(arrow.x + p[0], arrow.y + p[1]),
  );

  const startIdx = nextFixedSegments[activelyModifiedSegmentIdx].index - 1;
  const endIdx = nextFixedSegments[activelyModifiedSegmentIdx].index;
  const start = nextFixedSegments[activelyModifiedSegmentIdx].start;
  const end = nextFixedSegments[activelyModifiedSegmentIdx].end;
  const prevSegmentIsHorizontal =
    newPoints[startIdx - 1] &&
    !pointsEqual(newPoints[startIdx], newPoints[startIdx - 1])
      ? headingForPointIsHorizontal(
          newPoints[startIdx - 1],
          newPoints[startIdx],
        )
      : undefined;
  const nextSegmentIsHorizontal =
    newPoints[endIdx + 1] &&
    !pointsEqual(newPoints[endIdx], newPoints[endIdx + 1])
      ? headingForPointIsHorizontal(newPoints[endIdx + 1], newPoints[endIdx])
      : undefined;

  // Override the segment points with the actively moved fixed segment
  if (prevSegmentIsHorizontal !== undefined) {
    const dir = prevSegmentIsHorizontal ? 1 : 0;
    newPoints[startIdx - 1][dir] = start[dir];
  }
  newPoints[startIdx] = start;
  newPoints[endIdx] = end;
  if (nextSegmentIsHorizontal !== undefined) {
    const dir = nextSegmentIsHorizontal ? 1 : 0;
    newPoints[endIdx + 1][dir] = end[dir];
  }

  // Override neighboring fixedSegment start/end points, if any
  const prevSegmentIdx = nextFixedSegments.findIndex(
    (segment) => segment.index === startIdx,
  );
  if (prevSegmentIdx !== -1) {
    // Align the next segment points with the moved segment
    const dir = headingForPointIsHorizontal(
      nextFixedSegments[prevSegmentIdx].end,
      nextFixedSegments[prevSegmentIdx].start,
    )
      ? 1
      : 0;
    nextFixedSegments[prevSegmentIdx].start[dir] = start[dir];
    nextFixedSegments[prevSegmentIdx].end = start;
  }

  const nextSegmentIdx = nextFixedSegments.findIndex(
    (segment) => segment.index === endIdx + 1,
  );
  if (nextSegmentIdx !== -1) {
    // Align the next segment points with the moved segment
    const dir = headingForPointIsHorizontal(
      nextFixedSegments[nextSegmentIdx].end,
      nextFixedSegments[nextSegmentIdx].start,
    )
      ? 1
      : 0;
    nextFixedSegments[nextSegmentIdx].end[dir] = end[dir];
    nextFixedSegments[nextSegmentIdx].start = end;
  }

  // First segment move needs an additional segment
  if (firstSegmentIdx === -1 && startIdx === 0) {
    const startIsHorizontal = hoveredStartElement
      ? headingIsHorizontal(startHeading)
      : headingForPointIsHorizontal(newPoints[1], newPoints[0]);
    newPoints.unshift(
      pointFrom<GlobalPoint>(
        startIsHorizontal ? start[0] : arrow.x + arrow.points[0][0],
        !startIsHorizontal ? start[1] : arrow.y + arrow.points[0][1],
      ),
    );

    if (hoveredStartElement) {
      newPoints.unshift(
        pointFrom<GlobalPoint>(
          arrow.x + arrow.points[0][0],
          arrow.y + arrow.points[0][1],
        ),
      );
    }

    for (const segment of nextFixedSegments) {
      segment.index += hoveredStartElement ? 2 : 1;
    }
  }

  // Last segment move needs an additional segment
  if (lastSegmentIdx === -1 && endIdx === arrow.points.length - 1) {
    const endIsHorizontal = headingIsHorizontal(endHeading);
    newPoints.push(
      pointFrom<GlobalPoint>(
        endIsHorizontal
          ? end[0]
          : arrow.x + arrow.points[arrow.points.length - 1][0],
        !endIsHorizontal
          ? end[1]
          : arrow.y + arrow.points[arrow.points.length - 1][1],
      ),
    );
    if (hoveredEndElement) {
      newPoints.push(
        pointFrom<GlobalPoint>(
          arrow.x + arrow.points[arrow.points.length - 1][0],
          arrow.y + arrow.points[arrow.points.length - 1][1],
        ),
      );
    }
  }

  return normalizeArrowElementUpdate(
    newPoints,
    nextFixedSegments.map((segment) => ({
      ...segment,
      start: pointFrom<LocalPoint>(
        segment.start[0] - arrow.x,
        segment.start[1] - arrow.y,
      ),
      end: pointFrom<LocalPoint>(
        segment.end[0] - arrow.x,
        segment.end[1] - arrow.y,
      ),
    })),
    false, // If you move a segment, there is no special point anymore
    false, // If you move a segment, there is no special point anymore
  );
};

const handleEndpointDrag = (
  arrow: ExcalidrawElbowArrowElement,
  updatedPoints: readonly LocalPoint[],
  fixedSegments: readonly FixedSegment[],
  startHeading: Heading,
  endHeading: Heading,
  startGlobalPoint: GlobalPoint,
  endGlobalPoint: GlobalPoint,
  hoveredStartElement: ExcalidrawBindableElement | null,
  hoveredEndElement: ExcalidrawBindableElement | null,
) => {
  let startIsSpecial = arrow.startIsSpecial ?? null;
  let endIsSpecial = arrow.endIsSpecial ?? null;
  const globalUpdatedPoints = updatedPoints.map((p, i) =>
    i === 0
      ? pointFrom<GlobalPoint>(arrow.x + p[0], arrow.y + p[1])
      : i === updatedPoints.length - 1
      ? pointFrom<GlobalPoint>(arrow.x + p[0], arrow.y + p[1])
      : pointFrom<GlobalPoint>(
          arrow.x + arrow.points[i][0],
          arrow.y + arrow.points[i][1],
        ),
  );
  const nextFixedSegments = fixedSegments.map((segment) => ({
    ...segment,
    start: pointFrom<GlobalPoint>(
      arrow.x + (segment.start[0] - updatedPoints[0][0]),
      arrow.y + (segment.start[1] - updatedPoints[0][1]),
    ),
    end: pointFrom<GlobalPoint>(
      arrow.x + (segment.end[0] - updatedPoints[0][0]),
      arrow.y + (segment.end[1] - updatedPoints[0][1]),
    ),
  }));
  const newPoints: GlobalPoint[] = [];

  // Add the inside points
  const offset = 2 + (startIsSpecial ? 1 : 0);
  const endOffset = 2 + (endIsSpecial ? 1 : 0);
  while (newPoints.length + offset < globalUpdatedPoints.length - endOffset) {
    newPoints.push(globalUpdatedPoints[newPoints.length + offset]);
  }

  // Calculate the moving second point connection and add the start point
  {
    const secondPoint = globalUpdatedPoints[startIsSpecial ? 2 : 1];
    const thirdPoint = globalUpdatedPoints[startIsSpecial ? 3 : 2];
    const startIsHorizontal = headingIsHorizontal(startHeading);
    const secondIsHorizontal = headingIsHorizontal(
      vectorToHeading(vectorFromPoint(secondPoint, thirdPoint)),
    );

    if (hoveredStartElement && startIsHorizontal === secondIsHorizontal) {
      const positive = startIsHorizontal
        ? compareHeading(startHeading, HEADING_RIGHT)
        : compareHeading(startHeading, HEADING_DOWN);
      newPoints.unshift(
        pointFrom<GlobalPoint>(
          !secondIsHorizontal
            ? thirdPoint[0]
            : startGlobalPoint[0] + (positive ? BASE_PADDING : -BASE_PADDING),
          secondIsHorizontal
            ? thirdPoint[1]
            : startGlobalPoint[1] + (positive ? BASE_PADDING : -BASE_PADDING),
        ),
      );
      newPoints.unshift(
        pointFrom<GlobalPoint>(
          startIsHorizontal
            ? startGlobalPoint[0] + (positive ? BASE_PADDING : -BASE_PADDING)
            : startGlobalPoint[0],
          !startIsHorizontal
            ? startGlobalPoint[1] + (positive ? BASE_PADDING : -BASE_PADDING)
            : startGlobalPoint[1],
        ),
      );
      if (!startIsSpecial) {
        startIsSpecial = true;
        for (const segment of nextFixedSegments) {
          if (segment.index > 1) {
            segment.index += 1;
          }
        }
      }
    } else {
      newPoints.unshift(
        pointFrom<GlobalPoint>(
          !secondIsHorizontal ? secondPoint[0] : startGlobalPoint[0],
          secondIsHorizontal ? secondPoint[1] : startGlobalPoint[1],
        ),
      );
      if (startIsSpecial) {
        startIsSpecial = false;
        for (const segment of nextFixedSegments) {
          if (segment.index > 1) {
            segment.index -= 1;
          }
        }
      }
    }
    newPoints.unshift(startGlobalPoint);
  }

  // Calculate the moving second to last point connection
  {
    const secondToLastPoint =
      globalUpdatedPoints[globalUpdatedPoints.length - (endIsSpecial ? 3 : 2)];
    const thirdToLastPoint =
      globalUpdatedPoints[globalUpdatedPoints.length - (endIsSpecial ? 4 : 3)];
    const endIsHorizontal = headingIsHorizontal(endHeading);
    const secondIsHorizontal = headingForPointIsHorizontal(
      thirdToLastPoint,
      secondToLastPoint,
    );
    if (hoveredEndElement && endIsHorizontal === secondIsHorizontal) {
      const positive = endIsHorizontal
        ? compareHeading(endHeading, HEADING_RIGHT)
        : compareHeading(endHeading, HEADING_DOWN);
      newPoints.push(
        pointFrom<GlobalPoint>(
          !secondIsHorizontal
            ? thirdToLastPoint[0]
            : endGlobalPoint[0] + (positive ? BASE_PADDING : -BASE_PADDING),
          secondIsHorizontal
            ? thirdToLastPoint[1]
            : endGlobalPoint[1] + (positive ? BASE_PADDING : -BASE_PADDING),
        ),
      );
      newPoints.push(
        pointFrom<GlobalPoint>(
          endIsHorizontal
            ? endGlobalPoint[0] + (positive ? BASE_PADDING : -BASE_PADDING)
            : endGlobalPoint[0],
          !endIsHorizontal
            ? endGlobalPoint[1] + (positive ? BASE_PADDING : -BASE_PADDING)
            : endGlobalPoint[1],
        ),
      );
      if (!endIsSpecial) {
        endIsSpecial = true;
      }
    } else {
      newPoints.push(
        pointFrom<GlobalPoint>(
          !secondIsHorizontal ? secondToLastPoint[0] : endGlobalPoint[0],
          secondIsHorizontal ? secondToLastPoint[1] : endGlobalPoint[1],
        ),
      );
      if (endIsSpecial) {
        endIsSpecial = false;
      }
    }
  }

  newPoints.push(endGlobalPoint);

  return normalizeArrowElementUpdate(
    newPoints,
    nextFixedSegments
      .map(({ index }) => ({
        index,
        start: newPoints[index - 1],
        end: newPoints[index],
      }))
      .map((segment) => ({
        ...segment,
        start: pointFrom<LocalPoint>(
          segment.start[0] - startGlobalPoint[0],
          segment.start[1] - startGlobalPoint[1],
        ),
        end: pointFrom<LocalPoint>(
          segment.end[0] - startGlobalPoint[0],
          segment.end[1] - startGlobalPoint[1],
        ),
      })),
    startIsSpecial,
    endIsSpecial,
  );
};

const MAX_POS = 1e6;

/**
 *
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
  },
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  if (arrow.points.length < 2) {
    return { points: updates.points ?? arrow.points };
  }

  // NOTE (mtolmacs): This is a temporary check to ensure that the incoming elbow
  // arrow size is valid. This check will be removed once the issue is identified
  if (
    arrow.x < -MAX_POS ||
    arrow.x > MAX_POS ||
    arrow.y < -MAX_POS ||
    arrow.y > MAX_POS ||
    arrow.x + (updates?.points?.[updates?.points?.length - 1]?.[0] ?? 0) <
      -MAX_POS ||
    arrow.x + (updates?.points?.[updates?.points?.length - 1]?.[0] ?? 0) >
      MAX_POS ||
    arrow.y + (updates?.points?.[updates?.points?.length - 1]?.[1] ?? 0) <
      -MAX_POS ||
    arrow.y + (updates?.points?.[updates?.points?.length - 1]?.[1] ?? 0) >
      MAX_POS ||
    arrow.x + (arrow?.points?.[arrow?.points?.length - 1]?.[0] ?? 0) <
      -MAX_POS ||
    arrow.x + (arrow?.points?.[arrow?.points?.length - 1]?.[0] ?? 0) >
      MAX_POS ||
    arrow.y + (arrow?.points?.[arrow?.points?.length - 1]?.[1] ?? 0) <
      -MAX_POS ||
    arrow.y + (arrow?.points?.[arrow?.points?.length - 1]?.[1] ?? 0) > MAX_POS
  ) {
    console.error(
      "Elbow arrow (or update) is outside reasonable bounds (> 1e6)",
      {
        arrow,
        updates,
      },
    );
  }
  // @ts-ignore See above note
  arrow.x = clamp(arrow.x, -MAX_POS, MAX_POS);
  // @ts-ignore See above note
  arrow.y = clamp(arrow.y, -MAX_POS, MAX_POS);
  if (updates.points) {
    updates.points = updates.points.map(([x, y]) =>
      pointFrom<LocalPoint>(
        clamp(x, -MAX_POS, MAX_POS),
        clamp(y, -MAX_POS, MAX_POS),
      ),
    );
  }

  if (!import.meta.env.PROD) {
    invariant(
      !updates.points || updates.points.length >= 2,
      "Updated point array length must match the arrow point length, contain " +
        "exactly the new start and end points or not be specified at all (i.e. " +
        "you can't add new points between start and end manually to elbow arrows)",
    );

    invariant(
      !arrow.fixedSegments ||
        arrow.fixedSegments
          .map((s) => s.start[0] === s.end[0] || s.start[1] === s.end[1])
          .every(Boolean),
      "Fixed segments must be either horizontal or vertical",
    );

    invariant(
      !updates.fixedSegments ||
        updates.fixedSegments
          .map((s) => s.start[0] === s.end[0] || s.start[1] === s.end[1])
          .every(Boolean),
      "Updates to fixed segments must be either horizontal or vertical",
    );

    invariant(
      arrow.points
        .slice(1)
        .map(
          (p, i) => p[0] === arrow.points[i][0] || p[1] === arrow.points[i][1],
        ),
      "Elbow arrow segments must be either horizontal or vertical",
    );
  }

  const fixedSegments = updates.fixedSegments ?? arrow.fixedSegments ?? [];

  const updatedPoints: readonly LocalPoint[] = updates.points
    ? updates.points && updates.points.length === 2
      ? arrow.points.map((p, idx) =>
          idx === 0
            ? updates.points![0]
            : idx === arrow.points.length - 1
            ? updates.points![1]
            : p,
        )
      : updates.points.slice()
    : arrow.points.slice();

  // During all element replacement in the scene, we just need to renormalize
  // the arrow
  // TODO (dwelle,mtolmacs): Remove this once Scene.getScene() is removed
  const {
    startBinding: updatedStartBinding,
    endBinding: updatedEndBinding,
    ...restOfTheUpdates
  } = updates;
  const startBinding =
    typeof updatedStartBinding !== "undefined"
      ? updatedStartBinding
      : arrow.startBinding;
  const endBinding =
    typeof updatedEndBinding !== "undefined"
      ? updatedEndBinding
      : arrow.endBinding;
  const startElement =
    startBinding &&
    getBindableElementForId(startBinding.elementId, elementsMap);
  const endElement =
    endBinding && getBindableElementForId(endBinding.elementId, elementsMap);
  const areUpdatedPointsValid = validateElbowPoints(updatedPoints);

  if (
    (startBinding && !startElement && areUpdatedPointsValid) ||
    (endBinding && !endElement && areUpdatedPointsValid) ||
    (elementsMap.size === 0 && areUpdatedPointsValid) ||
    (Object.keys(restOfTheUpdates).length === 0 &&
      (startElement?.id !== startBinding?.elementId ||
        endElement?.id !== endBinding?.elementId))
  ) {
    return normalizeArrowElementUpdate(
      updatedPoints.map((p) =>
        pointFrom<GlobalPoint>(arrow.x + p[0], arrow.y + p[1]),
      ),
      arrow.fixedSegments,
      arrow.startIsSpecial,
      arrow.endIsSpecial,
    );
  }

  const {
    startHeading,
    endHeading,
    startGlobalPoint,
    endGlobalPoint,
    hoveredStartElement,
    hoveredEndElement,
    ...rest
  } = getElbowArrowData(
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

  // 0. During all element replacement in the scene, we just need to renormalize
  // the arrow
  // TODO (dwelle,mtolmacs): Remove this once Scene.getScene() is removed
  if (elementsMap.size === 0 && areUpdatedPointsValid) {
    return normalizeArrowElementUpdate(
      updatedPoints.map((p) =>
        pointFrom<GlobalPoint>(arrow.x + p[0], arrow.y + p[1]),
      ),
      arrow.fixedSegments,
      arrow.startIsSpecial,
      arrow.endIsSpecial,
    );
  }

  ////
  // 1. Renormalize the arrow
  ////
  if (
    !updates.points &&
    !updates.fixedSegments &&
    !updates.startBinding &&
    !updates.endBinding
  ) {
    return handleSegmentRenormalization(arrow, elementsMap);
  }

  // Short circuit on no-op to avoid huge performance hit
  if (
    updates.startBinding === arrow.startBinding &&
    updates.endBinding === arrow.endBinding &&
    (updates.points ?? []).every((p, i) =>
      pointsEqual(
        p,
        arrow.points[i] ?? pointFrom<LocalPoint>(Infinity, Infinity),
      ),
    ) &&
    areUpdatedPointsValid
  ) {
    return {};
  }

  ////
  // 2. Just normal elbow arrow things
  ////
  if (fixedSegments.length === 0) {
    return normalizeArrowElementUpdate(
      getElbowArrowCornerPoints(
        removeElbowArrowShortSegments(
          routeElbowArrow(arrow, {
            startHeading,
            endHeading,
            startGlobalPoint,
            endGlobalPoint,
            hoveredStartElement,
            hoveredEndElement,
            ...rest,
          }) ?? [],
        ),
      ),
      fixedSegments,
      null,
      null,
    );
  }

  ////
  // 3. Handle releasing a fixed segment
  if ((arrow.fixedSegments?.length ?? 0) > fixedSegments.length) {
    return handleSegmentRelease(arrow, fixedSegments, elementsMap);
  }

  ////
  // 4. Handle manual segment move
  ////
  if (!updates.points) {
    return handleSegmentMove(
      arrow,
      fixedSegments,
      startHeading,
      endHeading,
      hoveredStartElement,
      hoveredEndElement,
    );
  }

  ////
  // 5. Handle resize
  ////
  if (updates.points && updates.fixedSegments) {
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
    startHeading,
    endHeading,
    startGlobalPoint,
    endGlobalPoint,
    hoveredStartElement,
    hoveredEndElement,
  );
};

/**
 * Retrieves data necessary for calculating the elbow arrow path.
 *
 * @param arrow - The arrow object containing its properties.
 * @param elementsMap - A map of elements in the scene.
 * @param nextPoints - The next set of points for the arrow.
 * @param options - Optional parameters for the calculation.
 * @param options.isDragging - Indicates if the arrow is being dragged.
 * @param options.startIsMidPoint - Indicates if the start point is a midpoint.
 * @param options.endIsMidPoint - Indicates if the end point is a midpoint.
 *
 * @returns An object containing various properties needed for elbow arrow calculations:
 * - dynamicAABBs: Dynamically generated axis-aligned bounding boxes.
 * - startDonglePosition: The position of the start dongle.
 * - startGlobalPoint: The global coordinates of the start point.
 * - startHeading: The heading direction from the start point.
 * - endDonglePosition: The position of the end dongle.
 * - endGlobalPoint: The global coordinates of the end point.
 * - endHeading: The heading direction from the end point.
 * - commonBounds: The common bounding box that encompasses both start and end points.
 * - hoveredStartElement: The element being hovered over at the start point.
 * - hoveredEndElement: The element being hovered over at the end point.
 */
const getElbowArrowData = (
  arrow: {
    x: number;
    y: number;
    startBinding: FixedPointBinding | null;
    endBinding: FixedPointBinding | null;
    startArrowhead: Arrowhead | null;
    endArrowhead: Arrowhead | null;
    points: readonly LocalPoint[];
  },
  elementsMap: NonDeletedSceneElementsMap,
  nextPoints: readonly LocalPoint[],
  options?: {
    isDragging?: boolean;
    zoom?: AppState["zoom"];
  },
) => {
  const origStartGlobalPoint: GlobalPoint = pointTranslate<
    LocalPoint,
    GlobalPoint
  >(nextPoints[0], vector(arrow.x, arrow.y));
  const origEndGlobalPoint: GlobalPoint = pointTranslate<
    LocalPoint,
    GlobalPoint
  >(nextPoints[nextPoints.length - 1], vector(arrow.x, arrow.y));

  let hoveredStartElement = null;
  let hoveredEndElement = null;
  if (options?.isDragging) {
    const elements = Array.from(elementsMap.values());
    hoveredStartElement =
      getHoveredElement(
        origStartGlobalPoint,
        elementsMap,
        elements,
        options?.zoom,
      ) || null;
    hoveredEndElement =
      getHoveredElement(
        origEndGlobalPoint,
        elementsMap,
        elements,
        options?.zoom,
      ) || null;
  } else {
    hoveredStartElement = arrow.startBinding
      ? getBindableElementForId(arrow.startBinding.elementId, elementsMap) ||
        null
      : null;
    hoveredEndElement = arrow.endBinding
      ? getBindableElementForId(arrow.endBinding.elementId, elementsMap) || null
      : null;
  }

  const startGlobalPoint = getGlobalPoint(
    {
      ...arrow,
      type: "arrow",
      elbowed: true,
      points: nextPoints,
    } as ExcalidrawElbowArrowElement,
    "start",
    arrow.startBinding?.fixedPoint,
    origStartGlobalPoint,
    elementsMap,
    hoveredStartElement,
    options?.isDragging,
    options?.zoom,
  );
  const endGlobalPoint = getGlobalPoint(
    {
      ...arrow,
      type: "arrow",
      elbowed: true,
      points: nextPoints,
    } as ExcalidrawElbowArrowElement,
    "end",
    arrow.endBinding?.fixedPoint,
    origEndGlobalPoint,
    elementsMap,
    hoveredEndElement,
    options?.isDragging,
    options?.zoom,
  );
  const startHeading = getBindPointHeading(
    startGlobalPoint,
    endGlobalPoint,
    hoveredStartElement,
    origStartGlobalPoint,
  );
  const endHeading = getBindPointHeading(
    endGlobalPoint,
    startGlobalPoint,
    hoveredEndElement,
    origEndGlobalPoint,
  );
  const startPointBounds = [
    startGlobalPoint[0] - 2,
    startGlobalPoint[1] - 2,
    startGlobalPoint[0] + 2,
    startGlobalPoint[1] + 2,
  ] as Bounds;
  const endPointBounds = [
    endGlobalPoint[0] - 2,
    endGlobalPoint[1] - 2,
    endGlobalPoint[0] + 2,
    endGlobalPoint[1] + 2,
  ] as Bounds;
  const startElementBounds = hoveredStartElement
    ? aabbForElement(
        hoveredStartElement,
        offsetFromHeading(
          startHeading,
          arrow.startArrowhead
            ? FIXED_BINDING_DISTANCE * 6
            : FIXED_BINDING_DISTANCE * 2,
          1,
        ),
      )
    : startPointBounds;
  const endElementBounds = hoveredEndElement
    ? aabbForElement(
        hoveredEndElement,
        offsetFromHeading(
          endHeading,
          arrow.endArrowhead
            ? FIXED_BINDING_DISTANCE * 6
            : FIXED_BINDING_DISTANCE * 2,
          1,
        ),
      )
    : endPointBounds;
  const boundsOverlap =
    pointInsideBounds(
      startGlobalPoint,
      hoveredEndElement
        ? aabbForElement(
            hoveredEndElement,
            offsetFromHeading(endHeading, BASE_PADDING, BASE_PADDING),
          )
        : endPointBounds,
    ) ||
    pointInsideBounds(
      endGlobalPoint,
      hoveredStartElement
        ? aabbForElement(
            hoveredStartElement,
            offsetFromHeading(startHeading, BASE_PADDING, BASE_PADDING),
          )
        : startPointBounds,
    );
  const commonBounds = commonAABB(
    boundsOverlap
      ? [startPointBounds, endPointBounds]
      : [startElementBounds, endElementBounds],
  );
  const dynamicAABBs = generateDynamicAABBs(
    boundsOverlap ? startPointBounds : startElementBounds,
    boundsOverlap ? endPointBounds : endElementBounds,
    commonBounds,
    boundsOverlap
      ? offsetFromHeading(
          startHeading,
          !hoveredStartElement && !hoveredEndElement ? 0 : BASE_PADDING,
          0,
        )
      : offsetFromHeading(
          startHeading,
          !hoveredStartElement && !hoveredEndElement
            ? 0
            : BASE_PADDING -
                (arrow.startArrowhead
                  ? FIXED_BINDING_DISTANCE * 6
                  : FIXED_BINDING_DISTANCE * 2),
          BASE_PADDING,
        ),
    boundsOverlap
      ? offsetFromHeading(
          endHeading,
          !hoveredStartElement && !hoveredEndElement ? 0 : BASE_PADDING,
          0,
        )
      : offsetFromHeading(
          endHeading,
          !hoveredStartElement && !hoveredEndElement
            ? 0
            : BASE_PADDING -
                (arrow.endArrowhead
                  ? FIXED_BINDING_DISTANCE * 6
                  : FIXED_BINDING_DISTANCE * 2),
          BASE_PADDING,
        ),
    boundsOverlap,
    hoveredStartElement && aabbForElement(hoveredStartElement),
    hoveredEndElement && aabbForElement(hoveredEndElement),
  );
  const startDonglePosition = getDonglePosition(
    dynamicAABBs[0],
    startHeading,
    startGlobalPoint,
  );
  const endDonglePosition = getDonglePosition(
    dynamicAABBs[1],
    endHeading,
    endGlobalPoint,
  );

  return {
    dynamicAABBs,
    startDonglePosition,
    startGlobalPoint,
    startHeading,
    endDonglePosition,
    endGlobalPoint,
    endHeading,
    commonBounds,
    hoveredStartElement,
    hoveredEndElement,
    boundsOverlap,
    startElementBounds,
    endElementBounds,
  };
};

/**
 * Generate the elbow arrow segments
 *
 * @param arrow
 * @param elementsMap
 * @param nextPoints
 * @param options
 * @returns
 */
const routeElbowArrow = (
  arrow: ElbowArrowState,
  elbowArrowData: ElbowArrowData,
): GlobalPoint[] | null => {
  const {
    dynamicAABBs,
    startDonglePosition,
    startGlobalPoint,
    startHeading,
    endDonglePosition,
    endGlobalPoint,
    endHeading,
    commonBounds,
    hoveredEndElement,
  } = elbowArrowData;

  // Canculate Grid positions
  const grid = calculateGrid(
    dynamicAABBs,
    startDonglePosition ? startDonglePosition : startGlobalPoint,
    startHeading,
    endDonglePosition ? endDonglePosition : endGlobalPoint,
    endHeading,
    commonBounds,
  );

  const startDongle =
    startDonglePosition && pointToGridNode(startDonglePosition, grid);
  const endDongle =
    endDonglePosition && pointToGridNode(endDonglePosition, grid);

  // Do not allow stepping on the true end or true start points
  const endNode = pointToGridNode(endGlobalPoint, grid);
  if (endNode && hoveredEndElement) {
    endNode.closed = true;
  }
  const startNode = pointToGridNode(startGlobalPoint, grid);
  if (startNode && arrow.startBinding) {
    startNode.closed = true;
  }
  const dongleOverlap =
    startDongle &&
    endDongle &&
    (pointInsideBounds(startDongle.pos, dynamicAABBs[1]) ||
      pointInsideBounds(endDongle.pos, dynamicAABBs[0]));

  // Create path to end dongle from start dongle
  const path = astar(
    startDongle ? startDongle : startNode!,
    endDongle ? endDongle : endNode!,
    grid,
    startHeading ? startHeading : HEADING_RIGHT,
    endHeading ? endHeading : HEADING_RIGHT,
    dongleOverlap ? [] : dynamicAABBs,
  );

  if (path) {
    const points = path.map((node) => [
      node.pos[0],
      node.pos[1],
    ]) as GlobalPoint[];
    startDongle && points.unshift(startGlobalPoint);
    endDongle && points.push(endGlobalPoint);

    return points;
  }

  return null;
};

const offsetFromHeading = (
  heading: Heading,
  head: number,
  side: number,
): [number, number, number, number] => {
  switch (heading) {
    case HEADING_UP:
      return [head, side, side, side];
    case HEADING_RIGHT:
      return [side, head, side, side];
    case HEADING_DOWN:
      return [side, side, head, side];
  }

  return [side, side, side, head];
};

/**
 * Routing algorithm based on the A* path search algorithm.
 * @see https://www.geeksforgeeks.org/a-search-algorithm/
 *
 * Binary heap is used to optimize node lookup.
 * See {@link calculateGrid} for the grid calculation details.
 *
 * Additional modifications added due to aesthetic route reasons:
 * 1) Arrow segment direction change is penalized by specific linear constant (bendMultiplier)
 * 2) Arrow segments are not allowed to go "backwards", overlapping with the previous segment
 */
const astar = (
  start: Node,
  end: Node,
  grid: Grid,
  startHeading: Heading,
  endHeading: Heading,
  aabbs: Bounds[],
) => {
  const bendMultiplier = m_dist(start.pos, end.pos);
  const open = new BinaryHeap<Node>((node) => node.f);

  open.push(start);

  while (open.size() > 0) {
    // Grab the lowest f(x) to process next.  Heap keeps this sorted for us.
    const current = open.pop();

    if (!current || current.closed) {
      // Current is not passable, continue with next element
      continue;
    }

    // End case -- result has been found, return the traced path.
    if (current === end) {
      return pathTo(start, current);
    }

    // Normal case -- move current from open to closed, process each of its neighbors.
    current.closed = true;

    // Find all neighbors for the current node.
    const neighbors = getNeighbors(current.addr, grid);

    for (let i = 0; i < 4; i++) {
      const neighbor = neighbors[i];

      if (!neighbor || neighbor.closed) {
        // Not a valid node to process, skip to next neighbor.
        continue;
      }

      // Intersect
      const neighborHalfPoint = pointScaleFromOrigin(
        neighbor.pos,
        current.pos,
        0.5,
      );
      if (
        isAnyTrue(
          ...aabbs.map((aabb) => pointInsideBounds(neighborHalfPoint, aabb)),
        )
      ) {
        continue;
      }

      // The g score is the shortest distance from start to current node.
      // We need to check if the path we have arrived at this neighbor is the shortest one we have seen yet.
      const neighborHeading = neighborIndexToHeading(i as 0 | 1 | 2 | 3);
      const previousDirection = current.parent
        ? vectorToHeading(vectorFromPoint(current.pos, current.parent.pos))
        : startHeading;

      // Do not allow going in reverse
      const reverseHeading = flipHeading(previousDirection);
      const neighborIsReverseRoute =
        compareHeading(reverseHeading, neighborHeading) ||
        (gridAddressesEqual(start.addr, neighbor.addr) &&
          compareHeading(neighborHeading, startHeading)) ||
        (gridAddressesEqual(end.addr, neighbor.addr) &&
          compareHeading(neighborHeading, endHeading));
      if (neighborIsReverseRoute) {
        continue;
      }

      const directionChange = previousDirection !== neighborHeading;
      const gScore =
        current.g +
        m_dist(neighbor.pos, current.pos) +
        (directionChange ? Math.pow(bendMultiplier, 3) : 0);

      const beenVisited = neighbor.visited;

      if (!beenVisited || gScore < neighbor.g) {
        const estBendCount = estimateSegmentCount(
          neighbor,
          end,
          neighborHeading,
          endHeading,
        );
        // Found an optimal (so far) path to this node.  Take score for node to see how good it is.
        neighbor.visited = true;
        neighbor.parent = current;
        neighbor.h =
          m_dist(end.pos, neighbor.pos) +
          estBendCount * Math.pow(bendMultiplier, 2);
        neighbor.g = gScore;
        neighbor.f = neighbor.g + neighbor.h;
        if (!beenVisited) {
          // Pushing to heap will put it in proper place based on the 'f' value.
          open.push(neighbor);
        } else {
          // Already seen the node, but since it has been rescored we need to reorder it in the heap
          open.rescoreElement(neighbor);
        }
      }
    }
  }

  return null;
};

const pathTo = (start: Node, node: Node) => {
  let curr = node;
  const path = [];
  while (curr.parent) {
    path.unshift(curr);
    curr = curr.parent;
  }
  path.unshift(start);

  return path;
};

const m_dist = (a: GlobalPoint | LocalPoint, b: GlobalPoint | LocalPoint) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/**
 * Create dynamically resizing, always touching
 * bounding boxes having a minimum extent represented
 * by the given static bounds.
 */
const generateDynamicAABBs = (
  a: Bounds,
  b: Bounds,
  common: Bounds,
  startDifference?: [number, number, number, number],
  endDifference?: [number, number, number, number],
  disableSideHack?: boolean,
  startElementBounds?: Bounds | null,
  endElementBounds?: Bounds | null,
): Bounds[] => {
  const startEl = startElementBounds ?? a;
  const endEl = endElementBounds ?? b;
  const [startUp, startRight, startDown, startLeft] = startDifference ?? [
    0, 0, 0, 0,
  ];
  const [endUp, endRight, endDown, endLeft] = endDifference ?? [0, 0, 0, 0];

  const first = [
    a[0] > b[2]
      ? a[1] > b[3] || a[3] < b[1]
        ? Math.min((startEl[0] + endEl[2]) / 2, a[0] - startLeft)
        : (startEl[0] + endEl[2]) / 2
      : a[0] > b[0]
      ? a[0] - startLeft
      : common[0] - startLeft,
    a[1] > b[3]
      ? a[0] > b[2] || a[2] < b[0]
        ? Math.min((startEl[1] + endEl[3]) / 2, a[1] - startUp)
        : (startEl[1] + endEl[3]) / 2
      : a[1] > b[1]
      ? a[1] - startUp
      : common[1] - startUp,
    a[2] < b[0]
      ? a[1] > b[3] || a[3] < b[1]
        ? Math.max((startEl[2] + endEl[0]) / 2, a[2] + startRight)
        : (startEl[2] + endEl[0]) / 2
      : a[2] < b[2]
      ? a[2] + startRight
      : common[2] + startRight,
    a[3] < b[1]
      ? a[0] > b[2] || a[2] < b[0]
        ? Math.max((startEl[3] + endEl[1]) / 2, a[3] + startDown)
        : (startEl[3] + endEl[1]) / 2
      : a[3] < b[3]
      ? a[3] + startDown
      : common[3] + startDown,
  ] as Bounds;
  const second = [
    b[0] > a[2]
      ? b[1] > a[3] || b[3] < a[1]
        ? Math.min((endEl[0] + startEl[2]) / 2, b[0] - endLeft)
        : (endEl[0] + startEl[2]) / 2
      : b[0] > a[0]
      ? b[0] - endLeft
      : common[0] - endLeft,
    b[1] > a[3]
      ? b[0] > a[2] || b[2] < a[0]
        ? Math.min((endEl[1] + startEl[3]) / 2, b[1] - endUp)
        : (endEl[1] + startEl[3]) / 2
      : b[1] > a[1]
      ? b[1] - endUp
      : common[1] - endUp,
    b[2] < a[0]
      ? b[1] > a[3] || b[3] < a[1]
        ? Math.max((endEl[2] + startEl[0]) / 2, b[2] + endRight)
        : (endEl[2] + startEl[0]) / 2
      : b[2] < a[2]
      ? b[2] + endRight
      : common[2] + endRight,
    b[3] < a[1]
      ? b[0] > a[2] || b[2] < a[0]
        ? Math.max((endEl[3] + startEl[1]) / 2, b[3] + endDown)
        : (endEl[3] + startEl[1]) / 2
      : b[3] < a[3]
      ? b[3] + endDown
      : common[3] + endDown,
  ] as Bounds;

  const c = commonAABB([first, second]);
  if (
    !disableSideHack &&
    first[2] - first[0] + second[2] - second[0] > c[2] - c[0] + 0.00000000001 &&
    first[3] - first[1] + second[3] - second[1] > c[3] - c[1] + 0.00000000001
  ) {
    const [endCenterX, endCenterY] = [
      (second[0] + second[2]) / 2,
      (second[1] + second[3]) / 2,
    ];
    if (b[0] > a[2] && a[1] > b[3]) {
      // BOTTOM LEFT
      const cX = first[2] + (second[0] - first[2]) / 2;
      const cY = second[3] + (first[1] - second[3]) / 2;

      if (
        vectorCross(
          vector(a[2] - endCenterX, a[1] - endCenterY),
          vector(a[0] - endCenterX, a[3] - endCenterY),
        ) > 0
      ) {
        return [
          [first[0], first[1], cX, first[3]],
          [cX, second[1], second[2], second[3]],
        ];
      }

      return [
        [first[0], cY, first[2], first[3]],
        [second[0], second[1], second[2], cY],
      ];
    } else if (a[2] < b[0] && a[3] < b[1]) {
      // TOP LEFT
      const cX = first[2] + (second[0] - first[2]) / 2;
      const cY = first[3] + (second[1] - first[3]) / 2;

      if (
        vectorCross(
          vector(a[0] - endCenterX, a[1] - endCenterY),
          vector(a[2] - endCenterX, a[3] - endCenterY),
        ) > 0
      ) {
        return [
          [first[0], first[1], first[2], cY],
          [second[0], cY, second[2], second[3]],
        ];
      }

      return [
        [first[0], first[1], cX, first[3]],
        [cX, second[1], second[2], second[3]],
      ];
    } else if (a[0] > b[2] && a[3] < b[1]) {
      // TOP RIGHT
      const cX = second[2] + (first[0] - second[2]) / 2;
      const cY = first[3] + (second[1] - first[3]) / 2;

      if (
        vectorCross(
          vector(a[2] - endCenterX, a[1] - endCenterY),
          vector(a[0] - endCenterX, a[3] - endCenterY),
        ) > 0
      ) {
        return [
          [cX, first[1], first[2], first[3]],
          [second[0], second[1], cX, second[3]],
        ];
      }

      return [
        [first[0], first[1], first[2], cY],
        [second[0], cY, second[2], second[3]],
      ];
    } else if (a[0] > b[2] && a[1] > b[3]) {
      // BOTTOM RIGHT
      const cX = second[2] + (first[0] - second[2]) / 2;
      const cY = second[3] + (first[1] - second[3]) / 2;

      if (
        vectorCross(
          vector(a[0] - endCenterX, a[1] - endCenterY),
          vector(a[2] - endCenterX, a[3] - endCenterY),
        ) > 0
      ) {
        return [
          [cX, first[1], first[2], first[3]],
          [second[0], second[1], cX, second[3]],
        ];
      }

      return [
        [first[0], cY, first[2], first[3]],
        [second[0], second[1], second[2], cY],
      ];
    }
  }

  return [first, second];
};

/**
 * Calculates the grid which is used as nodes at
 * the grid line intersections by the A* algorithm.
 *
 * NOTE: This is not a uniform grid. It is built at
 * various intersections of bounding boxes.
 */
const calculateGrid = (
  aabbs: Bounds[],
  start: GlobalPoint,
  startHeading: Heading,
  end: GlobalPoint,
  endHeading: Heading,
  common: Bounds,
): Grid => {
  const horizontal = new Set<number>();
  const vertical = new Set<number>();

  if (startHeading === HEADING_LEFT || startHeading === HEADING_RIGHT) {
    vertical.add(start[1]);
  } else {
    horizontal.add(start[0]);
  }
  if (endHeading === HEADING_LEFT || endHeading === HEADING_RIGHT) {
    vertical.add(end[1]);
  } else {
    horizontal.add(end[0]);
  }

  aabbs.forEach((aabb) => {
    horizontal.add(aabb[0]);
    horizontal.add(aabb[2]);
    vertical.add(aabb[1]);
    vertical.add(aabb[3]);
  });

  horizontal.add(common[0]);
  horizontal.add(common[2]);
  vertical.add(common[1]);
  vertical.add(common[3]);

  const _vertical = Array.from(vertical).sort((a, b) => a - b);
  const _horizontal = Array.from(horizontal).sort((a, b) => a - b);

  return {
    row: _vertical.length,
    col: _horizontal.length,
    data: _vertical.flatMap((y, row) =>
      _horizontal.map(
        (x, col): Node => ({
          f: 0,
          g: 0,
          h: 0,
          closed: false,
          visited: false,
          parent: null,
          addr: [col, row] as GridAddress,
          pos: [x, y] as GlobalPoint,
        }),
      ),
    ),
  };
};

const getDonglePosition = (
  bounds: Bounds,
  heading: Heading,
  p: GlobalPoint,
): GlobalPoint => {
  switch (heading) {
    case HEADING_UP:
      return pointFrom(p[0], bounds[1]);
    case HEADING_RIGHT:
      return pointFrom(bounds[2], p[1]);
    case HEADING_DOWN:
      return pointFrom(p[0], bounds[3]);
  }
  return pointFrom(bounds[0], p[1]);
};

const estimateSegmentCount = (
  start: Node,
  end: Node,
  startHeading: Heading,
  endHeading: Heading,
) => {
  if (endHeading === HEADING_RIGHT) {
    switch (startHeading) {
      case HEADING_RIGHT: {
        if (start.pos[0] >= end.pos[0]) {
          return 4;
        }
        if (start.pos[1] === end.pos[1]) {
          return 0;
        }
        return 2;
      }
      case HEADING_UP:
        if (start.pos[1] > end.pos[1] && start.pos[0] < end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_DOWN:
        if (start.pos[1] < end.pos[1] && start.pos[0] < end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_LEFT:
        if (start.pos[1] === end.pos[1]) {
          return 4;
        }
        return 2;
    }
  } else if (endHeading === HEADING_LEFT) {
    switch (startHeading) {
      case HEADING_RIGHT:
        if (start.pos[1] === end.pos[1]) {
          return 4;
        }
        return 2;
      case HEADING_UP:
        if (start.pos[1] > end.pos[1] && start.pos[0] > end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_DOWN:
        if (start.pos[1] < end.pos[1] && start.pos[0] > end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_LEFT:
        if (start.pos[0] <= end.pos[0]) {
          return 4;
        }
        if (start.pos[1] === end.pos[1]) {
          return 0;
        }
        return 2;
    }
  } else if (endHeading === HEADING_UP) {
    switch (startHeading) {
      case HEADING_RIGHT:
        if (start.pos[1] > end.pos[1] && start.pos[0] < end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_UP:
        if (start.pos[1] >= end.pos[1]) {
          return 4;
        }
        if (start.pos[0] === end.pos[0]) {
          return 0;
        }
        return 2;
      case HEADING_DOWN:
        if (start.pos[0] === end.pos[0]) {
          return 4;
        }
        return 2;
      case HEADING_LEFT:
        if (start.pos[1] > end.pos[1] && start.pos[0] > end.pos[0]) {
          return 1;
        }
        return 3;
    }
  } else if (endHeading === HEADING_DOWN) {
    switch (startHeading) {
      case HEADING_RIGHT:
        if (start.pos[1] < end.pos[1] && start.pos[0] < end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_UP:
        if (start.pos[0] === end.pos[0]) {
          return 4;
        }
        return 2;
      case HEADING_DOWN:
        if (start.pos[1] <= end.pos[1]) {
          return 4;
        }
        if (start.pos[0] === end.pos[0]) {
          return 0;
        }
        return 2;
      case HEADING_LEFT:
        if (start.pos[1] < end.pos[1] && start.pos[0] > end.pos[0]) {
          return 1;
        }
        return 3;
    }
  }
  return 0;
};

/**
 * Get neighboring points for a gived grid address
 */
const getNeighbors = ([col, row]: [number, number], grid: Grid) =>
  [
    gridNodeFromAddr([col, row - 1], grid),
    gridNodeFromAddr([col + 1, row], grid),
    gridNodeFromAddr([col, row + 1], grid),
    gridNodeFromAddr([col - 1, row], grid),
  ] as [Node | null, Node | null, Node | null, Node | null];

const gridNodeFromAddr = (
  [col, row]: [col: number, row: number],
  grid: Grid,
): Node | null => {
  if (col < 0 || col >= grid.col || row < 0 || row >= grid.row) {
    return null;
  }

  return grid.data[row * grid.col + col] ?? null;
};

/**
 * Get node for global point on canvas (if exists)
 */
const pointToGridNode = (point: GlobalPoint, grid: Grid): Node | null => {
  for (let col = 0; col < grid.col; col++) {
    for (let row = 0; row < grid.row; row++) {
      const candidate = gridNodeFromAddr([col, row], grid);
      if (
        candidate &&
        point[0] === candidate.pos[0] &&
        point[1] === candidate.pos[1]
      ) {
        return candidate;
      }
    }
  }

  return null;
};

const commonAABB = (aabbs: Bounds[]): Bounds => [
  Math.min(...aabbs.map((aabb) => aabb[0])),
  Math.min(...aabbs.map((aabb) => aabb[1])),
  Math.max(...aabbs.map((aabb) => aabb[2])),
  Math.max(...aabbs.map((aabb) => aabb[3])),
];

/// #region Utils

const getBindableElementForId = (
  id: string,
  elementsMap: ElementsMap,
): ExcalidrawBindableElement | null => {
  const element = elementsMap.get(id);
  if (element && isBindableElement(element)) {
    return element;
  }

  return null;
};

const normalizeArrowElementUpdate = (
  global: GlobalPoint[],
  nextFixedSegments: readonly FixedSegment[] | null,
  startIsSpecial?: ExcalidrawElbowArrowElement["startIsSpecial"],
  endIsSpecial?: ExcalidrawElbowArrowElement["startIsSpecial"],
): {
  points: LocalPoint[];
  x: number;
  y: number;
  width: number;
  height: number;
  fixedSegments: readonly FixedSegment[] | null;
  startIsSpecial?: ExcalidrawElbowArrowElement["startIsSpecial"];
  endIsSpecial?: ExcalidrawElbowArrowElement["startIsSpecial"];
} => {
  const offsetX = global[0][0];
  const offsetY = global[0][1];
  let points = global.map((p) =>
    pointTranslate<GlobalPoint, LocalPoint>(
      p,
      vectorScale(vectorFromPoint(global[0]), -1),
    ),
  );

  // NOTE (mtolmacs): This is a temporary check to see if the normalization
  // creates an overly large arrow. This should be removed once we have an answer.
  if (
    offsetX < -MAX_POS ||
    offsetX > MAX_POS ||
    offsetY < -MAX_POS ||
    offsetY > MAX_POS ||
    offsetX + points[points.length - 1][0] < -MAX_POS ||
    offsetY + points[points.length - 1][0] > MAX_POS ||
    offsetX + points[points.length - 1][1] < -MAX_POS ||
    offsetY + points[points.length - 1][1] > MAX_POS
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
    pointFrom<LocalPoint>(clamp(x, -1e6, 1e6), clamp(y, -1e6, 1e6)),
  );

  return {
    points,
    x: clamp(offsetX, -1e6, 1e6),
    y: clamp(offsetY, -1e6, 1e6),
    fixedSegments:
      (nextFixedSegments?.length ?? 0) > 0 ? nextFixedSegments : null,
    ...getSizeFromPoints(points),
    startIsSpecial,
    endIsSpecial,
  };
};

const getElbowArrowCornerPoints = (points: GlobalPoint[]): GlobalPoint[] => {
  if (points.length > 1) {
    let previousHorizontal =
      Math.abs(points[0][1] - points[1][1]) <
      Math.abs(points[0][0] - points[1][0]);

    return points.filter((p, idx) => {
      // The very first and last points are always kept
      if (idx === 0 || idx === points.length - 1) {
        return true;
      }

      const next = points[idx + 1];
      const nextHorizontal =
        Math.abs(p[1] - next[1]) < Math.abs(p[0] - next[0]);
      if (previousHorizontal === nextHorizontal) {
        previousHorizontal = nextHorizontal;
        return false;
      }

      previousHorizontal = nextHorizontal;
      return true;
    });
  }

  return points;
};

const removeElbowArrowShortSegments = (
  points: GlobalPoint[],
): GlobalPoint[] => {
  if (points.length >= 4) {
    return points.filter((p, idx) => {
      if (idx === 0 || idx === points.length - 1) {
        return true;
      }

      const prev = points[idx - 1];
      const prevDist = pointDistance(prev, p);
      return prevDist > DEDUP_TRESHOLD;
    });
  }

  return points;
};

const neighborIndexToHeading = (idx: number): Heading => {
  switch (idx) {
    case 0:
      return HEADING_UP;
    case 1:
      return HEADING_RIGHT;
    case 2:
      return HEADING_DOWN;
  }
  return HEADING_LEFT;
};

const getGlobalPoint = (
  arrow: ExcalidrawElbowArrowElement,
  startOrEnd: "start" | "end",
  fixedPointRatio: [number, number] | undefined | null,
  initialPoint: GlobalPoint,
  elementsMap: ElementsMap,
  element?: ExcalidrawBindableElement | null,
  isDragging?: boolean,
  zoom?: AppState["zoom"],
): GlobalPoint => {
  if (isDragging) {
    if (
      element &&
      isPointInShape(initialPoint, getElementShape(element, elementsMap))
    ) {
      const snapPoint = bindPointToSnapToElementOutline(
        arrow,
        element,
        startOrEnd,
      );

      return snapToMid(element, snapPoint);
    }

    return initialPoint;
  }

  if (element) {
    const fixedGlobalPoint = getGlobalFixedPointForBindableElement(
      fixedPointRatio || [0, 0],
      element,
    );

    // NOTE: Resize scales the binding position point too, so we need to update it
    return Math.abs(
      distanceToBindableElement(element, fixedGlobalPoint) -
        FIXED_BINDING_DISTANCE,
    ) > 0.01
      ? bindPointToSnapToElementOutline(arrow, element, startOrEnd)
      : fixedGlobalPoint;
  }

  return initialPoint;
};

const getBindPointHeading = (
  p: GlobalPoint,
  otherPoint: GlobalPoint,
  hoveredElement: ExcalidrawBindableElement | null | undefined,
  origPoint: GlobalPoint,
): Heading =>
  getHeadingForElbowArrowSnap(
    p,
    otherPoint,
    hoveredElement,
    hoveredElement &&
      aabbForElement(
        hoveredElement,
        Array(4).fill(distanceToBindableElement(hoveredElement, p)) as [
          number,
          number,
          number,
          number,
        ],
      ),
    origPoint,
  );

const getHoveredElement = (
  origPoint: GlobalPoint,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly NonDeletedExcalidrawElement[],
  zoom?: AppState["zoom"],
) => {
  return getHoveredElementForBinding(
    tupleToCoors(origPoint),
    elements,
    elementsMap,
    zoom,
    true,
    true,
  );
};

const gridAddressesEqual = (a: GridAddress, b: GridAddress): boolean =>
  a[0] === b[0] && a[1] === b[1];

export const validateElbowPoints = <P extends GlobalPoint | LocalPoint>(
  points: readonly P[],
  tolerance: number = DEDUP_TRESHOLD,
) =>
  points
    .slice(1)
    .map(
      (p, i) =>
        Math.abs(p[0] - points[i][0]) < tolerance ||
        Math.abs(p[1] - points[i][1]) < tolerance,
    )
    .every(Boolean);
