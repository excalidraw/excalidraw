/**
 * Elbow arrow routing: given an arrow's endpoints and the elements they are
 * bound to (or hovering over), finds the orthogonal route between them.
 *
 * The route is the cheapest path on a sparse orthogonal grid (much like the
 * orthogonal visibility graph of Wybrow, Marriott and Stuckey, "Orthogonal
 * Connector Routing", GD 2009; see {@link buildGrid} and
 * {@link cheapestPath}), where the cost of a path is its length, a fixed cost
 * per bend, a cost for running close to, or through, the elements it
 * connects (see {@link CLEARANCE_COST}), for turning back too tightly
 * (see {@link SHORT_HAIRPIN_COST}), and for crossing itself (see
 * {@link SELF_CROSSING_COST}).
 *
 * Its segments run on the grid's lines, which are where segments belong (a
 * padding away from the elements, halfway between them, through the
 * endpoints...), so they're placed exactly there, and move along with the
 * elements, rather than settling wherever some cost is least, which where
 * the costs are about flat, small differences can change from one frame to
 * the next. The first and last legs are as long as worked out from where
 * the endpoints and elements are, before the search (see {@link legLength}),
 * which changes continuously with them, and the route only turns off them
 * there or later, so they never get shorter in jumps, from one line of the
 * grid to another.
 *
 * The elements are soft obstacles (much like yFiles' node crossing penalty)
 * rather than hard ones, and every cost changes continuously as the elements
 * move, so the route only changes its shape where another shape becomes as
 * cheap. The exceptions are two elements overlapping, which the route then
 * goes around as one, and two legs heading straight at each other, too close
 * to turn between them, with an endpoint within the padding around the other
 * element: the route then doesn't avoid either of them at all (see
 * {@link findRoute}).
 *
 * The route only depends on the endpoints, their headings and elements, and
 * the arrowheads (never on where the route was before), so the same arrow
 * always gets the same route.
 *
 * Editing an existing route (moving and fixing segments, dragging endpoints of
 * an arrow with fixed segments) lives in `elbowArrow.ts`.
 */

import {
  clamp,
  pointFrom,
  pointTranslate,
  vector,
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
} from "./heading";
import { isBindableElement } from "./typeChecks";
import { aabbForElement, getArrowheadSize } from "./bounds";
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

// -----------------------------------------------------------------------------
// Routing costs, in px of route length
// -----------------------------------------------------------------------------

/** Each bend costs as much as this much more length */
const BEND_COST = 4 * BASE_PADDING;

/**
 * The cost per px of route running within the padding around an element: it
 * grows from nothing at the padding's edge to this at the element's (see
 * {@link closeness}). Between two elements closer than twice the padding, the
 * padding shrinks to half the distance between them, so a route through the
 * gap runs halfway between them at no cost (see {@link clearanceCost}).
 */
const CLEARANCE_COST = 3;

/**
 * How the clearance cost grows from the padding's edge (0) to the element's
 * (1): half linearly, so with room to spare, a segment of any length stays
 * out of the padding (moving it in costs more than the length it saves), and
 * half quadratically, so where two elements' paddings overlap, a segment
 * between them settles halfway
 */
const closeness = (depth: number) => (depth + depth * depth) / 2;

/**
 * The additional cost per px of route running inside an element (and the
 * binding gap around it), ramped in over {@link CROSSING_RAMP} px past its
 * edge (to keep costs continuous)
 */
const CROSSING_COST = 10;
const CROSSING_RAMP = 2;

/**
 * Over how many px to the side of a leg the other element's near side stops
 * counting as in its way (see {@link findRoute})
 */
const STRIP_RAMP = BASE_PADDING / 4;

/**
 * The cost of the route crossing itself, as much as four more bends: a route
 * crossing itself is hard to follow, so it goes most any other way instead
 * (around the other side of an element, say), only not a contrived one.
 * Ramped in over {@link CROSSING_RAMP} px, both of how far one segment gets
 * past the other and of how far from the other's end it crosses, to keep
 * costs continuous (see {@link cheapestPath}).
 */
const SELF_CROSSING_COST = 4 * BEND_COST;

/**
 * The cost per px the segments either side of a hairpin (two corners turning
 * the same way, where the route turns back) are closer together than they
 * need to be (see {@link minHairpin}), which looks like the route folding
 * back onto itself: between two elements it avoids, so steep that it's all
 * but a limit, as it can always go around them instead. Otherwise, short of
 * making it go much further around: in all, less than the two more bends
 * going around would take.
 */
const SHORT_HAIRPIN_COST = 200;
const SHORT_FORCED_HAIRPIN_COST = 16;

/**
 * How much more a left (counterclockwise) turn costs than a right one: only
 * to settle ties between route shapes (like going around either side of two
 * elements of the same size) the same way throughout, rather than by whichever
 * small differences in cost there are between them flipping back and forth
 */
const TURN_BIAS = 0.5;

/**
 * A tiny cost per segment of the route on the grid lines other than the ones
 * halfway between elements and through the endpoints, only to break ties
 * between otherwise equally good routes in the same way every time. (Per
 * segment, rather than per px, so it never weighs against length.)
 */
const LINE_COSTS = { preferred: 0, padding: 1e-3, step: 2e-3 } as const;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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

/** The endpoints of an elbow arrow, for routing */
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
};

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

/**
 * Works out where the arrow's (moved) endpoints are, which elements they
 * connect, and which way they face.
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

  return {
    startGlobalPoint,
    startHeading: getBindPointHeading(
      startGlobalPoint,
      endGlobalPoint,
      hoveredStartElement,
      elementsMap,
      zoom,
    ),
    endGlobalPoint,
    endHeading: getBindPointHeading(
      endGlobalPoint,
      startGlobalPoint,
      hoveredEndElement,
      elementsMap,
      zoom,
    ),
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

/**
 * The way the arrow leaves (or enters) an endpoint: out of the side of its
 * element it's on, or, if it's inside the element, away from its center.
 * (Where the endpoint is, rather than the pointer dragging it: snapped onto
 * the outline from inside, it's on the side it's on, as it is once bound.)
 */
const getBindPointHeading = (
  p: GlobalPoint,
  otherPoint: GlobalPoint,
  hoveredElement: ExcalidrawBindableElement | null,
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
    p,
    elementsMap,
    zoom,
  );
};

// -----------------------------------------------------------------------------
// Routing
// -----------------------------------------------------------------------------

/** One end of the route */
type Endpoint = {
  point: GlobalPoint;
  /** Which way the route leaves the start, or the end is entered from */
  heading: Heading;
  /** The obstacle of the element it's bound to, if any */
  obstacle: number | null;
  /** The length the leg at this end needs, for its corner and arrowhead */
  minLeg: number;
  /**
   * How long the leg at this end is, at least (see {@link findRoute}): the
   * route doesn't turn off it any sooner, only (running on) later
   */
  leg: number;
};

/**
 * Where the other element is, from the leg at an endpoint: how far ahead of
 * where the leg leaves its own element (or the endpoint, past it, where it's
 * cut back between them, see shareGaps) the other one's near side is (or
 * behind, if negative), as well as of the endpoint itself, and how far it is
 * to the side of the leg's line
 */
const legSurroundings = (
  { point, heading }: Pick<Endpoint, "point" | "heading">,
  own: Bounds,
  other: Bounds,
) => {
  const axis = headingIsHorizontal(heading) ? 0 : 1;
  const sign = Math.sign(heading[axis]);
  const exit =
    sign > 0
      ? Math.max(own[axis + 2], point[axis])
      : Math.min(own[axis], point[axis]);
  const near = sign > 0 ? other[axis] : other[axis + 2];
  const ahead = (near - exit) * sign;
  // (and how far ahead of the endpoint itself, which the leg's length is
  // measured from)
  const aheadOfPoint = (near - point[axis]) * sign;
  const across = point[1 - axis];
  const beside = Math.max(
    other[1 - axis] - across,
    across - other[3 - axis],
    0,
  );

  return { ahead, aheadOfPoint, beside };
};

/**
 * How long a leg is: the base padding, but where the other element (its
 * bounds) is ahead of it, closer than twice that, only half the room to it,
 * so the route turns halfway between them, where a route through the gap
 * runs (see {@link clearanceCost}), and where they face each other, neither
 * leg runs into the other's room. (Plus how far it is to the side
 * of the leg's line, or how far behind the leg it starts, so the leg changes
 * continuously as the elements move, and shortens along with the room ahead
 * of it.) That's all that makes it any shorter: wherever else the route goes,
 * the legs are as long as this, and the route runs on from them (see
 * {@link findRoute}). Never shorter than it needs to be, for its corner and
 * arrowhead, even with less room than that.
 */
const legLength = (
  { point, heading, obstacle, minLeg }: Endpoint,
  obstacles: Bounds[],
) => {
  if (obstacle === null || obstacles.length !== 2) {
    return Math.max(minLeg, BASE_PADDING);
  }
  const { ahead, beside } = legSurroundings(
    { point, heading },
    obstacles[obstacle],
    obstacles[1 - obstacle],
  );

  return Math.max(
    minLeg,
    Math.min(BASE_PADDING, beside + (ahead >= 0 ? ahead / 2 : -ahead)),
  );
};

/**
 * How far apart the segments either side of a hairpin need to be: between
 * two elements it avoids, far enough apart to round both its corners fully,
 * as there's room to go around them instead. Otherwise (where they overlap,
 * or an end is unbound, and wherever it is the route may have to turn back
 * to get to it), only far enough apart to round both corners at all (as
 * halfway between endpoints just as far apart, see {@link buildGrid}).
 */
const minHairpin = (betweenElements: boolean) =>
  betweenElements ? 2 * ELBOW_ARROW_CORNER_RADIUS : ELBOW_ARROW_CORNER_RADIUS;

/** The cost of a hairpin's middle segment being as long as it is */
const hairpinCost = (length: number, betweenElements: boolean) =>
  (betweenElements ? SHORT_HAIRPIN_COST : SHORT_FORCED_HAIRPIN_COST) *
  Math.max(0, minHairpin(betweenElements) - length);

/**
 * The elbow arrow's route: the cheapest one leaving its start along the start
 * heading and entering its end against the end heading, as its corner points
 */
export const getElbowArrowRoute = (
  arrow: ElbowArrowState,
  {
    startGlobalPoint,
    endGlobalPoint,
    startHeading,
    endHeading: boundEndHeading,
    hoveredStartElement,
    hoveredEndElement,
  }: ElbowArrowData,
  elementsMap: ElementsMap,
): GlobalPoint[] => {
  // An arrow from a point of an element back to the same point would have to
  // run back over itself to enter it the way it left: it loops around the
  // corner instead, entering it from the next side around (clockwise), as a
  // self-loop between two sides next to each other does
  const endHeading =
    hoveredStartElement &&
    hoveredStartElement.id === hoveredEndElement?.id &&
    manhattanDistance(startGlobalPoint, endGlobalPoint) < DEDUP_THRESHOLD &&
    compareHeading(startHeading, boundEndHeading)
      ? DIRECTIONS[(directionIndex(boundEndHeading) + 1) % 4]
      : boundEndHeading;

  // The space the route keeps out of: the elements and their binding gap
  // (an element bound at both ends is a single obstacle)
  const elements = [hoveredStartElement, hoveredEndElement];
  const obstacles: Bounds[] = [];
  const gaps: number[] = [];
  const obstacleIndex = elements.map((element, i) => {
    if (!element) {
      return null;
    }
    if (i === 1 && hoveredStartElement?.id === element.id) {
      return 0;
    }
    const gap = getBindingGap(element);
    obstacles.push(aabbForElement(element, elementsMap, [gap, gap, gap, gap]));
    gaps.push(gap);
    return obstacles.length - 1;
  });

  // room to round the corner, or for an arrowhead and some of the rounding
  const minLeg = (arrowhead: Arrowhead | null) =>
    arrowhead
      ? getArrowheadSize(arrowhead) + ELBOW_ARROW_CORNER_RADIUS / 4
      : ELBOW_ARROW_CORNER_RADIUS / 2;

  return findRoute(
    {
      point: startGlobalPoint,
      heading: startHeading,
      obstacle: obstacleIndex[0],
      minLeg: minLeg(arrow.startArrowhead),
      leg: BASE_PADDING,
    },
    {
      point: endGlobalPoint,
      heading: endHeading,
      obstacle: obstacleIndex[1],
      minLeg: minLeg(arrow.endArrowhead),
      leg: BASE_PADDING,
    },
    obstacles,
    gaps,
    !!hoveredStartElement &&
      !!hoveredEndElement &&
      hoveredStartElement.id !== hoveredEndElement.id &&
      boundsOverlap(hoveredStartElement, hoveredEndElement, elementsMap),
    elements.every(
      (element) => element?.type === "diamond" || element?.type === "ellipse",
    ),
  );
};

/**
 * Whether two elements' bounds overlap (whatever their shapes: the route
 * avoids their bounds, so where those overlap, it goes around both as one)
 */
const boundsOverlap = (
  a: ExcalidrawBindableElement,
  b: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
) => {
  const [al, at, ar, ab] = aabbForElement(a, elementsMap);
  const [bl, bt, br, bb] = aabbForElement(b, elementsMap);

  return al < br && bl < ar && at < bb && bt < ab;
};

/**
 * How much more two elements diagonal from each other can overlap along one
 * axis, and still meet halfway along it (see {@link shareGaps})
 */
const CORNER_SLACK = 2 * BASE_PADDING;

/**
 * The obstacles with their binding gaps cut back where they overlap, to meet
 * halfway between the elements, as the paddings around them do (see
 * {@link clearanceCost}): so a route between them runs in the middle, rather
 * than counting as running through both. (Only between sides facing each
 * other, and fading out as the elements are further apart along them, or
 * overlap more, so the obstacles change continuously.)
 *
 * Where the elements are diagonal from each other, their corners close
 * together or overlapping, and both have their corners clear (diamonds and
 * ellipses, `cornersClear`), they meet halfway along one axis as much as
 * along the other, even overlapping more along it (by up to
 * {@link CORNER_SLACK}). Otherwise there's only a way through between them
 * along the other axis, and a route that has to leave or enter them across it
 * zigzags into and out of it, with two more bends, where cutting across their
 * corners (which a diamond or an ellipse is well clear of anyway) takes none.
 * (Across the corners of a rectangle, the route would run through it.)
 */
const shareGaps = (
  obstacles: Bounds[],
  gaps: number[],
  cornersClear: boolean,
): Bounds[] => {
  if (obstacles.length !== 2) {
    return obstacles;
  }
  const [a, b] = obstacles.map((bounds) => [...bounds]);
  // How much they meet halfway along an axis, by how much the elements
  // overlap along it (or are apart, if negative)
  const meet = (overlap: number) =>
    clamp(1 - (overlap - BASE_PADDING / 4) / (BASE_PADDING / 2), 0, 1);
  // and diagonal from each other (see CORNER_SLACK), fading out over as far
  // again, so the sides cut back don't sweep back any faster than the
  // elements move
  const meetDiagonally = (overlap: number) =>
    clamp(2 - overlap / (BASE_PADDING / 4 + CORNER_SLACK), 0, 1);
  // Along each axis, how much the elements overlap, and how far each sticks
  // out past the other at its end (or, if negative, how far one is from
  // overlapping the other all along it)
  const axes = (
    [
      [0, 2],
      [1, 3],
    ] as const
  ).map(([lo, hi]) => {
    const [first, second] = a[lo] + a[hi] <= b[lo] + b[hi] ? [a, b] : [b, a];
    return {
      overlap: first[hi] - second[lo] - gaps[0] - gaps[1],
      outside: Math.min(second[lo] - first[lo], second[hi] - first[hi]),
    };
  });
  for (const [lo, hi] of [
    [0, 2],
    [1, 3],
  ] as const) {
    // the one before the other along the axis, the sides facing each other
    // and how far they're apart along the other axis
    const [first, second, firstGap, secondGap] =
      a[lo] + a[hi] <= b[lo] + b[hi]
        ? [a, b, gaps[0], gaps[1]]
        : [b, a, gaps[1], gaps[0]];
    const overlap = first[hi] - second[lo];
    if (overlap <= 0) {
      continue;
    }
    const [across, acrossHi] = lo === 0 ? [1, 3] : [0, 2];
    const apart = Math.max(a[across] - b[acrossHi], b[across] - a[acrossHi], 0);
    // (and diagonal from each other: each sticking out past the other
    // along this axis, and apart by little more than half a padding, if at
    // all, along the other)
    const { outside } = axes[lo];
    const acrossOverlap = axes[1 - lo].overlap;
    const corner =
      clamp((BASE_PADDING + acrossOverlap) / (BASE_PADDING / 2), 0, 1) *
      clamp(outside / (BASE_PADDING / 2), 0, 1);
    const share =
      clamp((BASE_PADDING - apart) / (BASE_PADDING / 2), 0, 1) *
      Math.max(
        meet(overlap - firstGap - secondGap),
        !cornersClear
          ? 0
          : Math.min(
              meetDiagonally(acrossOverlap),
              corner * meetDiagonally(overlap - firstGap - secondGap),
            ),
      );
    // halfway between the elements' sides (or across where they overlap a
    // little, which a route between them has to cross anyway)
    const middle = (first[hi] - firstGap + second[lo] + secondGap) / 2;
    first[hi] -= share * Math.max(0, first[hi] - middle);
    second[lo] += share * Math.max(0, middle - second[lo]);
  }

  return [a, b] as unknown as Bounds[];
};

const findRoute = (
  start: Endpoint,
  end: Endpoint,
  elementObstacles: Bounds[],
  gaps: number[],
  elementsOverlap = false,
  cornersClear = false,
): GlobalPoint[] => {
  // Where the elements' bounds overlap, they're one obstacle, the bounds
  // around both, which the route leaves from and enters as it would a single
  // element (its legs running through it where they start or end inside
  // it): so it goes around them both as they look together, and only changes
  // as the bounds around them do, continuously, rather than switching
  // between the padding around one and the other as they move
  if (
    start.obstacle !== null &&
    end.obstacle !== null &&
    start.obstacle !== end.obstacle &&
    elementsOverlap
  ) {
    const [a, b] = elementObstacles;
    const union = [
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.max(a[2], b[2]),
      Math.max(a[3], b[3]),
    ] as Bounds;

    return findRoute(
      { ...start, obstacle: 0 },
      { ...end, obstacle: 0 },
      [union],
      [Math.max(...gaps)],
    );
  }
  const obstacles = shareGaps(elementObstacles, gaps, cornersClear);
  // Otherwise, with the legs heading straight at each other, the endpoints
  // closer along them than both legs are long, the legs have to pass each
  // other, and with an endpoint within the padding around the element the
  // other end is bound to, there's no room for the route to keep its padding
  // around both (and going around them gets more and more contrived as they
  // get closer): the elements overlap, and aren't avoided at all, and the
  // route loops back past them halfway between the endpoints. (Only then:
  // anywhere else, the route turning between them and the one ignoring them
  // turn on different lines, so switching from one to the other as the
  // elements move would make the route jump. A leg heading at the other
  // element too close to it runs into it instead, see `strip`.)
  const facing =
    compareHeading(start.heading, flipHeading(end.heading)) &&
    (headingIsHorizontal(start.heading)
      ? (end.point[0] - start.point[0]) * start.heading[0]
      : (end.point[1] - start.point[1]) * start.heading[1]) <
      start.minLeg + end.minLeg - LEG_TOLERANCE;
  const overlapping =
    facing &&
    start.obstacle !== null &&
    end.obstacle !== null &&
    start.obstacle !== end.obstacle &&
    [start, end].some(({ point, obstacle }) =>
      elementObstacles.some(
        (bounds, i) =>
          i !== obstacle &&
          signedDistance(point[0], point[1], bounds) < BASE_PADDING,
      ),
    );
  // Otherwise, an endpoint inside another element (unbound, or bound to an
  // element next to it, which it doesn't overlap, only its bounds) has to
  // leave it anyway, so the element is an obstacle the less, the deeper the
  // endpoint is in it (and not at all a padding deep), rather than every way
  // out of it being about as expensive. (How deep in its bounds, rather than
  // in what's left of them where they're cut back between the elements, see
  // shareGaps, which only makes a way between them, and doesn't make it any
  // easier to leave.)
  const weights = elementObstacles.map((obstacle, i) =>
    overlapping
      ? 0
      : Math.min(
          ...[start, end]
            .filter((endpoint) => endpoint.obstacle !== i)
            .map(({ point }) =>
              clamp(
                1 + signedDistance(point[0], point[1], obstacle) / BASE_PADDING,
                0,
                1,
              ),
            ),
          1,
        ),
  );
  // The legs, worked out first (looping back past each other, ignoring the
  // elements, nothing makes them any shorter), and the route between where
  // they end, running on from them, and into them, where it does (see
  // cheapestPath)
  const [from, to] = [start, end].map((endpoint) => ({
    ...endpoint,
    leg: overlapping
      ? Math.max(endpoint.minLeg, BASE_PADDING)
      : legLength(endpoint, obstacles),
  }));
  const grid = buildGrid(from, to, obstacles, overlapping);
  // A leg heading straight at the other element, closer than it's long,
  // leaves the route no way past its near side but through it: the route is
  // free to run in it as deep as the leg is short of room (fading out as the
  // leg passes it by), so the segment after the leg runs along just inside
  // it, as far as it has to, rather than zigzagging around it, and the leg
  // stays as long as it needs to be as the elements get closer, rather than
  // the route switching to another shape. (As long as it needs to be, or as
  // its padding, where that's longer, as where it starts inside the other
  // one's bounds already: the route is no better for the leg turning any
  // sooner, only a little less deep in them. Measured from the endpoint, as
  // the leg is, with a little to spare, so the segment after a leg just as
  // long as that isn't counted as running through it.)
  const strip = obstacles.map((_, i) =>
    Math.max(
      0,
      ...[from, to].map((endpoint) => {
        if (
          endpoint.obstacle === null ||
          endpoint.obstacle === i ||
          obstacles.length !== 2
        ) {
          return 0;
        }
        const { aheadOfPoint } = legSurroundings(
          endpoint,
          obstacles[endpoint.obstacle],
          obstacles[i],
        );
        // (beside its bounds, rather than what's left of them where they're
        // cut back between the elements, see weights)
        const { beside } = legSurroundings(
          endpoint,
          elementObstacles[endpoint.obstacle],
          elementObstacles[i],
        );
        return (
          Math.max(0, endpoint.leg + CROSSING_RAMP / 2 - aheadOfPoint) *
          clamp(1 - beside / STRIP_RAMP, 0, 1)
        );
      }),
    ),
  );
  let path = cheapestPath(
    grid,
    from,
    to,
    obstacles,
    weights,
    overlapping,
    strip,
  );
  // (searching for the cheapest route with what it costs to cross itself
  // takes much longer, and only makes a difference where the cheapest one
  // without it crosses itself)
  if (path && crossesItself(getCornerPoints(path))) {
    path =
      cheapestPath(
        grid,
        from,
        to,
        obstacles,
        weights,
        overlapping,
        strip,
        true,
      ) ?? path;
  }
  if (!path || path.length < 2) {
    return [start.point, end.point];
  }

  return simplifyRoute(getCornerPoints(path));
};

// -----------------------------------------------------------------------------
// Grid
// -----------------------------------------------------------------------------

type LineKind = keyof typeof LINE_COSTS;
type Line = {
  at: number;
  kind: LineKind;
  exact: boolean;
  /**
   * Through the endpoints, where their legs would end, or halfway between
   * them (see {@link cheapestPath})
   */
  fromEndpoints?: boolean;
};

/**
 * The grid the route runs on: the lines through the endpoints, the lines
 * where their legs end (see {@link legLength}), the
 * edges of the padding around each element, and the lines halfway between the
 * ends (their elements, and the points themselves). All of them are there
 * whatever the elements' arrangement (and move with the elements), so a
 * route never loses the line it runs on.
 */
type Grid = {
  xs: Line[];
  ys: Line[];
};

const buildGrid = (
  start: Endpoint,
  end: Endpoint,
  obstacles: Bounds[],
  overlapping: boolean,
): Grid => {
  const xs: Line[] = [];
  const ys: Line[] = [];

  for (const { point, heading, leg } of [start, end]) {
    xs.push({
      at: point[0],
      kind: "preferred",
      exact: true,
      fromEndpoints: true,
    });
    ys.push({
      at: point[1],
      kind: "preferred",
      exact: true,
      fromEndpoints: true,
    });
    // where the leg ends (see legLength)
    const axis = headingIsHorizontal(heading) ? 0 : 1;
    (axis === 0 ? xs : ys).push({
      at: point[axis] + heading[axis] * leg,
      kind: "padding",
      exact: true,
      fromEndpoints: true,
    });
  }

  for (const [left, top, right, bottom] of obstacles) {
    xs.push(
      { at: left - BASE_PADDING, kind: "padding", exact: false },
      { at: right + BASE_PADDING, kind: "padding", exact: false },
    );
    ys.push(
      { at: top - BASE_PADDING, kind: "padding", exact: false },
      { at: bottom + BASE_PADDING, kind: "padding", exact: false },
    );
  }

  // halfway between the ends: their elements, or the points themselves if
  // they're unbound, or the elements overlap (and aren't avoided)
  const [a, b] = [start, end].map(({ point, obstacle }) =>
    obstacle === null || overlapping
      ? ([point[0], point[1], point[0], point[1]] as Bounds)
      : obstacles[obstacle],
  );
  // (the one across the gap between them preferred, rather than the one
  // between their far sides, which only ties with it)
  const gap = (lo: 0 | 1, hi: 2 | 3) => Math.max(b[lo] - a[hi], a[lo] - b[hi]);
  const boundsOverlap = gap(0, 2) < 0 && gap(1, 3) < 0;
  const pointsOnly =
    overlapping || (start.obstacle === null && end.obstacle === null);
  if (start.obstacle === null || start.obstacle !== end.obstacle) {
    for (const [lines, lo, hi] of [
      [xs, 0, 2],
      [ys, 1, 3],
    ] as const) {
      // (none where they overlap, so far that the lines are well inside both,
      // or between points too close together for the route to turn back
      // halfway between them, rounding its corners: they'd only let the
      // route double back on itself)
      if (
        (boundsOverlap && gap(lo, hi) < -2 * BASE_PADDING) ||
        (pointsOnly && gap(lo, hi) < 2 * ELBOW_ARROW_CORNER_RADIUS)
      ) {
        continue;
      }
      const aFirst = b[lo] - a[hi] >= a[lo] - b[hi];
      lines.push(
        {
          at: (a[hi] + b[lo]) / 2,
          kind: aFirst ? "preferred" : "padding",
          exact: false,
        },
        {
          at: (b[hi] + a[lo]) / 2,
          kind: aFirst ? "padding" : "preferred",
          exact: false,
        },
      );
    }
  }
  // and halfway between the points themselves, between elements, wherever
  // they are (rather than only where they don't avoid them), for a route
  // turning back between endpoints right by each other
  if (
    !overlapping &&
    start.obstacle !== null &&
    end.obstacle !== null &&
    start.obstacle !== end.obstacle
  ) {
    for (const [lines, axis] of [
      [xs, 0],
      [ys, 1],
    ] as const) {
      if (
        Math.abs(end.point[axis] - start.point[axis]) >=
        2 * ELBOW_ARROW_CORNER_RADIUS
      ) {
        lines.push({
          at: (start.point[axis] + end.point[axis]) / 2,
          kind: "step",
          exact: false,
          fromEndpoints: true,
        });
      }
    }
  }

  return { xs: mergeLines(xs), ys: mergeLines(ys) };
};

/**
 * The lines sorted, with the ones at the same place merged into one (the one
 * preferred). Ones merely close together are kept apart: which of them would
 * be kept would change as they pass each other, and the one kept might be a
 * px inside an element's padding, as the other one wouldn't.
 */
const mergeLines = (lines: Line[]): Line[] => {
  const rank = (line: Line) =>
    (line.exact ? 0 : 10) + Object.keys(LINE_COSTS).indexOf(line.kind);
  const sorted = [...lines].sort((a, b) => a.at - b.at || rank(a) - rank(b));

  // (one from the endpoints still is, merged with another)
  return sorted
    .filter((line, i) => i === 0 || line.at !== sorted[i - 1].at)
    .map((line) =>
      !line.fromEndpoints &&
      sorted.some((other) => other.at === line.at && other.fromEndpoints)
        ? { ...line, fromEndpoints: true }
        : line,
    );
};

// -----------------------------------------------------------------------------
// Costs
// -----------------------------------------------------------------------------

/**
 * The (Chebyshev) distance of a point from the bounds: positive outside,
 * negative inside
 */
const signedDistance = (x: number, y: number, [l, t, r, b]: Bounds) => {
  const dx = Math.max(l - x, x - r);
  const dy = Math.max(t - y, y - b);

  return dx > 0 || dy > 0 ? Math.max(dx, dy, 0) : Math.max(dx, dy);
};

/**
 * Across how many px around an obstacle's corner the room around it turns
 * from being measured horizontally to vertically (see {@link clearanceCost})
 */
const CORNER_BLEND = BASE_PADDING / 2;

/**
 * How much further away than it is an obstacle counts, per px its near side
 * is short of being ahead of a point, for the room around another obstacle
 * (see {@link clearanceCost})
 */
const BEHIND_FACTOR = 10;

/**
 * How far past its end another obstacle still counts as across from an
 * obstacle, for the room around it (see {@link clearanceCost}): so a segment
 * through a gap a little past where one of them ends still runs halfway
 * between them. Any further, and the padding would shrink where there's room
 * for it.
 */
const REACH_ACROSS = BASE_PADDING;

/**
 * The cost per px of route at a point, for running close to, or through, the
 * obstacles (but the ones at `exclude`, while still keeping their share of
 * the room between them)
 *
 * The padding around an obstacle is the smaller of the base padding and half
 * the room between it and the other obstacle at that point, so the middle of
 * a gap between them is always free, however narrow. The room is measured
 * along the axis the point is off the obstacle on (blended around its
 * corners), and counts the other obstacle as reaching a padding further
 * across that axis, so a gap is between the elements even a little past where
 * one of them ends. Everything here varies continuously with the point and
 * the obstacles.
 */
const clearanceCost = (
  x: number,
  y: number,
  obstacles: Bounds[],
  weights: readonly number[],
  allowance: readonly number[],
  exclude: number,
  crossingOnly: boolean,
) => {
  // (this runs a lot, so it doesn't allocate)
  const count = obstacles.length;
  for (let i = 0; i < count; i++) {
    const [l, t, r, b] = obstacles[i];
    const dx = Math.max(l - x, x - r);
    const dy = Math.max(t - y, y - b);
    scratch.distance[i] =
      dx > 0 || dy > 0 ? Math.max(dx, dy, 0) : Math.max(dx, dy);
    scratch.outsideX[i] = Math.max(dx, 0);
    scratch.outsideY[i] = Math.max(dy, 0);
  }

  let cost = 0;
  for (let i = 0; i < count; i++) {
    const distance = scratch.distance[i];
    if (exclude & (1 << i) || distance >= BASE_PADDING) {
      continue;
    }
    if (distance < 0) {
      // as close as it gets, and running through it past the allowance
      const depth = -distance - allowance[i];
      cost +=
        weights[i] *
        ((crossingOnly ? 0 : CLEARANCE_COST) +
          (depth > 0 ? CROSSING_COST * Math.min(depth / CROSSING_RAMP, 1) : 0));
      continue;
    }
    if (crossingOnly) {
      continue;
    }

    // half the way to the other obstacle, measured along the axis the point
    // is off this one on, with the other reaching further across it (see
    // REACH_ACROSS), if it's all ahead of the point (further away from this
    // one along that axis): one that isn't (beside the point, or behind it)
    // doesn't leave less room along that axis, so it's counted as the
    // further away, the further its near side is from being ahead. Off a
    // corner, the point is off it along both axes, and the room is the less
    // of the two (along an axis it's not off it on, the room counts as the
    // further away, the further it's from being off it, so a point by a side
    // but well along it isn't taken to be by its corner)
    const [il, it, ir, ib] = obstacles[i];
    const dxi = scratch.outsideX[i];
    const dyi = scratch.outsideY[i];
    const besideX = Math.max(0, -Math.max(il - x, x - ir));
    const besideY = Math.max(0, -Math.max(it - y, y - ib));
    let halfway = Infinity;
    for (let j = 0; j < count; j++) {
      if (j === i) {
        continue;
      }
      let reach = scratch.distance[j];
      if (reach > 0) {
        const [jl, jt, jr, jb] = obstacles[j];
        const dxj = scratch.outsideX[j];
        const dyj = scratch.outsideY[j];
        // how far the other's near side is short of being ahead of the point
        const behindX = x > ir ? x - jl : x < il ? jr - x : 0;
        const behindY = y > ib ? y - jt : y < it ? jb - y : 0;
        reach = Math.min(
          Math.max(dyj, dxj - REACH_ACROSS) +
            BEHIND_FACTOR *
              (Math.max(0, behindY) * Math.min(1, dyi / CORNER_BLEND) +
                besideY),
          Math.max(dxj, dyj - REACH_ACROSS) +
            BEHIND_FACTOR *
              (Math.max(0, behindX) * Math.min(1, dxi / CORNER_BLEND) +
                besideX),
        );
      }
      halfway = Math.min(halfway, Math.max(0, (distance + reach) / 2));
    }

    const padding = Math.min(BASE_PADDING, halfway);
    if (distance < padding) {
      cost += weights[i] * CLEARANCE_COST * closeness(1 - distance / padding);
    }
  }

  return cost;
};

/** Scratch space for {@link clearanceCost}, for up to two obstacles */
const scratch = {
  distance: new Float64Array(2),
  outsideX: new Float64Array(2),
  outsideY: new Float64Array(2),
};

/**
 * The clearance cost of an axis-aligned segment: the integral of
 * {@link clearanceCost} along it, by Simpson's rule on the pieces between
 * where it changes the most (the obstacles' edges, their paddings', and where
 * the nearest side of an obstacle changes), skipping where no obstacle is
 * within reach. `exclude` is a bitmask of the obstacles not to count.
 */
const segmentClearanceCost = (
  a: GlobalPoint,
  b: GlobalPoint,
  obstacles: Bounds[],
  weights: readonly number[],
  allowance: readonly number[],
  exclude: number,
  crossingOnly: boolean,
) => {
  const horizontal = a[1] === b[1];
  const axis = horizontal ? 0 : 1;
  const across = horizontal ? a[1] : a[0];
  let from = Math.min(a[axis], b[axis]);
  let to = Math.max(a[axis], b[axis]);

  // only along where some obstacle is within reach
  let reachFrom = Infinity;
  let reachTo = -Infinity;
  const breakpoints: number[] = [];
  obstacles.forEach((obstacle, i) => {
    const lo = obstacle[axis];
    const hi = obstacle[axis + 2];
    // how far outside (positive) or inside (negative) the obstacle the line
    // the segment is on is, across it
    const acrossDistance = Math.max(
      obstacle[1 - axis] - across,
      across - obstacle[3 - axis],
    );
    if (acrossDistance < BASE_PADDING) {
      reachFrom = Math.min(reachFrom, lo - BASE_PADDING);
      reachTo = Math.max(reachTo, hi + BASE_PADDING);
    }
    for (const offset of [
      BASE_PADDING,
      0,
      -allowance[i],
      -allowance[i] - CROSSING_RAMP,
      acrossDistance,
      -acrossDistance,
    ]) {
      breakpoints.push(lo - offset, hi + offset);
    }
  });
  from = Math.max(from, reachFrom);
  to = Math.min(to, reachTo);
  if (to <= from) {
    return 0;
  }

  const cuts = breakpoints.filter((p) => p > from && p < to);
  cuts.push(from, to);
  cuts.sort((p, q) => p - q);
  const at = (t: number) =>
    horizontal
      ? clearanceCost(
          t,
          across,
          obstacles,
          weights,
          allowance,
          exclude,
          crossingOnly,
        )
      : clearanceCost(
          across,
          t,
          obstacles,
          weights,
          allowance,
          exclude,
          crossingOnly,
        );

  let cost = 0;
  let atP = at(cuts[0]);
  for (let i = 1; i < cuts.length; i++) {
    const p = cuts[i - 1];
    const q = cuts[i];
    if (q - p > 0) {
      const atQ = at(q);
      cost += ((q - p) / 6) * (atP + 4 * at((p + q) / 2) + atQ);
      atP = atQ;
    }
  }

  return cost;
};

// -----------------------------------------------------------------------------
// Search
// -----------------------------------------------------------------------------

/** How much shorter than it is a leg still counts as long enough */
const LEG_TOLERANCE = 1e-6;

/** Indexed as the directions of the search states */
const DIRECTIONS = [HEADING_UP, HEADING_RIGHT, HEADING_DOWN, HEADING_LEFT];

const directionIndex = (heading: Heading) =>
  DIRECTIONS.findIndex((direction) => compareHeading(direction, heading));

/** Whether `p` is on the ray from `origin` along `heading` */
const isOnRay = (p: GlobalPoint, origin: GlobalPoint, heading: Heading) =>
  headingIsHorizontal(heading)
    ? p[1] === origin[1] && (p[0] - origin[0]) * heading[0] >= 0
    : p[0] === origin[0] && (p[1] - origin[1]) * heading[1] >= 0;

const manhattanDistance = (a: GlobalPoint, b: GlobalPoint) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

type SearchState = { state: number; cost: number };

/** Which way the last corner turned, if there was one */
const NO_TURN = 0;
const RIGHT_TURN = 1;
const LEFT_TURN = 2;

/**
 * The cheapest path on the grid (Dijkstra's algorithm on the grid's nodes
 * combined with the direction they're arrived at in, so the bends are costed
 * exactly), leaving the start along its heading and entering the end against
 * its heading, and costing where it crosses itself if `avoidSelfCrossing`
 */
const cheapestPath = (
  { xs, ys }: Grid,
  start: Endpoint,
  end: Endpoint,
  obstacles: Bounds[],
  weights: readonly number[],
  overlapping: boolean,
  strip: readonly number[],
  avoidSelfCrossing = false,
): GlobalPoint[] | null => {
  // (see minHairpin)
  const betweenElements =
    !overlapping &&
    start.obstacle !== null &&
    end.obstacle !== null &&
    start.obstacle !== end.obstacle;
  const cols = xs.length;
  const rows = ys.length;
  const nodeCount = cols * rows;
  const pos = (node: number) =>
    pointFrom<GlobalPoint>(xs[node % cols].at, ys[Math.floor(node / cols)].at);
  const nodeAt = (p: GlobalPoint) => {
    const col = xs.findIndex((line) => line.at === p[0]);
    const row = ys.findIndex((line) => line.at === p[1]);
    return col === -1 || row === -1 ? -1 : row * cols + col;
  };
  const neighbor = (node: number, direction: number) => {
    const col = node % cols;
    const row = Math.floor(node / cols);
    switch (direction) {
      case 0:
        return row > 0 ? node - cols : -1;
      case 1:
        return col < cols - 1 ? node + 1 : -1;
      case 2:
        return row < rows - 1 ? node + cols : -1;
    }
    return col > 0 ? node - 1 : -1;
  };

  const startNode = nodeAt(start.point);
  const endNode = nodeAt(end.point);
  if (startNode === -1 || endNode === -1) {
    return null;
  }
  // A search state is the node, the direction it's arrived at in, which way
  // the last corner turned, and where the current segment started (its row
  // moving vertically, or column horizontally), so hairpins are costed by
  // how long they are.
  //
  // Avoiding crossing itself, it's also how the route spirals: a segment
  // after three turns the same way crosses the one before them if the one
  // before it is shorter than that one, and it gets further than the one
  // after that. (That's the only way a route of up to five segments can
  // cross itself, and by far the likeliest for a longer one.) So it's how
  // many times in a row (up to three) the route turned the same way, and
  // where the segments it turned from started (each along its own axis, as
  // a line index plus one, or 0), the last one first
  const lineCount = Math.max(cols, rows);
  const anchors = lineCount + 1;
  const spiralStates = avoidSelfCrossing ? 4 * anchors ** 3 : 1;
  const spiralOf = (
    sameTurns: number,
    lastStart: number,
    secondLastStart: number,
    thirdLastStart: number,
  ) =>
    ((sameTurns * anchors + thirdLastStart) * anchors + secondLastStart) *
      anchors +
    lastStart;
  const stateOf = (
    node: number,
    direction: number,
    turn: number,
    segmentStart: number,
    spiral: number,
  ) =>
    (((node * 4 + direction) * 3 + turn) * lineCount + segmentStart) *
      spiralStates +
    spiral;
  const nodeOf = (state: number) =>
    Math.floor(state / (12 * lineCount * spiralStates));
  const indexAlong = (node: number, direction: number) =>
    direction % 2 === 0 ? Math.floor(node / cols) : node % cols;
  const startDirection = directionIndex(start.heading);
  const arrivalHeading = flipHeading(end.heading);
  const arrivalDirection = directionIndex(arrivalHeading);

  // The cost of the step from a node in a direction, by the edge (the lower
  // or left node and whether it's vertical), and whether it's on the leg
  // leaving the start or entering the end. A leg runs where its endpoint is,
  // so it's free to run as far into another element as its endpoint is
  // (only not any further), and for the padding it needs to be long, to be
  // as close to other elements as it is: otherwise, it would be as short as
  // it can be whenever the endpoint is close to another element. (Past that,
  // it costs as any other segment, so it's no longer than it needs to be.)
  const depthIn = (point: GlobalPoint) =>
    obstacles.map((obstacle) =>
      Math.max(0, -signedDistance(point[0], point[1], obstacle)),
    );
  // (and every segment as far into the other element as a leg heading at it
  // is short of room, see findRoute)
  const noAllowance = strip;
  const startAllowance = depthIn(start.point).map((depth, i) =>
    Math.max(depth, strip[i]),
  );
  const endAllowance = depthIn(end.point).map((depth, i) =>
    Math.max(depth, strip[i]),
  );
  const edgeCosts = new Map<number, number>();
  const edgeCost = (from: number, to: number, direction: number) => {
    const a = pos(from);
    const b = pos(to);
    const exemptStart =
      direction === startDirection &&
      isOnRay(a, start.point, start.heading) &&
      isOnRay(b, start.point, start.heading);
    const exemptEnd =
      direction === arrivalDirection &&
      isOnRay(a, end.point, end.heading) &&
      isOnRay(b, end.point, end.heading);
    // (the padding nearest the endpoint, which the leg needs anyway)
    const withinPadding = (endpoint: GlobalPoint) =>
      Math.max(
        manhattanDistance(a, endpoint),
        manhattanDistance(b, endpoint),
      ) <=
      BASE_PADDING + DEDUP_THRESHOLD;
    const nearEndpoint =
      (exemptStart && withinPadding(start.point)) ||
      (exemptEnd && withinPadding(end.point));
    const vertical = direction % 2 === 0;
    const key =
      (Math.min(from, to) * 2 + (vertical ? 1 : 0)) * 8 +
      (exemptStart ? 1 : 0) +
      (exemptEnd ? 2 : 0) +
      (nearEndpoint ? 4 : 0);
    let cost = edgeCosts.get(key);
    if (cost === undefined) {
      const length = manhattanDistance(a, b);
      cost =
        length +
        segmentClearanceCost(
          a,
          b,
          obstacles,
          weights,
          exemptStart && exemptEnd
            ? startAllowance.map((depth, i) => Math.max(depth, endAllowance[i]))
            : exemptStart
            ? startAllowance
            : exemptEnd
            ? endAllowance
            : noAllowance,
          (exemptStart && start.obstacle !== null ? 1 << start.obstacle : 0) |
            (exemptEnd && end.obstacle !== null ? 1 << end.obstacle : 0),
          nearEndpoint,
        );
      edgeCosts.set(key, cost);
    }
    return cost;
  };
  // The cost of a step of the segment after three turns the same way (the
  // fourth of a spiral) across the one before them (the first): by how far
  // past the first the step gets, and how far short of where the first
  // started the third stopped (both ramped in, see SELF_CROSSING_COST).
  // `firstStart` is where the first started, along its own axis, and
  // `firstAt` where it runs, along the fourth's (as line indices).
  const lines = (direction: number) => (direction % 2 === 0 ? ys : xs);
  const sign = (direction: number) =>
    direction === 1 || direction === 2 ? 1 : -1;
  const ramp = (distance: number) => clamp(distance / CROSSING_RAMP, 0, 1);
  const selfCrossingCost = (
    from: number,
    to: number,
    direction: number,
    turn: number,
    firstStart: number,
    firstAt: number,
  ) => {
    // (the third ran back towards where the first started)
    const third = (direction + (turn === RIGHT_TURN ? 3 : 1)) % 4;
    const along = (direction + 1) % 2;
    const shortBy =
      (lines(third)[firstStart].at - pos(from)[1 - along]) * sign(third);
    const past = (node: number) =>
      ramp((pos(node)[along] - lines(direction)[firstAt].at) * sign(direction));

    return SELF_CROSSING_COST * ramp(shortBy) * (past(to) - past(from));
  };

  // (with spirals tracked, there are far more states, few of which are ever
  // reached, so they're kept sparsely)
  const stateCount = avoidSelfCrossing ? 0 : nodeCount * 12 * lineCount;
  const bestCosts = avoidSelfCrossing
    ? null
    : new Float64Array(stateCount).fill(Infinity);
  const parents = avoidSelfCrossing
    ? null
    : new Int32Array(stateCount).fill(-1);
  const sparseCosts = new Map<number, number>();
  const sparseParents = new Map<number, number>();
  const best = (state: number) =>
    bestCosts ? bestCosts[state] : sparseCosts.get(state) ?? Infinity;
  const parent = (state: number) =>
    parents ? parents[state] : sparseParents.get(state) ?? -1;
  const improve = (state: number, cost: number, from: number) => {
    if (bestCosts && parents) {
      bestCosts[state] = cost;
      parents[state] = from;
    } else {
      sparseCosts.set(state, cost);
      sparseParents.set(state, from);
    }
  };
  const open = new BinaryHeap<SearchState>((s) => s.cost);

  const initial = stateOf(
    startNode,
    startDirection,
    NO_TURN,
    indexAlong(startNode, startDirection),
    0,
  );
  improve(initial, 0, -1);
  open.push({ state: initial, cost: 0 });

  while (open.size() > 0) {
    const { state, cost } = open.pop()!;
    if (cost > best(state)) {
      continue;
    }
    const spiral = state % spiralStates;
    const rest = Math.floor(state / spiralStates);
    const segmentStart = rest % lineCount;
    const lastTurn = Math.floor(rest / lineCount) % 3;
    const arrivedIn = Math.floor(rest / (3 * lineCount)) % 4;
    const node = nodeOf(state);
    if (node === endNode && arrivedIn === arrivalDirection) {
      return tracePath(state, parent, (s) => pos(nodeOf(s)));
    }
    const sameTurns = Math.floor(spiral / anchors ** 3);
    const lastStart = spiral % anchors;
    const secondLastStart = Math.floor(spiral / anchors) % anchors;

    for (let direction = 0; direction < 4; direction++) {
      // no turning back, and no turning off the leg at the start before
      // it's as long as it is, nor onto the leg at the end after it's
      // shorter than it is (see legLength)
      if (direction === (arrivedIn + 2) % 4) {
        continue;
      }
      if (direction !== arrivedIn) {
        const p = pos(node);
        if (
          (arrivedIn === startDirection &&
            isOnRay(p, start.point, start.heading) &&
            manhattanDistance(p, start.point) < start.leg - LEG_TOLERANCE) ||
          (direction === arrivalDirection &&
            isOnRay(p, end.point, end.heading) &&
            manhattanDistance(p, end.point) < end.leg - LEG_TOLERANCE)
        ) {
          continue;
        }
      }
      const next = neighbor(node, direction);
      if (next === -1) {
        continue;
      }

      let nextCost = cost + edgeCost(node, next, direction);
      let nextTurn = lastTurn;
      let nextSegmentStart = segmentStart;
      let nextSpiral = spiral;
      if (direction !== arrivedIn) {
        nextTurn = direction === (arrivedIn + 1) % 4 ? RIGHT_TURN : LEFT_TURN;
        nextSegmentStart = indexAlong(node, direction);
        if (avoidSelfCrossing) {
          // (only as many segments back as turned the same way)
          const nextSameTurns =
            nextTurn === lastTurn ? Math.min(sameTurns + 1, 3) : 1;
          nextSpiral = spiralOf(
            nextSameTurns,
            segmentStart + 1,
            nextSameTurns > 1 ? lastStart : 0,
            nextSameTurns > 2 ? secondLastStart : 0,
          );
        }
        // turning back, too close to where it came from (only too close to
        // round its corners at all, if only stepping between lines of the
        // endpoints, through them, their legs' or halfway between them, as
        // the endpoints may need it to)
        if (nextTurn === lastTurn) {
          const [from, to] =
            arrivedIn % 2 === 0
              ? [ys[segmentStart], ys[Math.floor(node / cols)]]
              : [xs[segmentStart], xs[node % cols]];
          nextCost += hairpinCost(
            Math.abs(to.at - from.at),
            betweenElements && !(from.fromEndpoints && to.fromEndpoints),
          );
        }
        // (and onto the line the next segment runs on)
        const line =
          direction % 2 === 0 ? xs[node % cols] : ys[Math.floor(node / cols)];
        nextCost +=
          BEND_COST +
          (nextTurn === LEFT_TURN ? TURN_BIAS : 0) +
          LINE_COSTS[line.kind];
      }

      // after three turns the same way, running back across the segment
      // before them
      if (nextSpiral >= 3 * anchors ** 3) {
        nextCost += selfCrossingCost(
          node,
          next,
          direction,
          nextTurn,
          (Math.floor(nextSpiral / anchors ** 2) % anchors) - 1,
          (Math.floor(nextSpiral / anchors) % anchors) - 1,
        );
      }

      const nextState = stateOf(
        next,
        direction,
        nextTurn,
        nextSegmentStart,
        nextSpiral,
      );
      if (nextCost < best(nextState)) {
        improve(nextState, nextCost, state);
        open.push({ state: nextState, cost: nextCost });
      }
    }
  }

  return null;
};

/**
 * Whether any two segments of the route (as its corner points) cross each
 * other
 */
const crossesItself = (points: GlobalPoint[]) => {
  const between = (v: number, a: number, b: number) =>
    v > Math.min(a, b) && v < Math.max(a, b);
  for (let i = 1; i < points.length; i++) {
    for (let j = i + 2; j < points.length; j++) {
      const [a, b] = [points[i - 1], points[i]];
      const [c, d] = [points[j - 1], points[j]];
      const aHorizontal = a[1] === b[1];
      if (aHorizontal === (c[1] === d[1])) {
        continue;
      }
      const [h, hEnd, v, vEnd] = aHorizontal ? [a, b, c, d] : [c, d, a, b];
      if (between(v[0], h[0], hEnd[0]) && between(h[1], v[1], vEnd[1])) {
        return true;
      }
    }
  }

  return false;
};

const tracePath = (
  state: number,
  parent: (state: number) => number,
  pos: (state: number) => GlobalPoint,
): GlobalPoint[] => {
  const path: GlobalPoint[] = [];
  for (let s = state; s !== -1; s = parent(s)) {
    path.unshift(pos(s));
  }

  return path;
};

/**
 * Only the corners of the path, with any step too short to see (between
 * endpoints nearly, but not exactly, in line) taken out: only where the route
 * carries on the same way after it, so it's never left doubling back
 */
const simplifyRoute = (path: GlobalPoint[]): GlobalPoint[] => {
  const corners = getCornerPoints(path);
  const isStep = (i: number) =>
    i >= 1 &&
    i + 2 < corners.length &&
    manhattanDistance(corners[i], corners[i + 1]) < DEDUP_THRESHOLD &&
    Math.sign(corners[i][0] - corners[i - 1][0]) ===
      Math.sign(corners[i + 2][0] - corners[i + 1][0]) &&
    Math.sign(corners[i][1] - corners[i - 1][1]) ===
      Math.sign(corners[i + 2][1] - corners[i + 1][1]);

  return corners.filter((_, i) => !isStep(i) && !isStep(i - 1));
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
