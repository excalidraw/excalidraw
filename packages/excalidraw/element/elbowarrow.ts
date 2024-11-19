import {
  distanceToLineSegment,
  lineSegment,
  pointDistanceSq,
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
import {
  isAnyTrue,
  memo,
  multiDimensionalArrayDeepFilter,
  multiDimensionalArrayDeepFlatMapper,
  toBrandedType,
  tupleToCoors,
} from "../utils";
import { debugDrawBounds, debugDrawPoint } from "../visualdebug";
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
  headingIsHorizontal,
  headingIsVertical,
  vectorToHeading,
} from "./heading";
import type { ElementUpdate } from "./mutateElement";
import { newElement } from "./newElement";
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
  FractionalIndex,
  Ordered,
  Sequential,
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

const BASE_PADDING = 40;

const segmentListMerge = (
  oldFixedSegments: readonly FixedSegment[],
  newFixedSegments: readonly FixedSegment[],
): Sequential<FixedSegment> => {
  let fixedSegments = Array.from(oldFixedSegments);
  newFixedSegments.forEach((segment) => {
    if (segment.anchor == null) {
      // Delete segment request
      fixedSegments = fixedSegments.filter((s) => s.index !== segment.index);
    } else {
      const idx = fixedSegments.findIndex((s) => s.index === segment.index);
      if (idx > -1) {
        // Modify segment request
        fixedSegments[idx] = {
          anchor: segment.anchor,
          heading: fixedSegments[idx].heading,
          index: segment.index,
        };
      } else {
        // Add segment request
        fixedSegments.push(segment);
      }
    }
  });

  return fixedSegments.sort(
    (a, b) => a.index - b.index,
  ) as Sequential<FixedSegment>;
};

const generatePoints = memo(
  (
    state: ElbowArrowState,
    points: readonly LocalPoint[],
    segmentIdx: number,
    totalSegments: number,
    elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
    options?: {
      isDragging?: boolean;
    },
  ) =>
    routeElbowArrow(state, elementsMap, points, {
      ...options,
      ...(segmentIdx !== 0 ? { startIsMidPoint: true } : {}),
      ...(segmentIdx !== totalSegments ? { endIsMidPoint: true } : {}),
    }) ?? [],
);

const anchorPointToSegmentIndex = (
  points: GlobalPoint[],
  anchor: GlobalPoint,
  anchorIsHorizontal: boolean,
) => {
  let closestDistance = Infinity;
  return points
    .slice(1)
    .map(
      (point, idx) =>
        [
          distanceToLineSegment(anchor, lineSegment(points[idx], point)),
          Math.abs(points[idx][1] - point[1]) < 1,
          idx,
        ] as [number, boolean, number],
    )
    .filter(
      ([_, segmentIsHorizontal]) => segmentIsHorizontal === anchorIsHorizontal,
    )
    .reduce((acc, [distance, _, idx]) => {
      if (distance < closestDistance) {
        closestDistance = distance;
        return idx + 1;
      }

      return acc;
    }, 0);
};

/**
 *
 */
export const updateElbowArrowPoints = (
  arrow: ExcalidrawElbowArrowElement,
  elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
  updates: {
    points?: readonly LocalPoint[];
    fixedSegments?: FixedSegment[];
  },
  options?: {
    isDragging?: boolean;
  },
): ElementUpdate<ExcalidrawElbowArrowElement> => {
  const updatedPoints = Array.from(updates.points ?? arrow.points);

  const fakeElementsMap = toBrandedType<SceneElementsMap>(new Map(elementsMap));

  const nextFixedSegments = segmentListMerge(
    arrow.fixedSegments ?? [],
    updates?.fixedSegments ?? [],
  );

  const { startDonglePosition, endDonglePosition } = getElbowArrowData(
    arrow,
    elementsMap,
    updatedPoints,
  );

  // Start segment is getting fixed, need to fix the first point to origin
  if (nextFixedSegments[0]?.index === 1) {
    nextFixedSegments[0].index = 2;
    updatedPoints.unshift(pointFrom<LocalPoint>(0, 0));
  }

  let segmentStart: {
    startPoint: GlobalPoint;
    startFixedPoint: FixedPointBinding["fixedPoint"] | null;
    startElementId: string | null;
  } = {
    startPoint: pointFrom<GlobalPoint>(
      arrow.x + updatedPoints[0][0],
      arrow.y + updatedPoints[0][1],
    ),
    startFixedPoint: arrow.startBinding?.fixedPoint ?? null,
    startElementId: arrow.startBinding?.elementId ?? null,
  };

  const pointPairs: [ElbowArrowState, readonly LocalPoint[]][] =
    nextFixedSegments.map((segmentEnd, segmentIdx) => {
      // Determine if we need to flip the heading for visual appeal
      const startHandle: GlobalPoint = headingIsHorizontal(segmentEnd.heading)
        ? pointFrom(
            nextFixedSegments[segmentIdx - 1]?.anchor[0] ??
              startDonglePosition[0],
            segmentEnd.anchor[1],
          )
        : pointFrom(
            segmentEnd.anchor[0],
            nextFixedSegments[segmentIdx - 1]?.anchor[1] ??
              startDonglePosition[1],
          );
      const endHandle: GlobalPoint = headingIsHorizontal(segmentEnd.heading)
        ? pointFrom(
            nextFixedSegments[segmentIdx + 1]?.anchor[0] ??
              endDonglePosition[0],
            segmentEnd.anchor[1],
          )
        : pointFrom(
            segmentEnd.anchor[0],
            nextFixedSegments[segmentIdx + 1]?.anchor[1] ??
              endDonglePosition[1],
          );
      const heading = headingIsHorizontal(segmentEnd.heading)
        ? startHandle[0] < endHandle[0]
          ? HEADING_LEFT
          : HEADING_RIGHT
        : startHandle[1] < endHandle[1]
        ? HEADING_UP
        : HEADING_DOWN;
      nextFixedSegments[segmentIdx].heading = heading;

      // debugDrawPoint(startHandle, { color: "red" });
      // debugDrawPoint(endHandle, { color: "green" });

      // Calculate new anchor point (sliding anchor)
      const anchor = headingIsHorizontal(heading)
        ? pointFrom<GlobalPoint>(
            (startHandle[0] + endHandle[0]) / 2,
            segmentEnd.anchor[1],
          )
        : pointFrom<GlobalPoint>(
            segmentEnd.anchor[0],
            (startHandle[1] + endHandle[1]) / 2,
          );
      nextFixedSegments[segmentIdx].anchor = anchor;

      debugDrawPoint(anchor);

      const el = {
        ...newElement({
          type: "rectangle",
          x: anchor[0] - 0.1,
          y: anchor[1] - 0.1,
          width: 0.2,
          height: 0.2,
        }),
        index: "DONOTSYNC" as FractionalIndex,
      } as Ordered<ExcalidrawBindableElement>;
      fakeElementsMap.set(el.id, el);

      const endFixedPoint: [number, number] = compareHeading(
        heading,
        HEADING_DOWN,
      )
        ? [0.5, 1]
        : compareHeading(heading, HEADING_LEFT)
        ? [0, 0.5]
        : compareHeading(heading, HEADING_UP)
        ? [0.5, 0]
        : [1, 0.5];

      const state = {
        x: segmentStart.startPoint[0],
        y: segmentStart.startPoint[1],
        startArrowhead: segmentIdx === 0 ? arrow.startArrowhead : null,
        endArrowhead: null as Arrowhead | null,
        startBinding:
          segmentIdx === 0
            ? arrow.startBinding
            : {
                elementId: segmentStart.startElementId!,
                focus: 0,
                gap: 0,
                fixedPoint: segmentStart.startFixedPoint!,
              },
        endBinding: {
          elementId: el.id,
          focus: 0,
          gap: 0,
          fixedPoint: endFixedPoint,
        },
      };
      const nextStartFixedPoint: [number, number] = compareHeading(
        heading,
        HEADING_DOWN,
      )
        ? [0.5, 0]
        : compareHeading(heading, HEADING_LEFT)
        ? [1, 0.5]
        : compareHeading(heading, HEADING_UP)
        ? [0.5, 1]
        : [0, 0.5];
      const segmentEndGlobalPoint = getGlobalFixedPointForBindableElement(
        endFixedPoint,
        el,
      );
      const endLocalPoint = pointFrom<LocalPoint>(
        segmentEndGlobalPoint[0] - segmentStart.startPoint[0],
        segmentEndGlobalPoint[1] - segmentStart.startPoint[1],
      );

      segmentStart = {
        startPoint: getGlobalFixedPointForBindableElement(
          nextStartFixedPoint,
          el,
        ),
        startFixedPoint: nextStartFixedPoint,
        startElementId: el.id,
      };

      return [state, [pointFrom<LocalPoint>(0, 0), endLocalPoint]];
    });
  pointPairs.push([
    {
      x: segmentStart.startPoint[0],
      y: segmentStart.startPoint[1],
      startArrowhead: null,
      endArrowhead: arrow.endArrowhead,
      startBinding:
        nextFixedSegments.length === 0
          ? arrow.startBinding
          : {
              elementId: segmentStart.startElementId!,
              focus: 0,
              gap: 0,
              fixedPoint: segmentStart.startFixedPoint!,
            },
      endBinding: arrow.endBinding,
    },
    [
      pointFrom<LocalPoint>(0, 0),
      // Translate from unsegmented local array point -> global point -> last segment local point
      pointFrom<LocalPoint>(
        arrow.x +
          updatedPoints[updatedPoints.length - 1][0] -
          segmentStart.startPoint[0],
        arrow.y +
          updatedPoints[updatedPoints.length - 1][1] -
          segmentStart.startPoint[1],
      ),
    ],
  ]);

  const simplifiedPoints = getElbowArrowCornerPoints(
    removeElbowArrowShortSegments(
      pointPairs.map(([state, points], idx) =>
        generatePoints(
          state,
          points,
          idx,
          pointPairs.length - 1,
          fakeElementsMap,
          options,
        ),
      ),
    ),
  ).flat();

  return normalizeArrowElementUpdate(
    simplifiedPoints,
    nextFixedSegments.map((segment) => {
      segment.index = anchorPointToSegmentIndex(
        simplifiedPoints,
        segment.anchor,
        headingIsHorizontal(segment.heading),
      );

      // TODO: Debug only, remove
      if (segment.index === 0) {
        console.warn("Segment index is 0!");
        debugDrawPoint(segment.anchor, { color: "red", permanent: true });
      }

      if (segment.index === 1) {
        segment.index = 2;
      }

      return segment;
    }) as Sequential<FixedSegment>,
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
    startIsMidPoint?: boolean;
    endIsMidPoint?: boolean;
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
  const startGlobalPoint = options?.startIsMidPoint
    ? origStartGlobalPoint
    : getGlobalPoint(
        arrow.startBinding?.fixedPoint,
        origStartGlobalPoint,
        origEndGlobalPoint,
        elementsMap,
        startElement,
        hoveredStartElement,

        options?.isDragging,
      );
  const endGlobalPoint = options?.endIsMidPoint
    ? origEndGlobalPoint
    : getGlobalPoint(
        arrow.endBinding?.fixedPoint,
        origEndGlobalPoint,
        origStartGlobalPoint,
        elementsMap,
        endElement,
        hoveredEndElement,
        options?.isDragging,
      );
  const startHeading = getBindPointHeading(
    startGlobalPoint,
    endGlobalPoint,
    elementsMap,
    hoveredStartElement,
    origStartGlobalPoint,
  );
  const endHeading = getBindPointHeading(
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
            : options?.startIsMidPoint
            ? 0.01
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
            : options?.endIsMidPoint
            ? 0.01
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
    boundsOverlap && !(options?.startIsMidPoint || options?.endIsMidPoint)
      ? [startPointBounds, endPointBounds]
      : [startElementBounds, endElementBounds],
  );
  const dynamicAABBs =
    options?.startIsMidPoint || options?.endIsMidPoint
      ? generateSegmentedDynamicAABBs(
          padAABB(
            startElementBounds,
            options?.startIsMidPoint
              ? [0, 0, 0, 0]
              : offsetFromHeading(
                  startHeading,
                  BASE_PADDING -
                    (arrow.startArrowhead
                      ? FIXED_BINDING_DISTANCE * 6
                      : FIXED_BINDING_DISTANCE * 2),
                  BASE_PADDING,
                ),
          ),
          padAABB(
            endElementBounds,
            options?.endIsMidPoint
              ? [0, 0, 0, 0]
              : offsetFromHeading(
                  endHeading,
                  BASE_PADDING -
                    (arrow.endArrowhead
                      ? FIXED_BINDING_DISTANCE * 6
                      : FIXED_BINDING_DISTANCE * 2),
                  BASE_PADDING,
                ),
          ),
          options?.startIsMidPoint,
          options?.endIsMidPoint,
        )
      : generateDynamicAABBs(
          options?.startIsMidPoint
            ? ([
                hoveredStartElement!.x + hoveredStartElement!.width / 2 - 1,
                hoveredStartElement!.y + hoveredStartElement!.height / 2 - 1,
                hoveredStartElement!.x + hoveredStartElement!.width / 2 + 1,
                hoveredStartElement!.y + hoveredStartElement!.height / 2 + 1,
              ] as Bounds)
            : boundsOverlap &&
              !(options?.startIsMidPoint || options?.endIsMidPoint)
            ? startPointBounds
            : startElementBounds,
          options?.endIsMidPoint
            ? ([
                hoveredEndElement!.x + hoveredEndElement!.width / 2 - 1,
                hoveredEndElement!.y + hoveredEndElement!.height / 2 - 1,
                hoveredEndElement!.x + hoveredEndElement!.width / 2 + 1,
                hoveredEndElement!.y + hoveredEndElement!.height / 2 + 1,
              ] as Bounds)
            : boundsOverlap &&
              !(options?.startIsMidPoint || options?.endIsMidPoint)
            ? endPointBounds
            : endElementBounds,
          commonBounds,
          options?.startIsMidPoint
            ? [0, 0, 0, 0]
            : boundsOverlap &&
              !(options?.startIsMidPoint || options?.endIsMidPoint)
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
          options?.endIsMidPoint
            ? [0, 0, 0, 0]
            : boundsOverlap &&
              !(options?.startIsMidPoint || options?.endIsMidPoint)
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
          boundsOverlap &&
            !(options?.startIsMidPoint || options?.endIsMidPoint),
          hoveredStartElement && aabbForElement(hoveredStartElement),
          hoveredEndElement && aabbForElement(hoveredEndElement),
          options?.endIsMidPoint,
          options?.startIsMidPoint,
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
  elementsMap: NonDeletedSceneElementsMap | SceneElementsMap,
  nextPoints: readonly LocalPoint[],
  options?: {
    isDragging?: boolean;
    startIsMidPoint?: boolean;
    endIsMidPoint?: boolean;
  },
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
  } = getElbowArrowData(arrow, elementsMap, nextPoints, options);

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

const padAABB = (bounds: Bounds, offset: [number, number, number, number]) =>
  [
    bounds[0] - offset[3],
    bounds[1] - offset[0],
    bounds[2] + offset[1],
    bounds[3] + offset[2],
  ] as Bounds;

const generateSegmentedDynamicAABBs = (
  a: Bounds,
  b: Bounds,
  startIsMidPoint?: boolean,
  endIsMidPoint?: boolean,
) => {
  let first: Bounds = a;
  let second: Bounds = b;

  if (startIsMidPoint) {
    first = [
      Math.min(a[0], b[2]),
      Math.min(a[1], b[3]),
      Math.max(a[2], b[0]),
      Math.max(a[3], b[1]),
    ];
  }
  if (endIsMidPoint) {
    second = [
      Math.min(b[0], a[2]),
      Math.min(b[1], a[3]),
      Math.max(b[2], a[0]),
      Math.max(b[3], a[1]),
    ];
  }

  return [first, second];
};

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
  nextFixedSegments: Sequential<FixedSegment> | null,
): {
  points: LocalPoint[];
  x: number;
  y: number;
  width: number;
  height: number;
  fixedSegments: Sequential<FixedSegment> | null;
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
    fixedSegments: nextFixedSegments?.length ? nextFixedSegments : null,
    ...getSizeFromPoints(points),
  };
};

const getElbowArrowCornerPoints = (
  pointGroups: GlobalPoint[][],
): GlobalPoint[][] => {
  const points = pointGroups.flat();

  if (points.length > 1) {
    let previousHorizontal =
      Math.abs(points[0][1] - points[1][1]) <
      Math.abs(points[0][0] - points[1][0]);

    const ret = multiDimensionalArrayDeepFilter(pointGroups, (p, idx) => {
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

    return ret;
  }

  return pointGroups;
};

const removeElbowArrowShortSegments = (
  pointGroups: GlobalPoint[][],
): GlobalPoint[][] => {
  const points = pointGroups.flat();

  if (points.length >= 4) {
    return multiDimensionalArrayDeepFilter(pointGroups, (p, idx) => {
      if (idx === 0 || idx === points.length - 1) {
        return true;
      }

      const prev = points[idx - 1];
      return pointDistanceSq(prev, p) >= 1;
    });
  }

  return pointGroups;
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
