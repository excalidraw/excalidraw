/**
 * The frame an elbow arrow is routed in (see `elbowArrowTemplates.ts`): the
 * scene turned by quarter turns about the start so the route leaves the start
 * heading right (+x), and mirrored top to bottom if the end then faces down,
 * so the end faces left (the ends facing each other), right (the same way)
 * or up (across). Only by the headings, never by where the ends are, so the
 * frame doesn't change as the elements move: whatever changes in the route
 * as they move is down to the route itself.
 *
 * Quarter turns and mirroring only swap and negate coordinates, so going
 * into the frame and back is exact.
 */

import type { Heading } from "./heading";

export type Point = readonly [number, number];

/** A turn of the scene by quarter turns clockwise, then a mirroring */
export type Frame = {
  /** quarter turns clockwise (with y down), 0 to 3 */
  turns: number;
  /** mirrored top to bottom, after the turns */
  mirrored: boolean;
  /** the point the frame is turned about (the start) */
  origin: Point;
};

// a quarter turn clockwise, with y down: right to down, down to left, ...
const turn = ([x, y]: Point): Point => [-y, x];
// and back
const unturn = ([x, y]: Point): Point => [y, -x];

const turnVector = (vector: Point, turns: number) => {
  let v = vector;
  for (let i = 0; i < turns; i++) {
    v = turn(v);
  }
  return v;
};

/**
 * The frame the route from a start heading `startHeading` to an end facing
 * `endHeading` is worked out in, about the start point
 */
export const frameFor = (
  origin: Point,
  startHeading: Heading,
  endHeading: Heading,
): Frame => {
  let turns = 0;
  while (turnVector(startHeading, turns)[0] !== 1) {
    turns++;
  }
  // (an end facing down, mirrored to face up)
  const mirrored = turnVector(endHeading, turns)[1] === 1;

  return { turns, mirrored, origin };
};

export const toFrame = (frame: Frame, point: Point): Point => {
  let v: Point = [point[0] - frame.origin[0], point[1] - frame.origin[1]];
  v = turnVector(v, frame.turns);
  return frame.mirrored ? [v[0], -v[1]] : v;
};

export const fromFrame = (frame: Frame, point: Point): Point => {
  let v: Point = frame.mirrored ? [point[0], -point[1]] : point;
  for (let i = 0; i < frame.turns; i++) {
    v = unturn(v);
  }
  return [v[0] + frame.origin[0], v[1] + frame.origin[1]];
};

export const headingToFrame = (frame: Frame, heading: Heading): Point => {
  const v = turnVector(heading, frame.turns);
  return frame.mirrored ? [v[0], -v[1]] : v;
};
