/**
 * Connection handles: the four small circles just outside a bindable shape's
 * side midpoints that a drag pulls a new bound arrow out of.
 *
 * Geometry only — the hover/drag interaction lives in
 * `excalidraw/components/App.connectionHandles.ts`, and the drawing in
 * `excalidraw/renderer/interactiveScene.ts`.
 *
 * A handle is purely an affordance: it adds no element property. The arrow a
 * drag creates is bound through the ordinary fixed-point binding
 * (`bindBindingElementToFixedPoint`), so nothing here reaches the file format
 * or the collaboration protocol.
 */

import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type { GlobalPoint, Radians } from "@excalidraw/math";

import { getElementAbsoluteCoords } from "./bounds";
import { isBindableElement } from "./typeChecks";

import type {
  ElementsMap,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  FixedPoint,
  NonDeleted,
} from "./types";

export type ConnectionHandleSide = "top" | "right" | "bottom" | "left";

export const CONNECTION_HANDLE_SIDES = [
  "top",
  "right",
  "bottom",
  "left",
] as const;

/** Handle radius in screen px — divided by zoom so it never changes size. */
export const CONNECTION_HANDLE_RADIUS = 4.5;

/** Gap between the shape outline and the handle centre, in screen px. */
export const CONNECTION_HANDLE_OFFSET = 14;

/**
 * Slack added to the handle radius when hit-testing, in screen px. Handles are
 * small targets, so the grab area is deliberately larger than the dot.
 */
export const CONNECTION_HANDLE_HIT_SLACK = 4;

/**
 * Shapes below this size (screen px) don't get handles: four dots plus their
 * offsets would swamp the shape and collide with the resize handles.
 */
export const CONNECTION_HANDLE_MIN_SIZE = 32;

export type ConnectionHandle = {
  side: ConnectionHandleSide;
  /** scene coordinates, already rotated with the element */
  point: GlobalPoint;
};

/**
 * The binding ratio for a side's midpoint. `getShapeSideAdaptive` maps a
 * fixedPoint back to a side; this is that mapping's inverse, and is what makes
 * an arrow keep attaching to the same side when the shape is resized.
 */
export const getFixedPointForSide = (
  side: ConnectionHandleSide,
): FixedPoint => {
  switch (side) {
    case "top":
      return [0.5, 0];
    case "right":
      return [1, 0.5];
    case "bottom":
      return [0.5, 1];
    case "left":
      return [0, 0.5];
  }
};

/**
 * Whether `element` should offer connection handles at all. Mirrors
 * `isBindableElement` (so anything that can be bound can be connected from),
 * minus shapes too small to host them on screen.
 */
export const canHaveConnectionHandles = (
  element: ExcalidrawElement | null | undefined,
  zoom: number,
): element is NonDeleted<ExcalidrawBindableElement> => {
  if (!isBindableElement(element, false) || element.isDeleted) {
    return false;
  }

  return (
    element.width * zoom >= CONNECTION_HANDLE_MIN_SIZE &&
    element.height * zoom >= CONNECTION_HANDLE_MIN_SIZE
  );
};

/**
 * The four handle positions, in scene coordinates.
 *
 * Positions come from the element's unrotated bounding box, pushed outward by
 * a zoom-independent gap and then rotated with the element. Bounding-box side
 * midpoints land where you want them for every bindable shape: on the outline
 * for rectangles and images, on the curve for ellipses, and on the vertices
 * for diamonds (whose points sit at its bounding box's side midpoints).
 */
export const getConnectionHandles = (
  element: NonDeleted<ExcalidrawBindableElement>,
  elementsMap: ElementsMap,
  zoom: number,
): ConnectionHandle[] => {
  const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
    element,
    elementsMap,
  );

  // keep the on-screen gap constant regardless of zoom
  const offset = CONNECTION_HANDLE_OFFSET / zoom;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const unrotated: Record<ConnectionHandleSide, GlobalPoint> = {
    top: pointFrom(midX, y1 - offset),
    right: pointFrom(x2 + offset, midY),
    bottom: pointFrom(midX, y2 + offset),
    left: pointFrom(x1 - offset, midY),
  };

  const center = pointFrom<GlobalPoint>(cx, cy);

  return CONNECTION_HANDLE_SIDES.map((side) => ({
    side,
    point: pointRotateRads(unrotated[side], center, element.angle as Radians),
  }));
};

/**
 * The handle under `point` (scene coords), or null. Callers give this priority
 * over the shape body so a drag from a handle can't be swallowed by the shape
 * underneath it.
 */
export const hitTestConnectionHandles = (
  point: GlobalPoint,
  element: NonDeleted<ExcalidrawBindableElement>,
  elementsMap: ElementsMap,
  zoom: number,
): ConnectionHandleSide | null => {
  const threshold =
    (CONNECTION_HANDLE_RADIUS + CONNECTION_HANDLE_HIT_SLACK) / zoom;

  let closest: { side: ConnectionHandleSide; distanceSq: number } | null = null;

  for (const handle of getConnectionHandles(element, elementsMap, zoom)) {
    const dx = point[0] - handle.point[0];
    const dy = point[1] - handle.point[1];
    const distanceSq = dx * dx + dy * dy;

    if (
      distanceSq <= threshold * threshold &&
      (closest === null || distanceSq < closest.distanceSq)
    ) {
      closest = { side: handle.side, distanceSq };
    }
  }

  return closest?.side ?? null;
};

/**
 * The handle nearest to `point`, used while dragging to snap the arrow's end
 * onto a target shape's side. Unlike {@link hitTestConnectionHandles} this
 * always returns a side — the pointer only has to be over the shape, not over
 * a handle — so the snap feels magnetic rather than pixel-exact.
 */
export const getNearestConnectionHandle = (
  point: GlobalPoint,
  element: NonDeleted<ExcalidrawBindableElement>,
  elementsMap: ElementsMap,
  zoom: number,
): ConnectionHandle => {
  const handles = getConnectionHandles(element, elementsMap, zoom);

  let nearest = handles[0];
  let nearestDistanceSq = Infinity;

  for (const handle of handles) {
    const dx = point[0] - handle.point[0];
    const dy = point[1] - handle.point[1];
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq < nearestDistanceSq) {
      nearest = handle;
      nearestDistanceSq = distanceSq;
    }
  }

  return nearest;
};
