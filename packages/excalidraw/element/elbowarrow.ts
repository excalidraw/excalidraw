import {
  pointDistance,
  pointFrom,
  pointScaleFromOrigin,
  pointTranslate,
  vector,
  vectorCross,
  vectorFromPoint,
  vectorScale,
  type GlobalPoint,
  type LocalPoint,
} from "../../math";
import BinaryHeap from "../binaryheap";
import { getSizeFromPoints } from "../points";
import { aabbForElement, pointInsideBounds } from "../shapes";
import { invariant, isAnyTrue, toBrandedType, tupleToCoors } from "../utils";
import { debugClear, debugDrawPoint } from "../visualdebug";
import {
  bindPointToSnapToElementOutline,
  distanceToBindableElement,
  avoidRectangularCorner,
  getHoveredElementForBinding,
  FIXED_BINDING_DISTANCE,
  getHeadingForElbowArrowSnap,
  getGlobalFixedPointForBindableElement,
  snapToMid,
} from "./binding";
import type { Bounds } from "./bounds";
import type { Heading } from "./heading";
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
} from "./heading";
import type { ElementUpdate } from "./mutateElement";
import { isBindableElement, isRectanguloidElement } from "./typeChecks";
import {
  type ExcalidrawElbowArrowElement,
  type NonDeletedSceneElementsMap,
  type SceneElementsMap,
} from "./types";
import type {
  Arrowhead,
  ElementsMap,
  ExcalidrawBindableElement,
  FixedPointBinding,
  FixedSegment,
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

const BASE_PADDING = 40;

const handleSegmentRelease = (
  arrow: ExcalidrawElbowArrowElement,
  fixedSegments: FixedSegment[],
  elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
  updatedPoints: readonly LocalPoint[],
  options?: {
    isDragging?: boolean;
  },
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

  // We need to non-fixed arrow path to restore deleted segments
  const {
    startHeading,
    endHeading,
    startGlobalPoint,
    endGlobalPoint,
    hoveredStartElement,
    hoveredEndElement,
    ...rest
  } = getElbowArrowData(arrow, elementsMap, updatedPoints, options);

  const { points } = normalizeArrowElementUpdate(
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

  let start = points[deletedIdx - 1];
  let end = points[deletedIdx];
  let nextPoints = arrow.points;
  let nextFixedSegments = fixedSegments;

  if (points.length === arrow.points.length) {
    nextFixedSegments = fixedSegments.map((segment) => {
      const isHorizontal = headingForPointIsHorizontal(
        segment.start,
        segment.end,
      );
      let segmentEnd = segment.end;
      let segmentStart = segment.start;

      if (segment.index === deletedIdx - 1) {
        start = pointFrom<LocalPoint>(
          isHorizontal ? points[deletedIdx - 1][0] : segment.end[0],
          !isHorizontal ? points[deletedIdx - 1][1] : segment.end[1],
        );
        segmentEnd = start;
      }

      if (segment.index === deletedIdx + 1) {
        end = pointFrom<LocalPoint>(
          isHorizontal ? points[deletedIdx][0] : segment.start[0],
          !isHorizontal ? points[deletedIdx][1] : segment.start[1],
        );
        segmentStart = end;
      }

      return {
        ...segment,
        start: segmentStart,
        end: segmentEnd,
      };
    });

    nextPoints = arrow.points.map((p, i) => {
      if (
        !arrow.startIsSpecial &&
        !arrow.endIsSpecial &&
        i === deletedIdx - 1
      ) {
        return start;
      }
      if (!arrow.startIsSpecial && !arrow.endIsSpecial && i === deletedIdx) {
        return end;
      }
      return p;
    });
  }

  return normalizeArrowElementUpdate(
    nextPoints.map((p) =>
      pointFrom<GlobalPoint>(arrow.x + p[0], arrow.y + p[1]),
    ),
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
  fixedSegments: FixedSegment[],
  elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
  updatedPoints: readonly LocalPoint[],
  options?: {
    isDragging?: boolean;
  },
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
  const start = structuredClone(
    nextFixedSegments[activelyModifiedSegmentIdx].start,
  );
  const end = structuredClone(
    nextFixedSegments[activelyModifiedSegmentIdx].end,
  );

  // Override the segment points with the actively moved fixed segment
  newPoints[startIdx] = start;
  newPoints[endIdx] = end;

  // Override neighboring fixedSegment start/end points, if any
  const prevSegmentIdx = nextFixedSegments.findIndex(
    (segment) => segment.index === startIdx,
  );
  if (prevSegmentIdx !== -1) {
    nextFixedSegments[prevSegmentIdx].end = start;
  }
  const nextSegmentIdx = nextFixedSegments.findIndex(
    (segment) => segment.index === endIdx + 1,
  );
  if (nextSegmentIdx !== -1) {
    nextFixedSegments[nextSegmentIdx].start = end;
  }

  // First segment move needs an additional segment
  if (nextFixedSegments[0].index === 1) {
    newPoints.unshift(
      pointFrom<GlobalPoint>(
        arrow.x + arrow.points[0][0],
        arrow.y + arrow.points[0][1],
      ),
    );

    for (const segment of nextFixedSegments) {
      segment.index += 1;
    }
  }

  if (
    nextFixedSegments[nextFixedSegments.length - 1].index ===
    newPoints.length - 1
  ) {
    // Last segment move needs an additional segment
    newPoints.push(
      pointFrom<GlobalPoint>(
        arrow.x + arrow.points[arrow.points.length - 1][0],
        arrow.y + arrow.points[arrow.points.length - 1][1],
      ),
    );
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

const handleEndpointMove = (
  arrow: ExcalidrawElbowArrowElement,
  updatedPoints: readonly LocalPoint[],
  fixedSegments: FixedSegment[],
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

/**
 *
 */
export const updateElbowArrowPoints = (
  arrow: Readonly<ExcalidrawElbowArrowElement>,
  elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
  updates: {
    points?: readonly LocalPoint[];
    fixedSegments?: FixedSegment[] | null;
  },
  options?: {
    isDragging?: boolean;
  },
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  debugClear();
  arrow.fixedSegments?.forEach((segment) => {
    debugDrawPoint(
      pointFrom<GlobalPoint>(
        arrow.x + segment.start[0],
        arrow.y + segment.start[1],
      ),
      { color: "green", permanent: true, fuzzy: true },
    );
    debugDrawPoint(
      pointFrom<GlobalPoint>(
        arrow.x + segment.end[0],
        arrow.y + segment.end[1],
      ),
      { color: "red", permanent: true, fuzzy: true },
    );
  });
  console.log();

  if (arrow.points.length < 2) {
    return { points: updates.points ?? arrow.points };
  }

  invariant(
    !updates.points ||
      arrow.points.length === updates.points.length ||
      updates.points.length === 2,
    "Updated point array length must match the arrow point length, contain " +
      "exactly the new start and end points or not be specified at all (i.e. " +
      "you can't add new points between start and end manually to elbow arrows)",
  );

  const updatedPoints: readonly LocalPoint[] = updates.points
    ? updates.points && updates.points.length === 2
      ? arrow.points.map((p, idx) =>
          idx === 0
            ? updates.points![0]
            : idx === arrow.points.length - 1
            ? updates.points![1]
            : p,
        )
      : structuredClone(updates.points)
    : structuredClone(arrow.points);

  const {
    startHeading,
    endHeading,
    startGlobalPoint,
    endGlobalPoint,
    hoveredStartElement,
    hoveredEndElement,
    ...rest
  } = getElbowArrowData(arrow, elementsMap, updatedPoints, options);

  const fixedSegments = updates.fixedSegments ?? arrow.fixedSegments ?? [];

  ////
  // 1. Just normal elbow arrow things
  ////
  if (fixedSegments.length === 0) {
    const simplifiedPoints = getElbowArrowCornerPoints(
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
    );

    return normalizeArrowElementUpdate(
      simplifiedPoints,
      fixedSegments,
      null,
      null,
    );
  }

  ////
  // 2. Handle releasing a fixed segment
  if ((arrow.fixedSegments?.length ?? 0) > fixedSegments.length) {
    return handleSegmentRelease(
      arrow,
      fixedSegments,
      elementsMap,
      updatedPoints,
      options,
    );
  }

  ////
  // 3. Handle manual segment move
  ////
  if (!updates.points) {
    return handleSegmentMove(
      arrow,
      fixedSegments,
      elementsMap,
      updatedPoints,
      options,
    );
  }

  ////
  // 4. One or more segments are fixed and endpoints are moved
  //
  // The key insights are:
  // - When segments are fixed, the arrow will keep the exact amount of segments
  // - Fixed segments are "replacements" for exactly one segment in the old arrow
  ////
  return handleEndpointMove(
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
  },
  elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
  nextPoints: readonly LocalPoint[],
  options?: {
    isDragging?: boolean;
    startMidPointHeading?: Heading;
    endMidPointHeading?: Heading;
    forcedStartHeading?: Heading;
    forcedEndHeading?: Heading;
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
  const startElement =
    arrow.startBinding &&
    getBindableElementForId(arrow.startBinding.elementId, elementsMap);
  const endElement =
    arrow.endBinding &&
    getBindableElementForId(arrow.endBinding.elementId, elementsMap);
  const [hoveredStartElement, hoveredEndElement] = options?.isDragging
    ? getHoveredElements(origStartGlobalPoint, origEndGlobalPoint, elementsMap)
    : [startElement, endElement];
  const startGlobalPoint = getGlobalPoint(
    arrow.startBinding?.fixedPoint,
    origStartGlobalPoint,
    origEndGlobalPoint,
    elementsMap,
    startElement,
    hoveredStartElement,
    options?.isDragging,
  );
  const endGlobalPoint = getGlobalPoint(
    arrow.endBinding?.fixedPoint,
    origEndGlobalPoint,
    origStartGlobalPoint,
    elementsMap,
    endElement,
    hoveredEndElement,
    options?.isDragging,
  );
  const startHeading = options?.forcedStartHeading
    ? options.forcedStartHeading
    : getBindPointHeading(
        startGlobalPoint,
        endGlobalPoint,
        elementsMap,
        hoveredStartElement,
        origStartGlobalPoint,
      );
  const endHeading = options?.forcedEndHeading
    ? options.forcedEndHeading
    : getBindPointHeading(
        endGlobalPoint,
        startGlobalPoint,
        elementsMap,
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
      : [
          options?.endMidPointHeading ? startPointBounds : startElementBounds,
          options?.startMidPointHeading ? endPointBounds : endElementBounds,
        ],
  );
  const dynamicAABBCandidates = generateDynamicAABBs(
    options?.endMidPointHeading || boundsOverlap
      ? startPointBounds
      : startElementBounds,
    options?.startMidPointHeading || boundsOverlap
      ? endPointBounds
      : endElementBounds,
    commonBounds,
    options?.endMidPointHeading
      ? [0, 0, 0, 0]
      : boundsOverlap
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
    options?.startMidPointHeading
      ? [0, 0, 0, 0]
      : boundsOverlap
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
  const dynamicAABBs = [
    (!options?.endMidPointHeading && !options?.startMidPointHeading) ||
    (options?.endMidPointHeading && !options?.startMidPointHeading)
      ? dynamicAABBCandidates[0]
      : startPointBounds,
    (!options?.startMidPointHeading && !options?.endMidPointHeading) ||
    (options?.startMidPointHeading && !options?.endMidPointHeading)
      ? dynamicAABBCandidates[1]
      : endPointBounds,
  ];
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
  disableSlideUnderForFirst?: boolean,
  disableSlideUnderForSecond?: boolean,
): Bounds[] => {
  const startEl = startElementBounds ?? a;
  const endEl = endElementBounds ?? b;
  const [startUp, startRight, startDown, startLeft] = startDifference ?? [
    0, 0, 0, 0,
  ];
  const [endUp, endRight, endDown, endLeft] = endDifference ?? [0, 0, 0, 0];

  const first = [
    a[0] > b[2]
      ? !disableSlideUnderForFirst && (a[1] > b[3] || a[3] < b[1])
        ? Math.min((startEl[0] + endEl[2]) / 2, a[0] - startLeft)
        : (startEl[0] + endEl[2]) / 2
      : a[0] > b[0]
      ? a[0] - startLeft
      : common[0] - startLeft,
    a[1] > b[3]
      ? !disableSlideUnderForFirst && (a[0] > b[2] || a[2] < b[0])
        ? Math.min((startEl[1] + endEl[3]) / 2, a[1] - startUp)
        : (startEl[1] + endEl[3]) / 2
      : a[1] > b[1]
      ? a[1] - startUp
      : common[1] - startUp,
    a[2] < b[0]
      ? !disableSlideUnderForFirst && (a[1] > b[3] || a[3] < b[1])
        ? Math.max((startEl[2] + endEl[0]) / 2, a[2] + startRight)
        : (startEl[2] + endEl[0]) / 2
      : a[2] < b[2]
      ? a[2] + startRight
      : common[2] + startRight,
    a[3] < b[1]
      ? !disableSlideUnderForFirst && (a[0] > b[2] || a[2] < b[0])
        ? Math.max((startEl[3] + endEl[1]) / 2, a[3] + startDown)
        : (startEl[3] + endEl[1]) / 2
      : a[3] < b[3]
      ? a[3] + startDown
      : common[3] + startDown,
  ] as Bounds;
  const second = [
    b[0] > a[2]
      ? !disableSlideUnderForSecond && (b[1] > a[3] || b[3] < a[1])
        ? Math.min((endEl[0] + startEl[2]) / 2, b[0] - endLeft)
        : (endEl[0] + startEl[2]) / 2
      : b[0] > a[0]
      ? b[0] - endLeft
      : common[0] - endLeft,
    b[1] > a[3]
      ? !disableSlideUnderForSecond && (b[0] > a[2] || b[2] < a[0])
        ? Math.min((endEl[1] + startEl[3]) / 2, b[1] - endUp)
        : (endEl[1] + startEl[3]) / 2
      : b[1] > a[1]
      ? b[1] - endUp
      : common[1] - endUp,
    b[2] < a[0]
      ? !disableSlideUnderForSecond && (b[1] > a[3] || b[3] < a[1])
        ? Math.max((endEl[2] + startEl[0]) / 2, b[2] + endRight)
        : (endEl[2] + startEl[0]) / 2
      : b[2] < a[2]
      ? b[2] + endRight
      : common[2] + endRight,
    b[3] < a[1]
      ? !disableSlideUnderForSecond && (b[0] > a[2] || b[2] < a[0])
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
  nextFixedSegments: FixedSegment[] | null,
  startIsSpecial?: boolean | null,
  endIsSpecial?: boolean | null,
): {
  points: LocalPoint[];
  x: number;
  y: number;
  width: number;
  height: number;
  fixedSegments: FixedSegment[] | null;
  startIsSpecial?: boolean | null;
  endIsSpecial?: boolean | null;
} => {
  const offsetX = global[0][0];
  const offsetY = global[0][1];

  const points = global.map((p) =>
    pointTranslate<GlobalPoint, LocalPoint>(
      p,
      vectorScale(vectorFromPoint(global[0]), -1),
    ),
  );

  return {
    points,
    x: offsetX,
    y: offsetY,
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
      return prevDist > 0.3;
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
  fixedPointRatio: [number, number] | undefined | null,
  initialPoint: GlobalPoint,
  otherPoint: GlobalPoint,
  elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
  boundElement?: ExcalidrawBindableElement | null,
  hoveredElement?: ExcalidrawBindableElement | null,
  isDragging?: boolean,
): GlobalPoint => {
  if (isDragging) {
    if (hoveredElement) {
      const snapPoint = getSnapPoint(
        initialPoint,
        otherPoint,
        hoveredElement,
        elementsMap,
      );

      return snapToMid(hoveredElement, snapPoint);
    }

    return initialPoint;
  }

  if (boundElement) {
    const fixedGlobalPoint = getGlobalFixedPointForBindableElement(
      fixedPointRatio || [0, 0],
      boundElement,
    );

    // NOTE: Resize scales the binding position point too, so we need to update it
    return Math.abs(
      distanceToBindableElement(boundElement, fixedGlobalPoint, elementsMap) -
        FIXED_BINDING_DISTANCE,
    ) > 0.01
      ? getSnapPoint(initialPoint, otherPoint, boundElement, elementsMap)
      : fixedGlobalPoint;
  }

  return initialPoint;
};

const getSnapPoint = (
  p: GlobalPoint,
  otherPoint: GlobalPoint,
  element: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
) =>
  bindPointToSnapToElementOutline(
    isRectanguloidElement(element) ? avoidRectangularCorner(element, p) : p,
    otherPoint,
    element,
    elementsMap,
  );

const getBindPointHeading = (
  p: GlobalPoint,
  otherPoint: GlobalPoint,
  elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
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
        Array(4).fill(
          distanceToBindableElement(hoveredElement, p, elementsMap),
        ) as [number, number, number, number],
      ),
    elementsMap,
    origPoint,
  );

const getHoveredElements = (
  origStartGlobalPoint: GlobalPoint,
  origEndGlobalPoint: GlobalPoint,
  elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
) => {
  // TODO: Might be a performance bottleneck and the Map type
  // remembers the insertion order anyway...
  const nonDeletedSceneElementsMap = toBrandedType<NonDeletedSceneElementsMap>(
    new Map([...elementsMap].filter((el) => !el[1].isDeleted)),
  );
  const elements = Array.from(elementsMap.values());
  return [
    getHoveredElementForBinding(
      tupleToCoors(origStartGlobalPoint),
      elements,
      nonDeletedSceneElementsMap,
      true,
    ),
    getHoveredElementForBinding(
      tupleToCoors(origEndGlobalPoint),
      elements,
      nonDeletedSceneElementsMap,
      true,
    ),
  ];
};

const gridAddressesEqual = (a: GridAddress, b: GridAddress): boolean =>
  a[0] === b[0] && a[1] === b[1];
