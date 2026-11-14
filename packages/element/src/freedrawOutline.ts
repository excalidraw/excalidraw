/**
 * Incremental freedraw outlines.
 *
 * While a freedraw stroke is drawn, every pointer move appends a point to the
 * element, and the next render rebuilds its outline and SVG path. Rebuilt
 * from all the points, they cost O(n) per frame in the length of the stroke
 * (#12620). Away from its end, the outline of a stroke doesn't change as
 * points are appended, so the classes here keep that part between calls and
 * recompute only the end, producing the same outline and path at an
 * amortized O(1) cost per point.
 */

import type { StrokePoint } from "perfect-freehand";

type Vec = readonly number[];

/**
 * A closed outline, `[...head, ...middle, ...footReversed.reverse()]`, split
 * so that as the stroke grows, `head` and `footReversed` only get points
 * appended (the outline of the points away from the end of the stroke), and
 * `middle` (around the end of the stroke) is recomputed.
 */
export type OutlineParts = {
  head: readonly Vec[];
  middle: readonly Vec[];
  footReversed: readonly Vec[];
};

export const getOutlinePoints = ({
  head,
  middle,
  footReversed,
}: OutlineParts): [number, number][] => {
  const points: [number, number][] = [];
  for (const [x, y] of head) {
    points.push([x, y]);
  }
  for (const [x, y] of middle) {
    points.push([x, y]);
  }
  for (let i = footReversed.length - 1; i >= 0; i--) {
    points.push([footReversed[i][0], footReversed[i][1]]);
  }
  return points;
};

// -----------------------------------------------------------------------------
//                               SVG path
// -----------------------------------------------------------------------------

const med = (A: Vec, B: Vec) => {
  return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
};

// Trim SVG path data so number are each two decimal points. This
// improves SVG exports, and prevents rendering errors on points
// with long decimals.
const TO_FIXED_PRECISION = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;

export const getSvgPathFromStroke = (points: readonly Vec[]): string => {
  if (!points.length) {
    return "";
  }

  const max = points.length - 1;

  return points
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ["M", points[0], "Q"] as (string | Vec)[],
    )
    .join(" ")
    .replace(TO_FIXED_PRECISION, "$1");
};

const formatPoint = (point: Vec) => `${point[0]},${point[1]}`;

/**
 * The part of `getSvgPathFromStroke`'s path written for `point` (followed by
 * `next` in the outline). The number trimming only ever changes the digits of
 * one number, so trimming the path in pieces gives the same path.
 */
const getSegment = (point: Vec, next: Vec) =>
  ` ${formatPoint(point)} ${formatPoint(med(point, next))}`.replace(
    TO_FIXED_PRECISION,
    "$1",
  );

/**
 * Builds `getSvgPathFromStroke` of an outline given as `OutlineParts`,
 * keeping the path of `head` and `footReversed` between calls, so that only
 * the path of `middle` is written on each call.
 */
export class OutlineSvgPath {
  /** the path of `head[0..headCount - 1]` */
  private headPath = "";
  private headCount = 0;
  /** the path of the last `footCount` points of the outline */
  private footPath = "";
  private footCount = 0;

  build({ head, middle, footReversed }: OutlineParts): string {
    if (
      !head.length ||
      head.length <= this.headCount ||
      footReversed.length < this.footCount
    ) {
      this.headPath = this.footPath = "";
      this.headCount = this.footCount = 0;
    }

    if (!head.length) {
      // no part of the outline is known to stay as it is
      return getSvgPathFromStroke([...middle, ...[...footReversed].reverse()]);
    }

    const first = head[0];

    // the last point of `head` is followed by a point of another part, which
    // may change
    for (; this.headCount < head.length - 1; this.headCount++) {
      this.headPath += getSegment(
        head[this.headCount],
        head[this.headCount + 1],
      );
    }

    // `footReversed[0]` is the last point of the outline, which closes on the
    // first one
    for (; this.footCount < footReversed.length; this.footCount++) {
      this.footPath =
        getSegment(
          footReversed[this.footCount],
          this.footCount ? footReversed[this.footCount - 1] : first,
        ) + this.footPath;
    }

    let middlePath = "";
    let point = head[head.length - 1];
    for (const next of middle) {
      middlePath += getSegment(point, next);
      point = next;
    }
    middlePath += getSegment(
      point,
      footReversed[footReversed.length - 1] ?? first,
    );

    return (
      `M ${formatPoint(first)} Q`.replace(TO_FIXED_PRECISION, "$1") +
      this.headPath +
      middlePath +
      this.footPath +
      ` L ${formatPoint(first)} Z`.replace(TO_FIXED_PRECISION, "$1")
    );
  }
}

// -----------------------------------------------------------------------------
//                         perfect-freehand outline
// -----------------------------------------------------------------------------

/*
 * The functions below are perfect-freehand 1.2.0's (MIT License, Copyright (c)
 * 2021 Stephen Ruiz Ltd), with their arithmetic in the same order, so that
 * they give bit-identical results.
 */

const RATE_OF_PRESSURE_CHANGE = 0.275;
const FIXED_PI = Math.PI + 0.0001;

const neg = (A: Vec) => [-A[0], -A[1]];
const add = (A: Vec, B: Vec) => [A[0] + B[0], A[1] + B[1]];
const sub = (A: Vec, B: Vec) => [A[0] - B[0], A[1] - B[1]];
const mul = (A: Vec, n: number) => [A[0] * n, A[1] * n];
const div = (A: Vec, n: number) => [A[0] / n, A[1] / n];
const per = (A: Vec) => [A[1], -A[0]];
const dpr = (A: Vec, B: Vec) => A[0] * B[0] + A[1] * B[1];
const isEqual = (A: Vec, B: Vec) => A[0] === B[0] && A[1] === B[1];
const len = (A: Vec) => Math.hypot(A[0], A[1]);
const len2 = (A: Vec) => A[0] * A[0] + A[1] * A[1];
const dist2 = (A: Vec, B: Vec) => len2(sub(A, B));
const uni = (A: Vec) => div(A, len(A));
const dist = (A: Vec, B: Vec) => Math.hypot(A[1] - B[1], A[0] - B[0]);
const lrp = (A: Vec, B: Vec, t: number) => add(A, mul(sub(B, A), t));
const prj = (A: Vec, B: Vec, c: number) => add(A, mul(B, c));
const rotAround = (A: Vec, C: Vec, r: number) => {
  const s = Math.sin(r);
  const c = Math.cos(r);
  const px = A[0] - C[0];
  const py = A[1] - C[1];
  const nx = px * c - py * s;
  const ny = px * s + py * c;
  return [nx + C[0], ny + C[1]];
};

const getStrokeRadius = (
  size: number,
  thinning: number,
  pressure: number,
  easing: (t: number) => number,
) => size * easing(0.5 - thinning * (0.5 - pressure));

/** The perfect-freehand options of a freedraw stroke. */
export type FreehandOptions = {
  size: number;
  thinning: number;
  smoothing: number;
  streamline: number;
  simulatePressure: boolean;
  easing: (t: number) => number;
};

/** `getStrokeOutlinePoints`' state between two stroke points. */
type SideState = {
  prevPressure: number;
  prevVector: Vec;
  pl: Vec;
  pr: Vec;
  isPrevPointSharpCorner: boolean;
};

/**
 * Stroke points from which `getStrokeOutlinePoints` starts computing the
 * outline: it averages the pressure of the first 10.
 */
const MIN_STROKE_POINTS = 10;

/**
 * perfect-freehand's `getStroke(inputs, { ...options, last: true })` (without
 * tapers) of inputs that only get points appended, computed incrementally:
 * the stroke points of all the inputs but the last one, and the outline of
 * the stroke points that are farther than 3 from the end of the stroke, can't
 * change any more, so they are kept, and the rest is recomputed.
 */
export class FreehandOutline {
  private readonly strokePoints: StrokePoint[] = [];
  /** inputs that `strokePoints` were computed from (all but the last one) */
  private inputCount = 0;
  private runningLength = 0;
  private hasReachedMinimumLength = false;
  /** the stroke point of the last input (`null` if it coincides) */
  private lastStrokePoint: StrokePoint | null = null;
  private totalInputs = 0;

  /** state after the stroke points whose outline points can't change */
  private sideState: SideState | null = null;
  private outlineCount = 0;
  private readonly left: Vec[] = [];
  /** the right side, preceded by the start cap, reversed */
  private readonly footReversed: Vec[] = [];

  constructor(private readonly options: FreehandOptions) {}

  /**
   * Takes into account the points added since the last call. The inputs are
   * `points`, with their `pressures` unless they are simulated, and must
   * start with the inputs of the previous calls.
   */
  update(points: readonly Vec[], pressures: readonly number[] | null) {
    const { size, streamline } = this.options;
    const strokePoints = this.strokePoints;
    const getInput = (index: number): Vec =>
      pressures
        ? [points[index][0], points[index][1], pressures[index]]
        : points[index];
    this.totalInputs = points.length;

    if (!points.length) {
      return;
    }

    if (!this.inputCount) {
      const [x, y, pressure] = getInput(0);
      strokePoints.push({
        point: [x, y],
        pressure: pressure >= 0 ? pressure : 0.25,
        vector: [1, 1],
        distance: 0,
        runningLength: 0,
      });
      this.inputCount = 1;
    }

    // `getStrokePoints` with more than 2 inputs, for all but the last input
    const t = 0.15 + (1 - streamline) * 0.85;
    for (; this.inputCount < points.length - 1; this.inputCount++) {
      const input = getInput(this.inputCount);
      const prev = strokePoints[strokePoints.length - 1];
      const point = lrp(prev.point, input, t);

      if (isEqual(prev.point, point)) {
        continue;
      }

      const distance = dist(point, prev.point);
      this.runningLength += distance;

      if (!this.hasReachedMinimumLength) {
        if (this.runningLength < size) {
          continue;
        }
        this.hasReachedMinimumLength = true;
      }

      strokePoints.push({
        point,
        pressure: input[2] >= 0 ? input[2] : 0.5,
        vector: uni(sub(prev.point, point)),
        distance,
        runningLength: this.runningLength,
      });

      if (strokePoints.length === 2) {
        strokePoints[0].vector = strokePoints[1].vector;
      }
    }

    // ... and for the last input, which is taken as is
    const input = getInput(points.length - 1);
    const prev = strokePoints[strokePoints.length - 1];
    const point = [input[0], input[1]];
    const distance = dist(point, prev.point);
    this.lastStrokePoint = isEqual(prev.point, point)
      ? null
      : {
          point,
          pressure: input[2] >= 0 ? input[2] : 0.5,
          vector: uni(sub(prev.point, point)),
          distance,
          runningLength: this.runningLength + distance,
        };

    if (strokePoints.length < MIN_STROKE_POINTS) {
      return;
    }

    this.sideState ??= {
      prevPressure: this.getInitialPressure(),
      prevVector: strokePoints[0].vector,
      pl: strokePoints[0].point,
      pr: strokePoints[0].point,
      isPrevPointSharpCorner: false,
    };

    // the end of the stroke is at least this far along: the stroke points
    // before it that are farther than 3 from it aren't removed as noise
    const minTotalLength = strokePoints[strokePoints.length - 1].runningLength;

    for (
      ;
      this.outlineCount < strokePoints.length - 1 &&
      minTotalLength - strokePoints[this.outlineCount].runningLength >= 3;
      this.outlineCount++
    ) {
      const right: Vec[] = [];
      this.addOutlinePoints(
        this.sideState,
        this.outlineCount,
        strokePoints[this.outlineCount + 1],
        minTotalLength,
        this.left,
        right,
      );

      if (!this.footReversed.length) {
        this.footReversed.push(...this.getStartCap(right[0]).reverse());
      }
      this.footReversed.push(...right);
    }
  }

  /** `null` for strokes too short for the outline to be kept */
  getParts(): OutlineParts | null {
    const strokePoints = this.strokePoints;

    if (
      this.totalInputs < 3 ||
      strokePoints.length < MIN_STROKE_POINTS ||
      this.options.size <= 0
    ) {
      return null;
    }

    const last = this.lastStrokePoint ?? strokePoints[strokePoints.length - 1];
    const count = strokePoints.length + (this.lastStrokePoint ? 1 : 0);
    const state = { ...this.sideState! };
    const left: Vec[] = [];
    const right: Vec[] = [];
    let radius = 0;

    for (let i = this.outlineCount; i < count; i++) {
      radius =
        this.addOutlinePoints(
          state,
          i,
          i + 1 < count ? strokePoints[i + 1] ?? last : null,
          last.runningLength,
          left,
          right,
        ) ?? radius;
    }

    // end cap
    const lastPoint = last.point.slice(0, 2);
    const direction = per(neg(last.vector));
    const start = prj(lastPoint, direction, radius);
    const endCap: Vec[] = [];
    for (let step = 1 / 29, t = step; t < 1; t += step) {
      endCap.push(rotAround(start, lastPoint, FIXED_PI * 3 * t));
    }

    const middle = [...left, ...endCap];
    for (let i = right.length - 1; i >= 0; i--) {
      middle.push(right[i]);
    }
    if (!this.footReversed.length) {
      middle.push(...this.getStartCap(right[0]));
    }

    return { head: this.left, middle, footReversed: this.footReversed };
  }

  /** the pressure the outline starts from */
  private getInitialPressure() {
    const { size, simulatePressure } = this.options;
    return this.strokePoints.slice(0, 10).reduce((acc, curr) => {
      let pressure = curr.pressure;

      if (simulatePressure) {
        const sp = Math.min(1, curr.distance / size);
        const rp = Math.min(1, 1 - sp);
        pressure = Math.min(
          1,
          acc + (rp - acc) * (sp * RATE_OF_PRESSURE_CHANGE),
        );
      }

      return (acc + pressure) / 2;
    }, this.strokePoints[0].pressure);
  }

  /** round start cap, around the first point */
  private getStartCap(firstRight: Vec) {
    const firstPoint = this.strokePoints[0].point.slice(0, 2);
    const startCap: Vec[] = [];
    for (let step = 1 / 13, t = step; t <= 1; t += step) {
      startCap.push(rotAround(firstRight, firstPoint, FIXED_PI * t));
    }
    return startCap;
  }

  /**
   * `getStrokeOutlinePoints`' loop body: adds the outline points of stroke
   * point `index` (followed by `next`, `null` for the last one) to `left` and
   * `right`, and returns its radius, or `undefined` if it is removed as noise
   * at the end of the stroke.
   */
  private addOutlinePoints(
    state: SideState,
    index: number,
    next: StrokePoint | null,
    totalLength: number,
    left: Vec[],
    right: Vec[],
  ): number | undefined {
    const { size, thinning, smoothing, simulatePressure, easing } =
      this.options;
    const current =
      this.strokePoints[index] ?? (this.lastStrokePoint as StrokePoint);
    const { point, vector, distance, runningLength } = current;
    let { pressure } = current;

    if (next && totalLength - runningLength < 3) {
      return undefined;
    }

    let radius: number;
    if (thinning) {
      if (simulatePressure) {
        const sp = Math.min(1, distance / size);
        const rp = Math.min(1, 1 - sp);
        pressure = Math.min(
          1,
          state.prevPressure +
            (rp - state.prevPressure) * (sp * RATE_OF_PRESSURE_CHANGE),
        );
      }

      radius = getStrokeRadius(size, thinning, pressure, easing);
    } else {
      radius = size / 2;
    }

    // without tapers (the radius multiplied by 1)
    radius = Math.max(0.01, radius);

    const nextVector = (next ?? current).vector;
    const nextDpr = next ? dpr(vector, nextVector) : 1.0;
    const prevDpr = dpr(vector, state.prevVector);

    const isPointSharpCorner = prevDpr < 0 && !state.isPrevPointSharpCorner;
    const isNextPointSharpCorner = nextDpr < 0;

    if (isPointSharpCorner || isNextPointSharpCorner) {
      const offset = mul(per(state.prevVector), radius);

      for (let step = 1 / 13, t = 0; t <= 1; t += step) {
        state.pl = rotAround(sub(point, offset), point, FIXED_PI * t);
        left.push(state.pl);

        state.pr = rotAround(add(point, offset), point, FIXED_PI * -t);
        right.push(state.pr);
      }

      if (isNextPointSharpCorner) {
        state.isPrevPointSharpCorner = true;
      }
      return radius;
    }

    state.isPrevPointSharpCorner = false;

    if (!next) {
      const offset = mul(per(vector), radius);
      left.push(sub(point, offset));
      right.push(add(point, offset));
      return radius;
    }

    const offset = mul(per(lrp(nextVector, vector, nextDpr)), radius);
    const minDistance = Math.pow(size * smoothing, 2);

    const tl = sub(point, offset);
    if (index <= 1 || dist2(state.pl, tl) > minDistance) {
      left.push(tl);
      state.pl = tl;
    }

    const tr = add(point, offset);
    if (index <= 1 || dist2(state.pr, tr) > minDistance) {
      right.push(tr);
      state.pr = tr;
    }

    state.prevPressure = pressure;
    state.prevVector = vector;

    return radius;
  }
}
