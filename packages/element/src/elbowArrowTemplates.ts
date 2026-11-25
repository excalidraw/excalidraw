/**
 * Elbow arrow routes, worked out in the arrow's frame (see
 * `elbowArrowFrame.ts`): the start at the origin, leaving right (+x), and the
 * end at `end`, facing left (the ends facing each other), right (the same
 * way) or up (across), the route entering it against that.
 *
 * Each of the three has one route shape, with every corner where it is by
 * a continuous function of where the elements are (their outlines and the
 * endpoints): a shape with fewer corners is the same shape with some of its
 * segments down to nothing. So the route only ever changes continuously as
 * the elements move, except where it has to go another way altogether (see
 * `RouteSignature`): around one side of the elements rather than the other,
 * or around them rather than between them once the gap between them closes.
 * Those are decided by comparing positions linearly, so dragging an element
 * along a line crosses each of them once at most, never back and forth.
 *
 * The route keeps clear of the elements' actual outlines (see
 * `elbowArrowOutline.ts`), rather than their bounds: each segment of them
 * only as far as the outlines reach over the span the segment runs along, so
 * a route runs as close by a diamond or an ellipse as by a rectangle.
 *
 * Nothing is remembered between routes: the route is a function of the
 * elements and the endpoints alone.
 */

import { clamp } from "@excalidraw/math";

import { reach, runsThrough } from "./elbowArrowOutline";

import type { Point } from "./elbowArrowFrame";
import type { Side } from "./elbowArrowOutline";

/** The clearance a route keeps around the elements it connects */
export const PADDING = 40;

/**
 * How much faster than an element moves a segment moves out of its way, as
 * it moves into the segment's way: fast, so the segment is soon clear of it,
 * but not so fast it jumps (a segment moving more than three times as far as
 * the element is as good as jumping)
 */
const DODGE_RATE = 3;

/**
 * How far the end's element can rise into the way of the route climbing past
 * it, or the climb be over it, and the route still climb past it, rather
 * than go around it: a little,
 * as where only its binding gap or a corner of its bounds is in the way, so
 * the route doesn't swing around it before it has to
 */
const SQUEEZE_OVERLAP = PADDING / 2;

/**
 * An endpoint's element: its outline, and its bounds (with the binding gap),
 * or the endpoint itself (`solid` false), where it's not bound, which the
 * route doesn't avoid
 */
export type Box = {
  l: number;
  t: number;
  r: number;
  b: number;
  solid: boolean;
  /** how far out the bounds are from the element's (its binding gap) */
  gap: number;
  /** what the element is, for whether there's room in its bounds' corners */
  shape: "rectangle" | "diamond" | "ellipse";
  /** the element's outline (convex, see `elbowArrowOutline.ts`) */
  outline: Point[];
  /** the outline with the binding gap around it (bounded by `l`...`b`) */
  near: Point[];
  /** and with the padding around that */
  far: Point[];
};

export type RouteInput = {
  /** the start's element (the start is at the origin, leaving right) */
  start: Box;
  /** the end's element */
  endBox: Box;
  end: Point;
  /** which way the end faces: left, right or up */
  facing: "left" | "right" | "up";
  /** the shortest the first and the last segment can be */
  startMinLeg: number;
  endMinLeg: number;
  /** both ends bound to the same element */
  sameElement: boolean;
  /** the corner radius, for how far apart segments turning back are */
  radius: number;
};

/**
 * Which way the route goes, where it has to go one way or another: the
 * route only changes other than continuously where this does
 */
export type RouteSignature = string;

export type Route = { points: Point[]; signature: RouteSignature };

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

const mid = (a: number, b: number) => (a + b) / 2;

/**
 * How far an element (with its binding gap) reaches toward `side` over the
 * span from `from` to `to` across it, which a segment over that span keeps
 * clear of
 */
const near = (box: Box, side: Side, from: number, to: number) =>
  reach(box.near, side, from, to);

/** And with the padding around it */
const far = (box: Box, side: Side, from: number, to: number) =>
  reach(box.far, side, from, to);

/**
 * `v` between `lo` and `hi`, but kept a corner radius clear of either where
 * there's room (and halfway between them where there isn't), so a segment
 * there doesn't run on along the one before or after it
 */
const clampClear = (v: number, lo: number, hi: number, radius: number) => {
  if (hi < lo) {
    return mid(lo, hi);
  }
  const h = Math.min(radius, (hi - lo) / 2);
  return clamp(v, lo + h, hi - h);
};

/**
 * How long a leg is: the padding, but with the other element ahead of it,
 * closer than twice that, only half the room to it, so the route turns
 * halfway between them; plus how far it is to the side of the leg's line, or
 * how far behind the leg it starts, so the leg changes continuously as the
 * elements move. Never shorter than `minLeg`.
 */
const legLength = (
  point: Point,
  heading: Point,
  own: Box,
  other: Box,
  minLeg: number,
) => {
  if (!other.solid || other === own) {
    return Math.max(minLeg, PADDING);
  }
  const axis = heading[0] !== 0 ? 0 : 1;
  const sign = heading[axis];
  const [back, forward]: Side[] = axis === 0 ? ["l", "r"] : ["t", "b"];
  const [acrossLo, acrossHi]: Side[] = axis === 0 ? ["t", "b"] : ["l", "r"];
  const across = point[1 - axis];
  // (where the leg leaves its element along its line, and where it would run
  // into the other one, or how far the other one is to the side of it)
  const exit = own.solid
    ? sign > 0
      ? Math.max(near(own, forward, across, across), point[axis])
      : Math.min(near(own, back, across, across), point[axis])
    : point[axis];
  const ahead =
    (near(other, sign > 0 ? back : forward, across, across) - exit) * sign;
  const beside = Math.max(
    near(other, acrossLo, -Infinity, Infinity) - across,
    across - near(other, acrossHi, -Infinity, Infinity),
    0,
  );

  return Math.max(
    minLeg,
    Math.min(PADDING, beside + (ahead >= 0 ? ahead / 2 : -ahead)),
  );
};

/**
 * How much a leg grows past its shortest as the ends go further past each
 * other (`overshoot`), twice as fast, up to its full length: so the route
 * turning back between them widens continuously from nothing, but soon
 */
const grow = (overshoot: number, leg: number, minLeg: number) =>
  clamp(2 * overshoot, 0, Math.max(0, leg - minLeg));

/**
 * Whether a detour between `y1` and `y2` goes over the top (to `top`) rather
 * than under the bottom (to `bottom`): the shorter way, the one it runs less
 * far out of its way, which only flips once as an element moves along a line
 */
const overTheTop = (y1: number, y2: number, top: number, bottom: number) =>
  y1 + y2 <= top + bottom;

/**
 * How far a segment at `at` (across it), from `from` to `to` (along it),
 * has to move to clear `box` with the padding around it, where its outline
 * reaches over the segment's span: negative to move up (or left), positive
 * down (or right), the shallower way (so it only flips as the box's middle
 * passes it), ramped in with how far its span reaches into the element along
 * it (rather than its binding gap), so it starts dodging from nothing
 */
const dodge = (
  box: Box,
  at: number,
  from: number,
  to: number,
  horizontal: boolean,
) => {
  if (!box.solid) {
    return 0;
  }
  const [lo, hi] = horizontal ? [box.l, box.r] : [box.t, box.b];
  const [acrossLo, acrossHi]: Side[] = horizontal ? ["t", "b"] : ["l", "r"];
  const reachAlong =
    Math.min(Math.max(from, to), hi - box.gap) -
    Math.max(Math.min(from, to), lo + box.gap);
  const up = at - far(box, acrossLo, from, to);
  const down = far(box, acrossHi, from, to) - at;
  if (reachAlong <= 0 || up <= 0 || down <= 0) {
    return 0;
  }
  return up < down
    ? -Math.min(up, DODGE_RATE * reachAlong)
    : Math.min(down, DODGE_RATE * reachAlong);
};

/**
 * How far a horizontal segment at `at`, from `from` to `to`, has to move up
 * (negative) to clear `box` with the padding over it, ramped in with how far
 * its span reaches into the element (rather than its binding gap)
 */
const dodgeUp = (box: Box, at: number, from: number, to: number) => {
  if (!box.solid) {
    return 0;
  }
  const reachAlong =
    Math.min(Math.max(from, to), box.r - box.gap) -
    Math.max(Math.min(from, to), box.l + box.gap);
  return -Math.max(
    0,
    Math.min(at - far(box, "t", from, to), DODGE_RATE * reachAlong),
  );
};

/**
 * Whether the route runs clear of the elements' outlines, but for its legs:
 * where they're diamonds or ellipses, whose outlines leave the corners of
 * their bounds clear, it can run between them across those corners, even
 * where their bounds overlap
 */
const clearBetween = (points: Point[], boxes: Box[]) =>
  boxes.every((box) => box.shape !== "rectangle") &&
  points
    .slice(2, -1)
    .every((point, i) =>
      boxes.every(
        (box) => !box.solid || !runsThrough(box.outline, points[i + 1], point),
      ),
    );

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

/**
 * The ends facing each other: a Z, turning halfway between the elements;
 * past each other, an S turning back between them, or with no room between
 * them (or a little, see `squeeze`), around them
 */
const routeFacing = (input: RouteInput): Route => {
  const { start: a, endBox: b, end } = input;
  const [ex, ey] = end;
  const ms = input.startMinLeg;
  const me = input.endMinLeg;
  // (where the turn between them, from the start's line to the end's, is
  // clear of them)
  const startExit = a.solid ? Math.max(0, near(a, "r", 0, ey)) : 0;
  const endExit = b.solid ? Math.min(ex, near(b, "l", 0, ey)) : ex;
  const legS = legLength([0, 0], [1, 0], a, b, ms);
  const legE = legLength(end, [-1, 0], b, a, me);
  const lo = Math.max(ms, startExit);
  const hi = Math.min(ex - me, endExit);
  const overshoot = lo - hi;

  if (overshoot <= 0) {
    // (halfway between the elements, past both legs, or, where there isn't
    // room for both, as far into it as the end with the arrowhead (the
    // longer shortest leg) leaves, or halfway, with the same at both ends)
    const legsFrom = Math.max(lo, legS);
    const legsTo = Math.min(hi, ex - legE);
    const x = clamp(
      legsFrom <= legsTo
        ? clamp(mid(startExit, endExit), legsFrom, legsTo)
        : me > ms
        ? legsTo
        : ms > me
        ? legsFrom
        : mid(legsFrom, legsTo),
      lo,
      hi,
    );
    return {
      points: [[0, 0], [x, 0], [x, ey], end],
      signature: "facing",
    };
  }

  const down = ey >= 0;
  const squeeze = input.sameElement ? 0 : ms + me + 2 * input.radius;
  const x1 = lo + grow(overshoot, legS, ms);
  const x2 = hi - grow(overshoot, legE, me);
  // (between where the upper one reaches down to and the lower one up to,
  // over the span the segment between them runs)
  const [upper, lower] = down ? [a, b] : [b, a];
  const upperEdge = near(upper, "b", x2, x1);
  const lowerEdge = near(lower, "t", x2, x1);
  const y = down
    ? clampClear(mid(upperEdge, lowerEdge), 0, ey, input.radius)
    : clampClear(mid(upperEdge, lowerEdge), ey, 0, input.radius);
  const between: Point[] = [[0, 0], [x1, 0], [x1, y], [x2, y], [x2, ey], end];
  const apart = lowerEdge - upperEdge >= -(a.gap + b.gap);
  if (apart || overshoot <= squeeze || clearBetween(between, [a, b])) {
    return {
      points: between,
      signature:
        apart || overshoot > squeeze ? "facing:between" : "facing:squeeze",
    };
  }

  // around them, over the top or under the bottom
  const around = (top: boolean) => {
    // (the start's segment up or down from its line, and the end's down or
    // up to its line)
    const [s1, s2] = top ? [-Infinity, 0] : [0, Infinity];
    const [e1, e2] = top ? [-Infinity, ey] : [ey, Infinity];
    // (clear of the other element on the way there, where its outline
    // reaches past the segment there, ramped in with how far the segment
    // runs into its bounds, which moves no faster than the element does)
    let ax1 = Math.max(a.solid ? Math.max(0, near(a, "r", s1, s2)) : 0, legS);
    ax1 += Math.min(
      Math.max(0, far(b, "r", s1, s2) - ax1),
      DODGE_RATE * Math.max(0, Math.min(ax1 - b.l, top ? -b.t : b.b)),
    );
    let ax2 = Math.min(
      b.solid ? Math.min(ex, near(b, "l", e1, e2)) : ex,
      ex - legE,
    );
    ax2 -= Math.min(
      Math.max(0, ax2 - far(a, "l", e1, e2)),
      DODGE_RATE * Math.max(0, Math.min(a.r - ax2, top ? ey - a.t : a.b - ey)),
    );
    // (and as far out as the elements reach over the span it runs past them)
    const solid = [a, b].filter((box) => box.solid);
    const lines = solid.map((box) =>
      far(box, top ? "t" : "b", Math.min(ax1, ax2), Math.max(ax1, ax2)),
    );
    return {
      ax1,
      ax2,
      ay: top ? Math.min(...lines) : Math.max(...lines),
    };
  };
  const over = around(true);
  const under = around(false);
  const top = overTheTop(0, ey, over.ay, under.ay);
  const { ax1, ax2, ay } = top ? over : under;
  return {
    points: [[0, 0], [ax1, 0], [ax1, ay], [ax2, ay], [ax2, ey], end],
    signature: top ? "facing:over" : "facing:under",
  };
};

/**
 * The ends facing the same way: a U around the far side of both, dodging
 * the other element where the first or the last segment would run into it
 */
const routeParallel = (input: RouteInput): Route => {
  const { start: a, endBox: b, end } = input;
  const [ex, ey] = end;
  const ms = input.startMinLeg;
  const me = input.endMinLeg;
  // (where the turn from the start's line to the end's is clear of them)
  const startExit = a.solid ? Math.max(0, near(a, "r", 0, ey)) : 0;
  const endExit = b.solid ? Math.max(ex, near(b, "r", 0, ey)) : ex;
  let xs = Math.max(startExit, legLength([0, 0], [1, 0], a, b, ms));
  let xe = Math.max(endExit, ex + legLength(end, [1, 0], b, a, me));
  let x = Math.max(xs, xe);

  // (the first segment past the start's leg, clear of the end's element,
  // and the last one before the end's, clear of the start's)
  const ys = dodge(b, 0, xs, x, true);
  const ye = ey + dodge(a, ey, xe, x, true);
  // (and the turns, clear of the elements where they reach past the lines)
  if (a.solid) {
    xs = Math.max(xs, near(a, "r", 0, ys));
  }
  if (b.solid) {
    xe = Math.max(xe, near(b, "r", ye, ey));
  }
  x = Math.max(
    x,
    xs,
    xe,
    a.solid ? near(a, "r", ys, ye) : -Infinity,
    b.solid ? near(b, "r", ys, ye) : -Infinity,
  );

  return {
    points: [
      [0, 0],
      [xs, 0],
      [xs, ys],
      [x, ys],
      [x, ye],
      [xe, ye],
      [xe, ey],
      end,
    ],
    signature: `parallel:${ys < 0 ? "over" : ys > 0 ? "under" : "-"}:${
      ye < ey ? "over" : ye > ey ? "under" : "-"
    }`,
  };
};

/**
 * The end facing up, across the start: an L, turning above the end, or
 * further up (or over the elements) where the end is above the start's leg,
 * or back between the elements (or over them) where it's behind it
 */
const routeAcross = (input: RouteInput): Route => {
  const { start: a, endBox: b, end } = input;
  const [ex, ey] = end;
  const ms = input.startMinLeg;
  const me = input.endMinLeg;
  // (where the L's turn, down from the start's line to the end, is clear of
  // the start's element, and where the end's leg, up from it, is clear of
  // the end's, under the start's line along to it)
  const startExit = a.solid ? Math.max(0, near(a, "r", 0, Math.max(0, ey))) : 0;
  const endExit = b.solid ? Math.min(ey, near(b, "t", 0, ex)) : ey;
  const legS = legLength([0, 0], [1, 0], a, b, ms);
  const legE = legLength(end, [0, -1], b, a, me);
  const lo = Math.max(ms, startExit);
  // how far the end is behind where the start's leg can turn, and how far
  // above where the end's leg can start
  const behind = lo - ex;
  const above = Math.max(me - ey, -endExit);

  if (above > 0) {
    // (clear of the start's element above its line, where it climbs)
    const upExit = a.solid ? Math.max(0, near(a, "r", -Infinity, 0)) : 0;
    const upLo = Math.max(ms, upExit);
    const upBehind = upLo - ex;
    const endLeft = b.solid ? near(b, "l", -Infinity, 0) : ex;
    let x1 =
      upBehind > 0
        ? upLo + grow(upBehind, legS, ms)
        : clamp(mid(upExit, endLeft), upLo, ex);
    // (climbing a leg's length out, or as far as halfway to the end's
    // element ahead of it, past the end, the further the higher it climbs,
    // so it's turning onto the end's line where it doesn't climb at all, but
    // not where the end is below the start's leg, which coming back down to
    // it would cross)
    const ahead = b.solid ? endLeft - upExit : Infinity;
    const past = Math.max(
      x1,
      Math.min(
        Math.max(upExit, legS),
        ex + 2 * Math.max(0, above - DODGE_RATE * Math.max(0, ey)),
        upExit + Math.max(0, ahead) / 2 + DODGE_RATE * Math.max(0, -ahead),
      ),
    );
    // (but a corner's width clear of the end's line, where it would turn
    // back right by it, rather than squeezing a U turn in next to the end)
    x1 = past > ex - input.radius ? Math.max(past, ex + input.radius) : past;
    // (above the end's element, where it reaches over the segment's span)
    const climb = Math.max(above, b.solid ? -near(b, "t", ex, x1) : -Infinity);
    let y = -climb - grow(climb, legE, me);
    // (over the start's element, where the segment there runs back over
    // it, as far as it does)
    y += dodgeUp(a, y, ex, x1);
    // (and past the end's element, where it's in the way of the climb: the
    // route has to go around the other side of it, as going over to there
    // gradually would run through it)
    // (where it would run through more of it than running on past it
    // would, where the start's leg runs into it)
    const climbing = b.solid
      ? Math.min(near(b, "b", x1, x1), 0) - Math.max(near(b, "t", x1, x1), y)
      : 0;
    const passing =
      b.solid && b.t < 0 && b.b > 0 ? Math.max(0, near(b, "r", 0, 0) - x1) : 0;
    const blocked =
      b.solid &&
      climbing > SQUEEZE_OVERLAP &&
      passing < climbing &&
      x1 > near(b, "l", y, 0) + b.gap + SQUEEZE_OVERLAP &&
      x1 < far(b, "r", y, 0);
    if (blocked) {
      x1 = far(b, "r", -Infinity, 0);
      y = Math.min(y, near(b, "t", ex, x1), ey - legE);
    }
    return {
      points: [[0, 0], [x1, 0], [x1, y], [ex, y], end],
      signature: blocked
        ? "across:up:past"
        : x1 > ex
        ? "across:up:back"
        : "across:up",
    };
  }

  if (behind > 0) {
    const x1 = lo + grow(behind, legS, ms);
    // (between where the start's element reaches down to and the end's up
    // to, over the span the segment between them runs)
    const startEdge = near(a, "b", ex, x1);
    const endEdge = near(b, "t", ex, x1);
    const endTop = b.solid ? Math.min(ey, endEdge) : ey;
    const squeeze = input.sameElement ? 0 : ms + me + 2 * input.radius;
    // (halfway between the elements, clear of the start's leg, short of the
    // end's)
    const hi = Math.max(0, endTop - me);
    let y = clamp(mid(startEdge, endEdge), Math.min(input.radius, hi / 2), hi);
    // (but where the segment there runs back under the start's element, as
    // far as it does, no closer to it than to the end, where there isn't
    // room for the end's leg as well, at the expense of the end's leg: so it
    // stays between them, rather than running along the element)
    const reachAlong = a.solid
      ? Math.min(x1, a.r - a.gap) - Math.max(ex, a.l + a.gap)
      : 0;
    y += Math.max(
      0,
      Math.min(
        mid(reach(a.outline, "b", ex, x1), endTop) - y,
        DODGE_RATE * reachAlong,
        endTop - input.radius / 2 - y,
      ),
    );
    const between: Point[] = [[0, 0], [x1, 0], [x1, y], [ex, y], end];
    const apart = endEdge - startEdge >= -(a.gap + b.gap);
    if (apart || behind <= squeeze || clearBetween(between, [a, b])) {
      return {
        points: between,
        signature:
          apart || behind > squeeze ? "across:between" : "across:squeeze",
      };
    }
    const over = Math.min(endTop, ey - legE, far(a, "t", ex, x1));
    // (clear of the start's element above its line, climbing over it)
    const xo = Math.max(x1, a.solid ? near(a, "r", over, 0) : 0);
    return {
      points: [[0, 0], [xo, 0], [xo, over], [ex, over], end],
      signature: "across:over",
    };
  }

  return {
    points: [[0, 0], [ex, 0], end],
    signature: "across",
  };
};

export const routeInFrame = (input: RouteInput): Route =>
  input.facing === "left"
    ? routeFacing(input)
    : input.facing === "right"
    ? routeParallel(input)
    : routeAcross(input);
