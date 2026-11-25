/**
 * Elbow arrow routing: given an arrow's endpoints and the elements they are
 * bound to (or hovering over), works out the orthogonal route between them.
 *
 * The route is worked out in the arrow's frame (see `elbowArrowFrame.ts`),
 * where it has one shape for each way the ends can face each other, with its
 * corners where they are by continuous functions of the elements' outlines
 * and the endpoints (see `elbowArrowTemplates.ts`). So it only changes
 * continuously as the elements move, except where it has to go another way
 * altogether, such as around the other side of the elements.
 *
 * The route only depends on the endpoints, their headings and elements, and
 * the arrowheads (never on where the route was before), so the same arrow
 * always gets the same route.
 *
 * Editing an existing route (moving and fixing segments, dragging endpoints of
 * an arrow with fixed segments) lives in `elbowArrow.ts`.
 */

import {
  pointFrom,
  pointTranslate,
  vector,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";

import { type Bounds, DEFAULT_ZOOM } from "@excalidraw/common";

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
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
} from "./heading";
import { isBindableElement } from "./typeChecks";
import { aabbForElement, elementCenterPoint, getArrowheadSize } from "./bounds";
import { getHoveredElementForBinding } from "./collision";
import { ELBOW_ARROW_CORNER_RADIUS } from "./shape";
import {
  frameFor,
  fromFrame,
  headingToFrame,
  toFrame,
} from "./elbowArrowFrame";
import { growOutline, shapeOutline } from "./elbowArrowOutline";
import { PADDING, routeInFrame } from "./elbowArrowTemplates";

import type { Box, RouteSignature } from "./elbowArrowTemplates";
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
export const BASE_PADDING = PADDING;

/** Segments shorter than this are considered degenerate and get removed */
export const DEDUP_THRESHOLD = 1;

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

const DIRECTIONS = [HEADING_UP, HEADING_RIGHT, HEADING_DOWN, HEADING_LEFT];

const directionIndex = (heading: Heading) =>
  DIRECTIONS.findIndex((direction) => compareHeading(direction, heading));

/**
 * The elbow arrow's route, as its corner points: leaving its start along the
 * start heading and entering its end against the end heading, and which way
 * it goes where it has to go one way or another (see `RouteSignature`)
 */
export const routeElbowArrow = (
  arrow: Pick<ElbowArrowState, "startArrowhead" | "endArrowhead">,
  {
    startGlobalPoint,
    endGlobalPoint,
    startHeading,
    endHeading: boundEndHeading,
    hoveredStartElement,
    hoveredEndElement,
  }: ElbowArrowData,
  elementsMap: ElementsMap,
): { points: GlobalPoint[]; signature: RouteSignature } => {
  const sameElement =
    !!hoveredStartElement && hoveredStartElement.id === hoveredEndElement?.id;
  // An arrow from a point of an element back to the same point would have to
  // run back over itself to enter it the way it left: it loops around the
  // corner instead, entering it from the next side around (clockwise)
  const endHeading =
    sameElement &&
    Math.abs(startGlobalPoint[0] - endGlobalPoint[0]) +
      Math.abs(startGlobalPoint[1] - endGlobalPoint[1]) <
      DEDUP_THRESHOLD &&
    compareHeading(startHeading, boundEndHeading)
      ? DIRECTIONS[(directionIndex(boundEndHeading) + 1) % 4]
      : boundEndHeading;

  // room to round the corner, or for an arrowhead and some of the rounding
  const minLeg = (arrowhead: Arrowhead | null) =>
    arrowhead
      ? getArrowheadSize(arrowhead) + ELBOW_ARROW_CORNER_RADIUS / 4
      : ELBOW_ARROW_CORNER_RADIUS / 2;

  const frame = frameFor(startGlobalPoint, startHeading, endHeading);
  // the elements' outlines (with their binding gap, and with the padding
  // around that) in the frame, or the endpoints themselves where they're not
  // bound
  const box = (
    element: ExcalidrawBindableElement | null,
    point: GlobalPoint,
  ): Box => {
    if (!element) {
      const at = toFrame(frame, point);
      return {
        l: at[0],
        t: at[1],
        r: at[0],
        b: at[1],
        solid: false,
        gap: 0,
        shape: "rectangle",
        outline: [at],
        near: [at],
        far: growOutline([at], PADDING),
      };
    }
    const gap = getBindingGap(element);
    const shape =
      element.type === "diamond" || element.type === "ellipse"
        ? element.type
        : "rectangle";
    const [cx, cy] = elementCenterPoint(element, elementsMap);
    const outline = shapeOutline(
      shape,
      cx,
      cy,
      Math.abs(element.width) / 2,
      Math.abs(element.height) / 2,
      element.angle,
    ).map((point) => toFrame(frame, point));
    const near = growOutline(outline, gap);
    const xs = near.map(([x]) => x);
    const ys = near.map(([, y]) => y);
    return {
      l: Math.min(...xs),
      t: Math.min(...ys),
      r: Math.max(...xs),
      b: Math.max(...ys),
      solid: true,
      gap,
      shape,
      outline,
      near,
      far: growOutline(outline, gap + PADDING),
    };
  };
  const start = box(hoveredStartElement, startGlobalPoint);
  // (looping back to the same point, the end is where it is on the outline,
  // rather than on the side it's entered from)
  const endBox =
    endHeading !== boundEndHeading
      ? box(null, endGlobalPoint)
      : sameElement
      ? start
      : box(hoveredEndElement, endGlobalPoint);
  const facingVector = headingToFrame(frame, endHeading);

  const { points, signature } = routeInFrame({
    start,
    endBox,
    end: toFrame(frame, endGlobalPoint),
    facing:
      facingVector[0] === -1 ? "left" : facingVector[0] === 1 ? "right" : "up",
    startMinLeg: minLeg(arrow.startArrowhead),
    endMinLeg: minLeg(arrow.endArrowhead),
    sameElement,
    radius: ELBOW_ARROW_CORNER_RADIUS,
  });

  const route = tidyRoute(
    points.map((point) => {
      const [x, y] = fromFrame(frame, point);
      return pointFrom<GlobalPoint>(x, y);
    }),
  );
  // (exactly at the endpoints, and the legs exactly along their headings,
  // whatever rounding there was on the way into the frame and back)
  route[0] = startGlobalPoint;
  route[route.length - 1] = endGlobalPoint;
  if (route.length > 2) {
    const along = (heading: Heading) => (heading[0] !== 0 ? 1 : 0);
    const first = along(startHeading);
    route[1] = pointFrom<GlobalPoint>(
      first === 0 ? startGlobalPoint[0] : route[1][0],
      first === 1 ? startGlobalPoint[1] : route[1][1],
    );
    const last = along(endHeading);
    const i = route.length - 2;
    route[i] = pointFrom<GlobalPoint>(
      last === 0 ? endGlobalPoint[0] : route[i][0],
      last === 1 ? endGlobalPoint[1] : route[i][1],
    );
  }

  return { points: route, signature };
};

/**
 * The elbow arrow's route, as its corner points: leaving its start along the
 * start heading and entering its end against the end heading
 */
export const getElbowArrowRoute = (
  arrow: ElbowArrowState,
  data: ElbowArrowData,
  elementsMap: ElementsMap,
): GlobalPoint[] => routeElbowArrow(arrow, data, elementsMap).points;

/**
 * The route's corner points, without any repeated (or closer than a tiny
 * fraction of a px, from rounding), or between segments running on along
 * the same line the same way, and without any step too short to see
 * (between endpoints nearly, but not exactly, in line): only where the route
 * carries on the same way after it, so it's never left doubling back
 */
const tidyRoute = (points: GlobalPoint[]): GlobalPoint[] => {
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const tidy: GlobalPoint[] = [];
  for (const point of points) {
    const last = tidy[tidy.length - 1];
    if (last && same(last[0], point[0]) && same(last[1], point[1])) {
      continue;
    }
    tidy.push(point);
    while (tidy.length >= 3) {
      const [a, b, c] = tidy.slice(-3);
      const onLine =
        (same(a[0], b[0]) && same(b[0], c[0])) ||
        (same(a[1], b[1]) && same(b[1], c[1]));
      const onward =
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) > 0;
      if (onLine && onward) {
        tidy.splice(tidy.length - 2, 1);
      } else {
        break;
      }
    }
  }

  const isStep = (i: number) =>
    i >= 1 &&
    i + 2 < tidy.length &&
    Math.abs(tidy[i][0] - tidy[i + 1][0]) +
      Math.abs(tidy[i][1] - tidy[i + 1][1]) <
      DEDUP_THRESHOLD &&
    Math.sign(tidy[i][0] - tidy[i - 1][0]) ===
      Math.sign(tidy[i + 2][0] - tidy[i + 1][0]) &&
    Math.sign(tidy[i][1] - tidy[i - 1][1]) ===
      Math.sign(tidy[i + 2][1] - tidy[i + 1][1]);

  return tidy.filter((_, i) => !isStep(i) && !isStep(i - 1));
};
