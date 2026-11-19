/**
 * Elbow arrow routing: given an arrow's endpoints and the elements they are
 * bound to (or hovering over), finds the orthogonal route between them.
 *
 * The route is the "simple" one with one or two corners when that fits
 * (see {@link getSimpleRoute}), or else found by A* on a sparse grid built
 * from the bounding boxes around the endpoints (see {@link getGridRoute}).
 *
 * Editing an existing route (moving and fixing segments, dragging endpoints of
 * an arrow with fixed segments) lives in `elbowArrow.ts`.
 */

import {
  pointDistance,
  pointFrom,
  pointScaleFromOrigin,
  pointTranslate,
  vector,
  vectorCross,
  vectorFromPoint,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";

import { type Bounds, BinaryHeap, DEFAULT_ZOOM } from "@excalidraw/common";

import type { AppState } from "@excalidraw/excalidraw/types";

import {
  bindPointToSnapToElementOutline,
  getHeadingForElbowArrowSnap,
  getGlobalFixedPointForBindableElement,
  getBindingGap,
  BASE_BINDING_GAP,
} from "./binding";
import { distanceToElement } from "./distance";
import {
  compareHeading,
  flipHeading,
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  headingIsHorizontal,
  vectorToHeading,
} from "./heading";
import { isBindableElement } from "./typeChecks";
import {
  aabbForElement,
  doBoundsIntersect,
  getArrowheadSize,
  pointInsideBounds,
} from "./bounds";
import { getHoveredElementForBinding } from "./collision";
import { ELBOW_ARROW_CORNER_RADIUS } from "./shape";

import type { Heading } from "./heading";
import type {
  Arrowhead,
  ElementsMap,
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
  FixedPointBinding,
  NonDeletedSceneElementsMap,
} from "./types";

/** The clearance an elbow arrow keeps around the elements it connects */
export const BASE_PADDING = 40;

/** Segments shorter than this are considered degenerate and get removed */
export const DEDUP_THRESHOLD = 1;

/** What routing needs to know about the arrow */
export type ElbowArrowState = {
  x: number;
  y: number;
  startBinding: FixedPointBinding | null;
  endBinding: FixedPointBinding | null;
  startArrowhead: Arrowhead | null;
  endArrowhead: Arrowhead | null;
};

export type ElbowArrowRoutingOptions = {
  isDragging?: boolean;
  zoom?: AppState["zoom"];
  isBindingEnabled?: boolean;
  isMidpointSnappingEnabled?: boolean;
};

/** The endpoints of an elbow arrow and the space around them, for routing */
export type ElbowArrowData = {
  /** The endpoints in scene coordinates, snapped to their elements if bound */
  startGlobalPoint: GlobalPoint;
  endGlobalPoint: GlobalPoint;
  /** The directions the arrow leaves its start, and enters its end, from */
  startHeading: Heading;
  endHeading: Heading;
  /** The elements the endpoints are bound to, or hover over while dragging */
  hoveredStartElement: ExcalidrawBindableElement | null;
  hoveredEndElement: ExcalidrawBindableElement | null;
  /**
   * The boxes the route has to go around: the space claimed by each endpoint
   * (its element and padding), grown until the two boxes touch
   */
  dynamicAABBs: Bounds[];
  /** The bounds of both endpoints' boxes before they were grown */
  commonBounds: Bounds;
  /**
   * Where the route leaves the start's box (and enters the end's), straight
   * out from the endpoint along its heading
   */
  startDonglePosition: GlobalPoint;
  endDonglePosition: GlobalPoint;
};

type GridAddress = [col: number, row: number] & { _brand: "gridaddress" };

/** A* node at a grid line intersection */
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
  data: Node[];
};

type BoundsOffset = [up: number, right: number, down: number, left: number];

// -----------------------------------------------------------------------------
// Endpoint analysis
// -----------------------------------------------------------------------------

export const getBindableElementForId = (
  id: string,
  elementsMap: ElementsMap,
): ExcalidrawBindableElement | null => {
  const element = elementsMap.get(id);
  if (element && isBindableElement(element)) {
    return element;
  }

  return null;
};

/** An arrowhead needs a bigger gap from the element than a bare line end */
const arrowheadGapFactor = (arrowhead: Arrowhead | null) => (arrowhead ? 6 : 2);

/**
 * Works out where the arrow's (moved) endpoints are, which elements they
 * connect, which way they face, and the boxes the route goes around.
 *
 * While dragging, the endpoints bind to (and snap onto) the elements under
 * them; otherwise they stay on the elements of the arrow's bindings.
 */
export const getElbowArrowData = (
  arrow: ElbowArrowState & { points: readonly LocalPoint[] },
  elementsMap: NonDeletedSceneElementsMap,
  nextPoints: readonly LocalPoint[],
  options?: ElbowArrowRoutingOptions,
): ElbowArrowData => {
  const origin = vector(arrow.x, arrow.y);
  const origStartGlobalPoint = pointTranslate<LocalPoint, GlobalPoint>(
    nextPoints[0],
    origin,
  );
  const origEndGlobalPoint = pointTranslate<LocalPoint, GlobalPoint>(
    nextPoints[nextPoints.length - 1],
    origin,
  );

  // NOTE: updates coming through `mutateElement` don't carry the zoom, so
  // those fall back to the zoom=1 binding distance
  const zoom = options?.zoom ?? DEFAULT_ZOOM;

  let hoveredStartElement: ExcalidrawBindableElement | null;
  let hoveredEndElement: ExcalidrawBindableElement | null;
  if (options?.isDragging && options.isBindingEnabled !== false) {
    const elements = Array.from(elementsMap.values());
    hoveredStartElement = getHoveredElementForBinding(
      origStartGlobalPoint,
      elements,
      elementsMap,
      zoom,
    );
    hoveredEndElement = getHoveredElementForBinding(
      origEndGlobalPoint,
      elements,
      elementsMap,
      zoom,
    );
  } else {
    hoveredStartElement = arrow.startBinding
      ? getBindableElementForId(arrow.startBinding.elementId, elementsMap)
      : null;
    hoveredEndElement = arrow.endBinding
      ? getBindableElementForId(arrow.endBinding.elementId, elementsMap)
      : null;
  }

  const arrowElement = {
    ...arrow,
    angle: 0,
    type: "arrow",
    elbowed: true,
    points: nextPoints,
  } as ExcalidrawElbowArrowElement;
  const startGlobalPoint = getEndpointGlobalPoint(
    arrowElement,
    "start",
    arrow.startBinding,
    origStartGlobalPoint,
    hoveredStartElement,
    elementsMap,
    zoom,
    options,
  );
  const endGlobalPoint = getEndpointGlobalPoint(
    arrowElement,
    "end",
    arrow.endBinding,
    origEndGlobalPoint,
    hoveredEndElement,
    elementsMap,
    zoom,
    options,
  );

  const startHeading = getBindPointHeading(
    startGlobalPoint,
    endGlobalPoint,
    hoveredStartElement,
    origStartGlobalPoint,
    elementsMap,
    zoom,
  );
  const endHeading = getBindPointHeading(
    endGlobalPoint,
    startGlobalPoint,
    hoveredEndElement,
    origEndGlobalPoint,
    elementsMap,
    zoom,
  );

  const startPointBounds = pointBounds(startGlobalPoint);
  const endPointBounds = pointBounds(endGlobalPoint);

  // The element and the gap the arrow keeps from it, wider on the side the
  // arrow leaves from if there's an arrowhead to fit
  const elementBounds = (
    element: ExcalidrawBindableElement | null,
    heading: Heading,
    arrowhead: Arrowhead | null,
    fallback: Bounds,
  ) =>
    element
      ? aabbForElement(
          element,
          elementsMap,
          offsetFromHeading(
            heading,
            getBindingGap(element) * arrowheadGapFactor(arrowhead),
            1,
          ),
        )
      : fallback;
  const startElementBounds = elementBounds(
    hoveredStartElement,
    startHeading,
    arrow.startArrowhead,
    startPointBounds,
  );
  const endElementBounds = elementBounds(
    hoveredEndElement,
    endHeading,
    arrow.endArrowhead,
    endPointBounds,
  );

  // If either endpoint is within the padding of the other's element, there's
  // no room to route around the elements, so route between the bare points
  const paddedElementBounds = (
    element: ExcalidrawBindableElement | null,
    heading: Heading,
    fallback: Bounds,
  ) =>
    element
      ? aabbForElement(
          element,
          elementsMap,
          offsetFromHeading(heading, BASE_PADDING, BASE_PADDING),
        )
      : fallback;
  const boundsOverlap =
    pointInsideBounds(
      startGlobalPoint,
      paddedElementBounds(hoveredEndElement, endHeading, endPointBounds),
    ) ||
    pointInsideBounds(
      endGlobalPoint,
      paddedElementBounds(hoveredStartElement, startHeading, startPointBounds),
    );

  const [startBounds, endBounds] = boundsOverlap
    ? [startPointBounds, endPointBounds]
    : [startElementBounds, endElementBounds];
  const commonBounds = commonAABB([startBounds, endBounds]);

  const isBound = !!hoveredStartElement || !!hoveredEndElement;
  const boundsPadding = (heading: Heading, arrowhead: Arrowhead | null) => {
    if (boundsOverlap) {
      return offsetFromHeading(heading, isBound ? BASE_PADDING : 0, 0);
    }

    return offsetFromHeading(
      heading,
      isBound
        ? BASE_PADDING - BASE_BINDING_GAP * arrowheadGapFactor(arrowhead)
        : 0,
      BASE_PADDING,
    );
  };
  const dynamicAABBs = generateDynamicAABBs(
    startBounds,
    endBounds,
    commonBounds,
    boundsPadding(startHeading, arrow.startArrowhead),
    boundsPadding(endHeading, arrow.endArrowhead),
    boundsOverlap,
    hoveredStartElement
      ? aabbForElement(hoveredStartElement, elementsMap)
      : null,
    hoveredEndElement ? aabbForElement(hoveredEndElement, elementsMap) : null,
  );

  return {
    dynamicAABBs,
    startDonglePosition: getDonglePosition(
      dynamicAABBs[0],
      startHeading,
      startGlobalPoint,
    ),
    startGlobalPoint,
    startHeading,
    endDonglePosition: getDonglePosition(
      dynamicAABBs[1],
      endHeading,
      endGlobalPoint,
    ),
    endGlobalPoint,
    endHeading,
    commonBounds,
    hoveredStartElement,
    hoveredEndElement,
  };
};

/**
 * Where an endpoint ends up: snapped onto the outline of the element under it
 * while dragging, or at its binding's fixed point otherwise
 */
const getEndpointGlobalPoint = (
  arrow: ExcalidrawElbowArrowElement,
  startOrEnd: "start" | "end",
  binding: FixedPointBinding | null,
  origPoint: GlobalPoint,
  element: ExcalidrawBindableElement | null,
  elementsMap: ElementsMap,
  zoom: AppState["zoom"],
  options?: ElbowArrowRoutingOptions,
): GlobalPoint => {
  if (!element) {
    return origPoint;
  }

  if (options?.isDragging) {
    return options.isBindingEnabled ?? true
      ? bindPointToSnapToElementOutline(
          arrow,
          element,
          startOrEnd,
          elementsMap,
          zoom,
          undefined,
          options.isMidpointSnappingEnabled,
        )
      : origPoint;
  }

  return getGlobalFixedPointForBindableElement(
    binding?.fixedPoint ?? [0, 0],
    element,
    elementsMap,
  );
};

const getBindPointHeading = (
  p: GlobalPoint,
  otherPoint: GlobalPoint,
  hoveredElement: ExcalidrawBindableElement | null,
  origPoint: GlobalPoint,
  elementsMap: ElementsMap,
  zoom: AppState["zoom"],
): Heading => {
  let aabb: Bounds | null = null;
  if (hoveredElement) {
    const distance = distanceToElement(hoveredElement, elementsMap, p);
    aabb = aabbForElement(hoveredElement, elementsMap, [
      distance,
      distance,
      distance,
      distance,
    ]);
  }

  return getHeadingForElbowArrowSnap(
    p,
    otherPoint,
    hoveredElement,
    aabb,
    origPoint,
    elementsMap,
    zoom,
  );
};

const pointBounds = (p: GlobalPoint): Bounds => [
  p[0] - 2,
  p[1] - 2,
  p[0] + 2,
  p[1] + 2,
];

/**
 * Bounds offsets with `head` on the side the heading points to and `side`
 * on the others
 */
const offsetFromHeading = (
  heading: Heading,
  head: number,
  side: number,
): BoundsOffset => {
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

/** The point where the ray from `p` along `heading` leaves `bounds` */
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

const commonAABB = (aabbs: Bounds[]): Bounds => [
  Math.min(...aabbs.map((aabb) => aabb[0])),
  Math.min(...aabbs.map((aabb) => aabb[1])),
  Math.max(...aabbs.map((aabb) => aabb[2])),
  Math.max(...aabbs.map((aabb) => aabb[3])),
];

/**
 * Grows the boxes `a` (around the start) and `b` (around the end) by their
 * paddings, and towards each other until they touch halfway between their
 * elements, so the route between them stays clear of both.
 *
 * When the grown boxes would overlap on both axes (the elements are
 * diagonal to each other and close), they're split along whichever axis
 * keeps the route closest to the end (the "side hack"), unless disabled.
 */
const generateDynamicAABBs = (
  a: Bounds,
  b: Bounds,
  common: Bounds,
  startPadding: BoundsOffset,
  endPadding: BoundsOffset,
  disableSideHack: boolean,
  startElementBounds: Bounds | null,
  endElementBounds: Bounds | null,
): Bounds[] => {
  const startEl = startElementBounds ?? a;
  const endEl = endElementBounds ?? b;
  const first = growBounds(a, b, startEl, endEl, common, startPadding);
  const second = growBounds(b, a, endEl, startEl, common, endPadding);

  // NOTE: the expressions are kept as they are, as the comparison is
  // sensitive to floating point rounding
  const c = commonAABB([first, second]);
  const overlapsBothAxes =
    first[2] - first[0] + second[2] - second[0] > c[2] - c[0] + 0.00000000001 &&
    first[3] - first[1] + second[3] - second[1] > c[3] - c[1] + 0.00000000001;
  if (disableSideHack || !overlapsBothAxes) {
    return [first, second];
  }

  const aIsLeft = a[2] < b[0];
  const aIsRight = a[0] > b[2];
  const aIsAbove = a[3] < b[1];
  const aIsBelow = a[1] > b[3];
  if (!(aIsLeft || aIsRight) || !(aIsAbove || aIsBelow)) {
    return [first, second];
  }

  // halfway across the gaps between the boxes
  const splitX = aIsLeft
    ? first[2] + (second[0] - first[2]) / 2
    : second[2] + (first[0] - second[2]) / 2;
  const splitY = aIsAbove
    ? first[3] + (second[1] - first[3]) / 2
    : second[3] + (first[1] - second[3]) / 2;

  // Split at x when the end is further off to the side of `a` than above or
  // below it (relative to the shape of `a`), i.e. depending on which side of
  // the diagonal of `a` pointing towards the end the end's center is on
  const endCenterX = (second[0] + second[2]) / 2;
  const endCenterY = (second[1] + second[3]) / 2;
  const diagonalCross = (x1: number, y1: number, x2: number, y2: number) =>
    vectorCross(
      vector(x1 - endCenterX, y1 - endCenterY),
      vector(x2 - endCenterX, y2 - endCenterY),
    );
  const cross =
    aIsLeft === aIsBelow
      ? // bottom-left or top-right: the diagonal from top-right to bottom-left
        diagonalCross(a[2], a[1], a[0], a[3])
      : // top-left or bottom-right: the diagonal from top-left to bottom-right
        diagonalCross(a[0], a[1], a[2], a[3]);
  const splitAtX = aIsLeft ? !(cross > 0) : cross > 0;

  if (splitAtX) {
    return aIsLeft
      ? [
          [first[0], first[1], splitX, first[3]],
          [splitX, second[1], second[2], second[3]],
        ]
      : [
          [splitX, first[1], first[2], first[3]],
          [second[0], second[1], splitX, second[3]],
        ];
  }

  return aIsAbove
    ? [
        [first[0], first[1], first[2], splitY],
        [second[0], splitY, second[2], second[3]],
      ]
    : [
        [first[0], splitY, first[2], first[3]],
        [second[0], second[1], second[2], splitY],
      ];
};

/**
 * One side of {@link generateDynamicAABBs}: grows `self` by its padding, or
 * (on the sides facing `other`, if they're apart) to halfway between their
 * elements. Sides not facing `other` reach out to the common bounds.
 */
const growBounds = (
  self: Bounds,
  other: Bounds,
  selfEl: Bounds,
  otherEl: Bounds,
  common: Bounds,
  [up, right, down, left]: BoundsOffset,
): Bounds => {
  const apartHorizontally = self[0] > other[2] || self[2] < other[0];
  const apartVertically = self[1] > other[3] || self[3] < other[1];

  const leftMid = (selfEl[0] + otherEl[2]) / 2;
  const topMid = (selfEl[1] + otherEl[3]) / 2;
  const rightMid = (selfEl[2] + otherEl[0]) / 2;
  const bottomMid = (selfEl[3] + otherEl[1]) / 2;

  return [
    self[0] > other[2]
      ? apartVertically
        ? Math.min(leftMid, self[0] - left)
        : leftMid
      : self[0] > other[0]
      ? self[0] - left
      : common[0] - left,
    self[1] > other[3]
      ? apartHorizontally
        ? Math.min(topMid, self[1] - up)
        : topMid
      : self[1] > other[1]
      ? self[1] - up
      : common[1] - up,
    self[2] < other[0]
      ? apartVertically
        ? Math.max(rightMid, self[2] + right)
        : rightMid
      : self[2] < other[2]
      ? self[2] + right
      : common[2] + right,
    self[3] < other[1]
      ? apartHorizontally
        ? Math.max(bottomMid, self[3] + down)
        : bottomMid
      : self[3] < other[3]
      ? self[3] + down
      : common[3] + down,
  ];
};

// -----------------------------------------------------------------------------
// Routing
// -----------------------------------------------------------------------------

/**
 * The elbow arrow's route: with one or two corners if that fits, or on the
 * grid otherwise, without short segments and the points between collinear
 * ones
 */
export const getElbowArrowRoute = (
  arrow: ElbowArrowState,
  elbowArrowData: ElbowArrowData,
  elementsMap: ElementsMap,
): GlobalPoint[] =>
  getCornerPoints(
    removeShortSegments(
      getSimpleRoute(arrow, elbowArrowData, elementsMap) ??
        getGridRoute(elbowArrowData) ??
        [],
    ),
  );

/** Whether an axis-aligned segment passes through `bounds` */
const segmentCrossesBounds = (a: GlobalPoint, b: GlobalPoint, bounds: Bounds) =>
  doBoundsIntersect(
    [
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.max(a[0], b[0]),
      Math.max(a[1], b[1]),
    ],
    bounds,
  );

/**
 * The route between two bound elements with one corner (when the arrow
 * leaves one and enters the other at a right angle) or two (when it leaves
 * and enters them heading the same way), if it fits: leaving the start
 * element and entering the end one the way their headings tell, clear of
 * both. Routed on the grid, the arrow keeps a fixed padding to the elements
 * instead, and steps aside to reach it when they're closer than that (e.g.
 * when the end element is just below the start's side, or just below the
 * start).
 */
const getSimpleRoute = (
  arrow: ElbowArrowState,
  {
    startHeading,
    endHeading,
    startGlobalPoint,
    endGlobalPoint,
    hoveredStartElement,
    hoveredEndElement,
  }: ElbowArrowData,
  elementsMap: ElementsMap,
): GlobalPoint[] | null => {
  const oneCorner =
    headingIsHorizontal(startHeading) !== headingIsHorizontal(endHeading);
  if (
    !hoveredStartElement ||
    !hoveredEndElement ||
    hoveredStartElement.id === hoveredEndElement.id ||
    (!oneCorner && !compareHeading(startHeading, flipHeading(endHeading)))
  ) {
    return null;
  }

  // with one corner, the legs are as long as the end is ahead of the start
  // along the start's heading, and the start ahead of the end along the
  // end's (headings point away from their element), and with two, they
  // share the former
  const ahead =
    (endGlobalPoint[0] - startGlobalPoint[0]) * startHeading[0] +
    (endGlobalPoint[1] - startGlobalPoint[1]) * startHeading[1];
  let firstLeg: number;
  let lastLeg: number;
  if (oneCorner) {
    firstLeg = ahead;
    lastLeg =
      (startGlobalPoint[0] - endGlobalPoint[0]) * endHeading[0] +
      (startGlobalPoint[1] - endGlobalPoint[1]) * endHeading[1];
  } else {
    // halfway, as the grid routing turns when there's room, unless that
    // leaves an arrowhead a shorter leg than the padding, and the other end,
    // without one, can spare some of its own (keeping enough to round its
    // corner)
    firstLeg = ahead / 2;
    if (!arrow.startArrowhead !== !arrow.endArrowhead) {
      const arrowheadLeg = Math.max(
        ahead / 2,
        Math.min(BASE_PADDING, ahead - ELBOW_ARROW_CORNER_RADIUS * 2),
      );
      firstLeg = arrow.startArrowhead ? arrowheadLeg : ahead - arrowheadLeg;
    }
    lastLeg = ahead - firstLeg;
  }

  // a leg is to keep its corner rounded (at least a quarter of the radius,
  // rather than a stub hugging the element), and one with an arrowhead to
  // fit it too (not to have it reach around the corner)
  if (
    firstLeg <=
      Math.max(
        ELBOW_ARROW_CORNER_RADIUS / 2,
        arrow.startArrowhead ? getArrowheadSize(arrow.startArrowhead) : 0,
      ) ||
    lastLeg <=
      Math.max(
        ELBOW_ARROW_CORNER_RADIUS / 2,
        arrow.endArrowhead ? getArrowheadSize(arrow.endArrowhead) : 0,
      )
  ) {
    return null;
  }

  const firstTurn = pointFrom<GlobalPoint>(
    startGlobalPoint[0] + startHeading[0] * firstLeg,
    startGlobalPoint[1] + startHeading[1] * firstLeg,
  );
  const lastTurn = pointFrom<GlobalPoint>(
    endGlobalPoint[0] + endHeading[0] * lastLeg,
    endGlobalPoint[1] + endHeading[1] * lastLeg,
  );

  const [startBounds, endBounds] = [hoveredStartElement, hoveredEndElement].map(
    (element) => {
      const gap = getBindingGap(element);
      return aabbForElement(element, elementsMap, [gap, gap, gap, gap]);
    },
  );
  // (the first leg leaves the start, and the last enters the end)
  if (
    segmentCrossesBounds(startGlobalPoint, firstTurn, endBounds) ||
    segmentCrossesBounds(firstTurn, lastTurn, startBounds) ||
    segmentCrossesBounds(firstTurn, lastTurn, endBounds) ||
    segmentCrossesBounds(lastTurn, endGlobalPoint, startBounds)
  ) {
    return null;
  }

  // (with one corner, both turns are at it, and merged later)
  return [startGlobalPoint, firstTurn, lastTurn, endGlobalPoint];
};

/**
 * The elbow arrow's route on the grid, keeping a padding around the elements
 * it connects, or null if there's none
 */
const getGridRoute = ({
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
}: ElbowArrowData): GlobalPoint[] | null => {
  const grid = calculateGrid(
    dynamicAABBs,
    startDonglePosition,
    startHeading,
    endDonglePosition,
    endHeading,
    commonBounds,
  );

  const startDongle = pointToGridNode(startDonglePosition, grid);
  const endDongle = pointToGridNode(endDonglePosition, grid);

  // Do not allow stepping on the true end or true start points of bound
  // endpoints (if they're on the grid at all, as usually only their dongles
  // are)
  const endNode = pointToGridNode(endGlobalPoint, grid);
  if (endNode && hoveredEndElement) {
    endNode.closed = true;
  }
  const startNode = pointToGridNode(startGlobalPoint, grid);
  if (startNode && hoveredStartElement) {
    startNode.closed = true;
  }

  // If the dongles are inside each other's boxes, there's no way around the
  // boxes, so ignore them
  const dongleOverlap =
    startDongle &&
    endDongle &&
    (pointInsideBounds(startDongle.pos, dynamicAABBs[1]) ||
      pointInsideBounds(endDongle.pos, dynamicAABBs[0]));

  const path = astar(
    startDongle ?? startNode!,
    endDongle ?? endNode!,
    grid,
    startHeading,
    endHeading,
    dongleOverlap ? [] : dynamicAABBs,
  );
  if (!path) {
    return null;
  }

  const points = path.map((node) =>
    pointFrom<GlobalPoint>(node.pos[0], node.pos[1]),
  );
  startDongle && points.unshift(startGlobalPoint);
  endDongle && points.push(endGlobalPoint);

  return points;
};

/** Drops the points between collinear segments */
const getCornerPoints = (points: GlobalPoint[]): GlobalPoint[] => {
  if (points.length <= 1) {
    return points;
  }

  const isHorizontal = (a: GlobalPoint, b: GlobalPoint) =>
    Math.abs(a[1] - b[1]) < Math.abs(a[0] - b[0]);

  let previousHorizontal = isHorizontal(points[0], points[1]);
  return points.filter((p, idx) => {
    // The very first and last points are always kept
    if (idx === 0 || idx === points.length - 1) {
      return true;
    }

    const nextHorizontal = isHorizontal(p, points[idx + 1]);
    const isCorner = previousHorizontal !== nextHorizontal;
    previousHorizontal = nextHorizontal;

    return isCorner;
  });
};

/** Drops the points ending degenerate (too short) segments */
const removeShortSegments = (points: GlobalPoint[]): GlobalPoint[] => {
  if (points.length < 4) {
    return points;
  }

  return points.filter(
    (p, idx) =>
      idx === 0 ||
      idx === points.length - 1 ||
      pointDistance(points[idx - 1], p) > DEDUP_THRESHOLD,
  );
};

// -----------------------------------------------------------------------------
// A* grid search
// -----------------------------------------------------------------------------

/**
 * Builds the grid the A* search walks: its nodes are where the lines along
 * the edges of the boxes, and through the endpoints along their headings,
 * cross.
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
  const xs = new Set<number>();
  const ys = new Set<number>();

  for (const [point, heading] of [
    [start, startHeading],
    [end, endHeading],
  ] as const) {
    if (headingIsHorizontal(heading)) {
      ys.add(point[1]);
    } else {
      xs.add(point[0]);
    }
  }

  for (const aabb of [...aabbs, common]) {
    xs.add(aabb[0]);
    xs.add(aabb[2]);
    ys.add(aabb[1]);
    ys.add(aabb[3]);
  }

  const sortedXs = Array.from(xs).sort((a, b) => a - b);
  const sortedYs = Array.from(ys).sort((a, b) => a - b);

  return {
    row: sortedYs.length,
    col: sortedXs.length,
    data: sortedYs.flatMap((y, row) =>
      sortedXs.map(
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

const gridNodeFromAddr = (
  [col, row]: [col: number, row: number],
  grid: Grid,
): Node | null => {
  if (col < 0 || col >= grid.col || row < 0 || row >= grid.row) {
    return null;
  }

  return grid.data[row * grid.col + col] ?? null;
};

/** The grid node at the given point, if there's one */
const pointToGridNode = (point: GlobalPoint, grid: Grid): Node | null =>
  grid.data.find(
    (node) => node.pos[0] === point[0] && node.pos[1] === point[1],
  ) ?? null;

/** The headings of the neighbors returned by {@link getNeighbors} */
const NEIGHBOR_HEADINGS = [
  HEADING_UP,
  HEADING_RIGHT,
  HEADING_DOWN,
  HEADING_LEFT,
] as const;

/** The neighboring nodes up, right, down and left of a grid address */
const getNeighbors = ([col, row]: GridAddress, grid: Grid) =>
  [
    gridNodeFromAddr([col, row - 1], grid),
    gridNodeFromAddr([col + 1, row], grid),
    gridNodeFromAddr([col, row + 1], grid),
    gridNodeFromAddr([col - 1, row], grid),
  ] as const;

const manhattanDistance = (a: GlobalPoint, b: GlobalPoint) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

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
  const bendMultiplier = manhattanDistance(start.pos, end.pos);
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

    const neighbors = getNeighbors(current.addr, grid);
    for (let i = 0; i < 4; i++) {
      const neighbor = neighbors[i];

      if (!neighbor || neighbor.closed) {
        // Not a valid node to process, skip to next neighbor.
        continue;
      }

      // Don't cut through any of the boxes
      const halfPoint = pointScaleFromOrigin(neighbor.pos, current.pos, 0.5);
      if (aabbs.some((aabb) => pointInsideBounds(halfPoint, aabb))) {
        continue;
      }

      const neighborHeading = NEIGHBOR_HEADINGS[i];
      const previousDirection = current.parent
        ? vectorToHeading(vectorFromPoint(current.pos, current.parent.pos))
        : startHeading;

      // Do not allow going in reverse, nor stepping back onto the start or
      // into the end against their headings
      if (
        compareHeading(flipHeading(previousDirection), neighborHeading) ||
        (neighbor === start && compareHeading(neighborHeading, startHeading)) ||
        (neighbor === end && compareHeading(neighborHeading, endHeading))
      ) {
        continue;
      }

      // The g score is the shortest distance from start to current node.
      // We need to check if the path we have arrived at this neighbor is the shortest one we have seen yet.
      const directionChange = !compareHeading(
        previousDirection,
        neighborHeading,
      );
      const gScore =
        current.g +
        manhattanDistance(neighbor.pos, current.pos) +
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
          manhattanDistance(end.pos, neighbor.pos) +
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

/**
 * The A* heuristic's estimate of the bends left between moving along
 * `startHeading` at `start` and arriving at `end` (with `endHeading`)
 */
const estimateSegmentCount = (
  start: Node,
  end: Node,
  startHeading: Heading,
  endHeading: Heading,
) => {
  const [startX, startY] = start.pos;
  const [endX, endY] = end.pos;

  if (endHeading === HEADING_RIGHT) {
    switch (startHeading) {
      case HEADING_RIGHT:
        return startX >= endX ? 4 : startY === endY ? 0 : 2;
      case HEADING_UP:
        return startY > endY && startX < endX ? 1 : 3;
      case HEADING_DOWN:
        return startY < endY && startX < endX ? 1 : 3;
      case HEADING_LEFT:
        return startY === endY ? 4 : 2;
    }
  } else if (endHeading === HEADING_LEFT) {
    switch (startHeading) {
      case HEADING_RIGHT:
        return startY === endY ? 4 : 2;
      case HEADING_UP:
        return startY > endY && startX > endX ? 1 : 3;
      case HEADING_DOWN:
        return startY < endY && startX > endX ? 1 : 3;
      case HEADING_LEFT:
        return startX <= endX ? 4 : startY === endY ? 0 : 2;
    }
  } else if (endHeading === HEADING_UP) {
    switch (startHeading) {
      case HEADING_RIGHT:
        return startY > endY && startX < endX ? 1 : 3;
      case HEADING_UP:
        return startY >= endY ? 4 : startX === endX ? 0 : 2;
      case HEADING_DOWN:
        return startX === endX ? 4 : 2;
      case HEADING_LEFT:
        return startY > endY && startX > endX ? 1 : 3;
    }
  } else if (endHeading === HEADING_DOWN) {
    switch (startHeading) {
      case HEADING_RIGHT:
        return startY < endY && startX < endX ? 1 : 3;
      case HEADING_UP:
        return startX === endX ? 4 : 2;
      case HEADING_DOWN:
        return startY <= endY ? 4 : startX === endX ? 0 : 2;
      case HEADING_LEFT:
        return startY < endY && startX > endX ? 1 : 3;
    }
  }

  return 0;
};
