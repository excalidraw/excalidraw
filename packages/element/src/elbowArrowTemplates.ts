/**
 * Elbow arrow routes, worked out in the arrow's frame (see
 * `elbowArrowFrame.ts`): the start at the origin, leaving right (+x), and the
 * end at `end`, facing left (the ends facing each other), right (the same
 * way) or up (across), the route entering it against that.
 *
 * Each of the three has one route shape, with every corner where it is by
 * a continuous function of where the elements are (their bounds and the
 * endpoints): a shape with fewer corners is the same shape with some of its
 * segments down to nothing. So the route only ever changes continuously as
 * the elements move, except where it has to go another way altogether (see
 * `RouteSignature`): around one side of the elements rather than the other,
 * or around them rather than between them once the gap between them closes.
 * Those are decided by comparing positions linearly, so dragging an element
 * along a line crosses each of them once at most, never back and forth.
 *
 * Nothing is remembered between routes: the route is a function of the
 * elements and the endpoints alone.
 */

import { clamp } from "@excalidraw/math";

import type { Point } from "./elbowArrowFrame";

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
 * An endpoint's element's bounds (with the binding gap), or the endpoint
 * itself (`solid` false), where it's not bound, which the route doesn't
 * avoid
 */
export type Box = {
  l: number;
  t: number;
  r: number;
  b: number;
  solid: boolean;
  /** how far out the bounds are from the element's (its binding gap) */
  gap: number;
  /** the element's outline in the bounds */
  shape: "rectangle" | "diamond" | "ellipse";
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
 * How long a leg is: the padding, but with the other element (its bounds)
 * ahead of it, closer than twice that, only half the room to it, so the
 * route turns halfway between them; plus how far it is to the side of the
 * leg's line, or how far behind the leg it starts, so the leg changes
 * continuously as the elements move. Never shorter than `minLeg`.
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
  const ownLo = axis === 0 ? own.l : own.t;
  const ownHi = axis === 0 ? own.r : own.b;
  const otherLo = axis === 0 ? other.l : other.t;
  const otherHi = axis === 0 ? other.r : other.b;
  const exit = own.solid
    ? sign > 0
      ? Math.max(ownHi, point[axis])
      : Math.min(ownLo, point[axis])
    : point[axis];
  const ahead = ((sign > 0 ? otherLo : otherHi) - exit) * sign;
  const across = point[1 - axis];
  const acrossLo = axis === 0 ? other.t : other.l;
  const acrossHi = axis === 0 ? other.b : other.r;
  const beside = Math.max(acrossLo - across, across - acrossHi, 0);

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

/** The bounds around the solid ones of the boxes, or null if none is */
const around = (boxes: Box[]) => {
  const solid = boxes.filter((box) => box.solid);
  if (!solid.length) {
    return null;
  }
  return {
    top: Math.min(...solid.map((box) => box.t)) - PADDING,
    bottom: Math.max(...solid.map((box) => box.b)) + PADDING,
  };
};

/**
 * Whether a detour between `y1` and `y2` goes over the top (to `top`) rather
 * than under the bottom (to `bottom`): the shorter way, the one it runs less
 * far out of its way, which only flips once as an element moves along a line
 */
const overTheTop = (y1: number, y2: number, top: number, bottom: number) =>
  y1 + y2 <= top + bottom;

/**
 * How far a segment at `at` (across it), from `from` to `to` (along it),
 * has to move to clear `box` with the padding around it: negative to move up
 * (or left), positive down (or right), the shallower way (so it only flips
 * as the box's middle passes it), ramped in with how far its span reaches
 * into the element along it (rather than its binding gap), so it starts
 * dodging from nothing
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
  const [acrossLo, acrossHi] = horizontal ? [box.t, box.b] : [box.l, box.r];
  const reach =
    Math.min(Math.max(from, to), hi - box.gap) -
    Math.max(Math.min(from, to), lo + box.gap);
  const up = at - (acrossLo - PADDING);
  const down = acrossHi + PADDING - at;
  if (reach <= 0 || up <= 0 || down <= 0) {
    return 0;
  }
  return up < down
    ? -Math.min(up, DODGE_RATE * reach)
    : Math.min(down, DODGE_RATE * reach);
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
  const reach =
    Math.min(Math.max(from, to), box.r - box.gap) -
    Math.max(Math.min(from, to), box.l + box.gap);
  return -Math.max(0, Math.min(at - (box.t - PADDING), DODGE_RATE * reach));
};

/**
 * Whether an axis-aligned segment runs through the element's outline in
 * `box` (its own, without the binding gap)
 */
const crosses = (box: Box, [x1, y1]: Point, [x2, y2]: Point) => {
  if (!box.solid) {
    return false;
  }
  const cx = mid(box.l, box.r);
  const cy = mid(box.t, box.b);
  const hw = (box.r - box.l) / 2 - box.gap;
  const hh = (box.b - box.t) / 2 - box.gap;
  const horizontal = y1 === y2;
  // (how far across from the middle it runs, as a share of the half size,
  // and how far the outline reaches along it there)
  const [across, half, alongHalf, center] = horizontal
    ? [Math.abs(y1 - cy) / hh, hw, hh, cx]
    : [Math.abs(x1 - cx) / hw, hh, hw, cy];
  if (!(across < 1) || !(alongHalf > 0)) {
    return false;
  }
  const reach =
    box.shape === "diamond"
      ? half * (1 - across)
      : box.shape === "ellipse"
      ? half * Math.sqrt(1 - across * across)
      : half;
  const [from, to] = horizontal
    ? [Math.min(x1, x2), Math.max(x1, x2)]
    : [Math.min(y1, y2), Math.max(y1, y2)];
  return from < center + reach && to > center - reach;
};

/**
 * How far up (`top`) or down an element's outline (with its binding gap)
 * reaches between `from` and `to` across: its bounds' side for a rectangle,
 * and for a diamond or an ellipse, only as far as it does there (as far as
 * its side corner past it), so a segment between two of them runs between
 * their outlines, rather than their bounds
 */
const outlineEdge = (box: Box, top: boolean, from: number, to: number) => {
  if (box.shape === "rectangle") {
    return top ? box.t : box.b;
  }
  const cx = mid(box.l, box.r);
  const cy = mid(box.t, box.b);
  const hw = (box.r - box.l) / 2 - box.gap;
  const hh = (box.b - box.t) / 2 - box.gap;
  const x = clamp(cx, Math.min(from, to), Math.max(from, to));
  const d = hw > 0 ? Math.min(1, Math.abs(x - cx) / hw) : 1;
  const reach =
    hh * (box.shape === "diamond" ? 1 - d : Math.sqrt(1 - d * d)) + box.gap;
  return top ? cy - reach : cy + reach;
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
      boxes.every((box) => !crosses(box, points[i + 1], point)),
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
  const startExit = a.solid ? Math.max(0, a.r) : 0;
  const endExit = b.solid ? Math.min(ex, b.l) : ex;
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
  const gap = down ? b.t - a.b : a.t - b.b;
  const squeeze = input.sameElement ? 0 : ms + me + 2 * input.radius;
  const x1 = lo + grow(overshoot, legS, ms);
  const x2 = hi - grow(overshoot, legE, me);
  const y = down
    ? clampClear(
        mid(outlineEdge(a, false, x2, x1), outlineEdge(b, true, x2, x1)),
        0,
        ey,
        input.radius,
      )
    : clampClear(
        mid(outlineEdge(a, true, x2, x1), outlineEdge(b, false, x2, x1)),
        ey,
        0,
        input.radius,
      );
  const between: Point[] = [[0, 0], [x1, 0], [x1, y], [x2, y], [x2, ey], end];
  const apart = gap >= -(a.gap + b.gap);
  if (apart || overshoot <= squeeze || clearBetween(between, [a, b])) {
    return {
      points: between,
      signature:
        apart || overshoot > squeeze ? "facing:between" : "facing:squeeze",
    };
  }

  const lines = around([a, b])!;
  const top = overTheTop(0, ey, lines.top, lines.bottom);
  const ay = top ? lines.top : lines.bottom;
  // (clear of the other element on the way there)
  let ax1 = Math.max(startExit, legS);
  ax1 += Math.min(
    Math.max(0, b.r + PADDING - ax1),
    DODGE_RATE * Math.max(0, Math.min(ax1 - b.l, top ? -b.t : b.b)),
  );
  let ax2 = Math.min(endExit, ex - legE);
  ax2 -= Math.min(
    Math.max(0, ax2 - (a.l - PADDING)),
    DODGE_RATE * Math.max(0, Math.min(a.r - ax2, top ? ey - a.t : a.b - ey)),
  );
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
  const startExit = a.solid ? Math.max(0, a.r) : 0;
  const endExit = b.solid ? Math.max(ex, b.r) : ex;
  const xs = Math.max(startExit, legLength([0, 0], [1, 0], a, b, ms));
  const xe = Math.max(endExit, ex + legLength(end, [1, 0], b, a, me));
  const x = Math.max(xs, xe);

  // (the first segment past the start's leg, clear of the end's element,
  // and the last one before the end's, clear of the start's)
  const ys = dodge(b, 0, xs, x, true);
  const ye = ey + dodge(a, ey, xe, x, true);

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
  const startExit = a.solid ? Math.max(0, a.r) : 0;
  const endExit = b.solid ? Math.min(ey, b.t) : ey;
  const legS = legLength([0, 0], [1, 0], a, b, ms);
  const legE = legLength(end, [0, -1], b, a, me);
  const lo = Math.max(ms, startExit);
  // how far the end is behind where the start's leg can turn, and how far
  // above where the end's leg can start
  const behind = lo - ex;
  const above = Math.max(me - ey, -endExit);

  let x1 =
    behind > 0
      ? lo + grow(behind, legS, ms)
      : clamp(mid(startExit, b.solid ? b.l : ex), lo, ex);

  if (above > 0) {
    // (climbing a leg's length out, or as far as halfway to the end's
    // element ahead of it, past the end, the further the higher it climbs,
    // so it's turning onto the end's line where it doesn't climb at all, but
    // not where the end is below the start's leg, which coming back down to
    // it would cross)
    const ahead = b.solid ? b.l - startExit : Infinity;
    const past = Math.max(
      x1,
      Math.min(
        Math.max(startExit, legS),
        ex + 2 * Math.max(0, above - DODGE_RATE * Math.max(0, ey)),
        startExit + Math.max(0, ahead) / 2 + DODGE_RATE * Math.max(0, -ahead),
      ),
    );
    // (but a corner's width clear of the end's line, where it would turn
    // back right by it, rather than squeezing a U turn in next to the end)
    x1 = past > ex - input.radius ? Math.max(past, ex + input.radius) : past;
    let y = -above - grow(above, legE, me);
    // (over the start's element, where the segment there runs back over
    // it, as far as it does)
    y += dodgeUp(a, y, ex, x1);
    // (and past the end's element, where it's in the way of the climb: the
    // route has to go around the other side of it, as going over to there
    // gradually would run through it)
    // (where it would run through more of it than running on past it
    // would, where the start's leg runs into it)
    const climbing = b.solid ? Math.min(b.b, 0) - Math.max(b.t, y) : 0;
    const passing = b.solid && b.t < 0 && b.b > 0 ? Math.max(0, b.r - x1) : 0;
    const blocked =
      b.solid &&
      climbing > SQUEEZE_OVERLAP &&
      passing < climbing &&
      x1 > b.l + b.gap + SQUEEZE_OVERLAP &&
      x1 < b.r + PADDING;
    if (blocked) {
      x1 = b.r + PADDING;
      y = Math.min(y, endExit, ey - legE);
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
    const gap = b.t - a.b;
    const squeeze = input.sameElement ? 0 : ms + me + 2 * input.radius;
    // (halfway between the elements, clear of the start's leg, short of the
    // end's)
    const hi = Math.max(0, endExit - me);
    let y = clamp(
      mid(outlineEdge(a, false, ex, x1), outlineEdge(b, true, ex, x1)),
      Math.min(input.radius, hi / 2),
      hi,
    );
    // (but where the segment there runs back under the start's element, as
    // far as it does, no closer to it than to the end, where there isn't
    // room for the end's leg as well, at the expense of the end's leg: so it
    // stays between them, rather than running along the element)
    const reach = a.solid
      ? Math.min(x1, a.r - a.gap) - Math.max(ex, a.l + a.gap)
      : 0;
    y += Math.max(
      0,
      Math.min(
        mid(outlineEdge(a, false, ex, x1) - a.gap, endExit) - y,
        DODGE_RATE * reach,
        endExit - input.radius / 2 - y,
      ),
    );
    const between: Point[] = [[0, 0], [x1, 0], [x1, y], [ex, y], end];
    const apart = gap >= -(a.gap + b.gap);
    if (apart || behind <= squeeze || clearBetween(between, [a, b])) {
      return {
        points: between,
        signature:
          apart || behind > squeeze ? "across:between" : "across:squeeze",
      };
    }
    const over = Math.min(endExit, ey - legE, a.t - PADDING);
    return {
      points: [[0, 0], [x1, 0], [x1, over], [ex, over], end],
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
