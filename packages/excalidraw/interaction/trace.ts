import {
  DRAGGING_THRESHOLD,
  LINE_CONFIRM_THRESHOLD,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  DEFAULT_COLLISION_THRESHOLD,
  DOUBLE_TAP_POSITION_THRESHOLD,
} from "@excalidraw/common";

import {
  HEADING_RIGHT,
  HEADING_DOWN,
  HEADING_LEFT,
  vectorToHeading,
} from "@excalidraw/element";

import type { Vector } from "@excalidraw/math";

import type { PointerInteractionMode } from "./pointerInteractionMode";

/**
 * A behavior-preservation oracle for the App.tsx pointer-handler refactor.
 *
 * A trace records, per pointer event, only *derived symbolic* values — the
 * sign/quadrant/enum/threshold-comparison outcomes that actually decide which
 * handler branch runs. No raw coordinates and no user content: capturing raw
 * coordinates would not generalize and edges toward the privacy constraint,
 * while capturing nothing would miss the "same final position, different code
 * path" regressions that output-only assertions can't see.
 *
 * Predicate fields are omitted (not set to null) when their branch isn't
 * reached, so a refactor that skips a branch surfaces as a key-presence diff.
 */

/** Which side of a resize anchor the pointer is on, per axis. */
export type AnchorSide = "before" | "at" | "after";

/** The four corner regions binding-edge selection resolves to. */
export type BindingEdge = "topLeft" | "bottomLeft" | "bottomRight" | "topRight";

/** Arrow heading enum, matching `vectorToHeading`. */
export type HeadingDirection = "right" | "down" | "left" | "up";

/** Named distance thresholds a predicate can be compared against. */
export const TRACE_THRESHOLDS = {
  DRAGGING_THRESHOLD,
  LINE_CONFIRM_THRESHOLD,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  DEFAULT_COLLISION_THRESHOLD,
  DOUBLE_TAP_POSITION_THRESHOLD,
} as const;

export type TraceThresholdName = keyof typeof TRACE_THRESHOLDS;

export type PointerTracePredicates = {
  anchorCrossing?: { x: AnchorSide; y: AnchorSide };
  resizeFlip?: { x: boolean; y: boolean };
  inverted?: boolean;
  heading?: HeadingDirection;
  bindingEdge?: BindingEdge | null;
  /** key = threshold constant name; value = distance >= that threshold */
  distanceVsThreshold?: Partial<Record<TraceThresholdName, boolean>>;
  axisDominance?: "xDominant" | "yDominant" | "tie";
};

export type PointerTrace = {
  step: number;
  eventType: "down" | "move" | "up";
  interactionMode: PointerInteractionMode;
  predicates: PointerTracePredicates;
  elementsDelta: {
    created: string[];
    deleted: string[];
    /** ids of elements whose `type` changed since the previous step */
    mutatedTypeChanges: string[];
  };
};

const side = (pointer: number, anchor: number): AnchorSide =>
  pointer < anchor ? "before" : pointer > anchor ? "after" : "at";

/** Symbolic position of the pointer relative to a resize anchor, per axis. */
export const anchorCrossing = (
  pointer: { x: number; y: number },
  anchor: { x: number; y: number },
): { x: AnchorSide; y: AnchorSide } => ({
  x: side(pointer.x, anchor.x),
  y: side(pointer.y, anchor.y),
});

/**
 * Whether the resize flips the element per axis. Mirrors the `flipConditionsMap`
 * in resizeElements.ts (a handle only flips along axes it drives).
 */
export const resizeFlip = (
  handleDirection: string,
  pointer: { x: number; y: number },
  anchor: { x: number; y: number },
): { x: boolean; y: boolean } => {
  const flipX =
    (handleDirection.includes("e") && pointer.x < anchor.x) ||
    (handleDirection.includes("w") && pointer.x > anchor.x);
  const flipY =
    (handleDirection.includes("s") && pointer.y < anchor.y) ||
    (handleDirection.includes("n") && pointer.y > anchor.y);
  return { x: flipX, y: flipY };
};

/**
 * The cursor-inversion predicate from resizeTest.ts: an element whose width and
 * height have opposite sign has been flipped through its anchor.
 */
export const isInverted = (element: {
  width: number;
  height: number;
}): boolean => Math.sign(element.height) * Math.sign(element.width) === -1;

/** Maps a heading vector to its enum name, matching `vectorToHeading`. */
export const headingDirection = (vec: Vector): HeadingDirection => {
  const heading = vectorToHeading(vec);
  if (heading === HEADING_RIGHT) {
    return "right";
  }
  if (heading === HEADING_DOWN) {
    return "down";
  }
  if (heading === HEADING_LEFT) {
    return "left";
  }
  return "up";
};

/**
 * Which corner region a point falls into relative to a binding target's
 * non-rotated bounds, or `null` when it's over an edge (not a corner). Mirrors
 * the corner branches in binding.ts.
 */
export const bindingEdge = (
  point: { x: number; y: number },
  target: { x: number; y: number; width: number; height: number },
): BindingEdge | null => {
  const left = point.x < target.x;
  const right = point.x > target.x + target.width;
  const above = point.y < target.y;
  const below = point.y > target.y + target.height;

  if (left && above) {
    return "topLeft";
  }
  if (left && below) {
    return "bottomLeft";
  }
  if (right && below) {
    return "bottomRight";
  }
  if (right && above) {
    return "topRight";
  }
  return null;
};

/** For each supplied threshold, whether the distance meets or exceeds it. */
export const distanceVsThreshold = (
  distance: number,
  names: readonly TraceThresholdName[],
): Partial<Record<TraceThresholdName, boolean>> => {
  const result: Partial<Record<TraceThresholdName, boolean>> = {};
  for (const name of names) {
    result[name] = distance >= TRACE_THRESHOLDS[name];
  }
  return result;
};

/**
 * Which axis dominates a drag offset. Mirrors the shift-lock decision in
 * App.tsx: the axis with the larger absolute delta wins (the other is locked).
 */
export const axisDominance = (
  dx: number,
  dy: number,
): "xDominant" | "yDominant" | "tie" => {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX > absY) {
    return "xDominant";
  }
  if (absY > absX) {
    return "yDominant";
  }
  return "tie";
};
