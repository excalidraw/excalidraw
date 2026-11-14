import * as m from "./math";
import { douglasPeucker } from "./simplify";

import type { Point } from "./math";

export type SizeMappingDetails = {
  pressure: number;
  runningLength: number;
  currentIndex: number;
  totalLength: number;
};

export type LaserPointerOptions = {
  /** @default 2 */
  size: number;

  streamline: number;
  simplify: number;
  simplifyPhase: "tail" | "output" | "input";

  keepHead: boolean;

  sizeMapping: (details: SizeMappingDetails) => number;
};

/**
 * The stroke outline in three parts: `[...head, ...middle,
 * ...footReversed.reverse()]` is the outline (see `getStrokeOutlineParts`).
 */
export type StrokeOutlineParts = {
  /** start cap and the forward side; only gets points appended */
  head: readonly Point[];
  /** end cap, recomputed on every call */
  middle: readonly Point[];
  /** the backward side and the closing point, reversed; only gets points appended */
  footReversed: readonly Point[];
};

/**
 * The outline sides of `points[1..nextIndex - 1]`, and the running state the
 * sides of the following points are computed from.
 */
type OutlineSides = {
  sizeOverride: number | undefined;
  nextIndex: number;
  speed: number;
  prevSpeed: number;
  visibleStartIndex: number;
  runningLength: number;
  forwardPoints: Point[];
  backwardPoints: Point[];
};

export class LaserPointer {
  static defaults: LaserPointerOptions = {
    size: 2,
    streamline: 0.45,
    simplify: 0.1,
    simplifyPhase: "output",
    keepHead: false,

    sizeMapping: () => 1,
  };

  static constants = {
    cornerDetectionMaxAngle: 75,
    cornerDetectionVariance: (s: number) => (s > 35 ? 0.5 : 1),
    maxTailLength: 50,
  };

  options: LaserPointerOptions;
  constructor(options: Partial<LaserPointerOptions>) {
    this.options = Object.assign({}, LaserPointer.defaults, options);
  }

  originalPoints: Point[] = [];

  private stablePoints: Point[] = [];
  private tailPoints: Point[] = [];

  private isFresh = true;

  /** sides computed by `getStrokeOutlineParts`, resumed by its next call */
  private partsSides: OutlineSides | null = null;

  private get lastPoint(): Point {
    return (
      this.tailPoints[this.tailPoints.length - 1] ??
      this.stablePoints[this.stablePoints.length - 1]
    );
  }

  addPoint(point: Point) {
    const lastPoint = this.originalPoints[this.originalPoints.length - 1];

    if (lastPoint && lastPoint[0] === point[0] && lastPoint[1] === point[1]) {
      return;
    }

    this.originalPoints.push(point);

    if (this.isFresh) {
      this.isFresh = false;
      this.stablePoints.push(point);
      return;
    }

    if (this.options.streamline > 0) {
      point = m.plerp(this.lastPoint, point, 1 - this.options.streamline);
    }

    this.tailPoints.push(point);

    if (m.runLength(this.tailPoints) > LaserPointer.constants.maxTailLength) {
      this.stabilizeTail();
    }
  }

  close() {
    this.stabilizeTail();
  }

  stabilizeTail() {
    if (this.options.simplify > 0 && this.options.simplifyPhase === "tail") {
      throw new Error("Not implemented yet");
    } else {
      this.stablePoints.push(...this.tailPoints);
      this.tailPoints = [];
    }
  }

  private getSize(
    sizeOverride: number | undefined,
    pressure: number,
    index: number,
    totalLength: number,
    runningLength: number,
  ) {
    return (
      (sizeOverride ?? this.options.size) *
      this.options.sizeMapping({
        pressure,
        runningLength,
        currentIndex: index,
        totalLength,
      })
    );
  }

  getStrokeOutline(sizeOverride?: number | undefined): Point[] {
    if (this.isFresh) {
      return [];
    }

    let points = [...this.stablePoints, ...this.tailPoints];

    if (this.options.simplify > 0 && this.options.simplifyPhase === "input") {
      points = douglasPeucker(points, this.options.simplify);
    }

    const len = points.length;

    if (len === 0) {
      return [];
    }

    if (len === 1) {
      const c = points[0];

      const size = this.getSize(sizeOverride, c[2], 0, len, 0);

      if (size < 0.5) {
        return [];
      }

      const ps: Point[] = [];

      for (let theta = 0; theta <= Math.PI * 2; theta += Math.PI / 16) {
        ps.push(m.add(c, m.smul(m.rot([1, 0, 0] as Point, theta), size)));
      }

      ps.push(
        m.add(
          c,
          m.smul(
            [1, 0, 0] as Point,
            this.getSize(sizeOverride, c[2], 0, len, 0),
          ),
        ),
      );

      return ps;
    }

    if (len === 2) {
      const c = points[0];
      const n = points[1];

      const cSize = this.getSize(sizeOverride, c[2], 0, len, 0);
      const nSize = this.getSize(sizeOverride, n[2], 0, len, 0);

      if (cSize < 0.5 || nSize < 0.5) {
        return [];
      }

      const ps: Point[] = [];

      const pAngle = m.angle(c, [c[0], c[1] - 100, c[2]] as Point, n);

      for (
        let theta = pAngle;
        theta <= Math.PI + pAngle;
        theta += Math.PI / 16
      ) {
        ps.push(m.add(c, m.smul(m.rot([1, 0, 0] as Point, theta), cSize)));
      }

      for (
        let theta = Math.PI + pAngle;
        theta <= Math.PI * 2 + pAngle;
        theta += Math.PI / 16
      ) {
        ps.push(m.add(n, m.smul(m.rot([1, 0, 0] as Point, theta), nSize)));
      }

      ps.push(ps[0]);

      return ps;
    }

    const sides = newOutlineSides(sizeOverride, [], []);
    this.extendOutlineSides(points, sides);
    const { forwardPoints, backwardPoints, visibleStartIndex, runningLength } =
      sides;

    if (visibleStartIndex >= len - 2) {
      if (this.options.keepHead) {
        const c = points[len - 1];

        const ps: Point[] = [];

        for (let theta = 0; theta <= Math.PI * 2; theta += Math.PI / 16) {
          ps.push(
            m.add(
              c,
              m.smul(m.rot([1, 0, 0] as Point, theta), this.options.size),
            ),
          );
        }

        ps.push(m.add(c, m.smul([1, 0, 0] as Point, this.options.size)));

        return ps;
      }

      return [];
    }

    const startCap = this.getStartCap(points, visibleStartIndex, sizeOverride);
    const endCap = this.getEndCap(points, runningLength, sizeOverride);

    const strokeOutline = [
      ...startCap,
      ...forwardPoints,
      ...endCap.reverse(),
      ...backwardPoints.reverse(),
    ];

    if (startCap.length > 0) {
      strokeOutline.push(startCap[0]);
    }

    if (this.options.simplify > 0 && this.options.simplifyPhase === "output") {
      return douglasPeucker(strokeOutline, this.options.simplify);
    }

    return strokeOutline;
  }

  /** Adds the outline sides of the points from `sides.nextIndex` on. */
  private extendOutlineSides(points: Point[], sides: OutlineSides) {
    const { sizeOverride, forwardPoints, backwardPoints } = sides;
    let { speed, prevSpeed, visibleStartIndex, runningLength } = sides;

    const len = points.length;

    let i = sides.nextIndex;
    for (; i < len - 1; i++) {
      const p = points[i - 1];
      const c = points[i];
      const n = points[i + 1];

      const pressure = c[2];

      const d = m.dist(p, c);
      runningLength += d;
      speed = prevSpeed + (d - prevSpeed) * 0.2;

      const cSize = this.getSize(sizeOverride, pressure, i, len, runningLength);

      if (cSize === 0) {
        visibleStartIndex = i + 1;
        continue;
      }

      const dirPC = m.norm(m.sub(p, c));
      const dirNC = m.norm(m.sub(n, c));
      const p1dirPC = m.rot(dirPC, Math.PI / 2);
      const p2dirPC = m.rot(dirPC, -Math.PI / 2);
      const p1dirNC = m.rot(dirNC, Math.PI / 2);
      const p2dirNC = m.rot(dirNC, -Math.PI / 2);

      const p1PC = m.add(c, m.smul(p1dirPC, cSize));
      const p2PC = m.add(c, m.smul(p2dirPC, cSize));
      const p1NC = m.add(c, m.smul(p1dirNC, cSize));
      const p2NC = m.add(c, m.smul(p2dirNC, cSize));

      const ftdir = m.add(p1dirPC, p2dirNC);
      const btdir = m.add(p2dirPC, p1dirNC);

      const paPC = m.add(
        c,
        m.smul(m.mag(ftdir) === 0 ? dirPC : m.norm(ftdir), cSize),
      );
      const paNC = m.add(
        c,
        m.smul(m.mag(btdir) === 0 ? dirNC : m.norm(btdir), cSize),
      );

      const cAngle = m.normAngle(m.angle(c, p, n));
      const D_ANGLE =
        (LaserPointer.constants.cornerDetectionMaxAngle / 180) *
        Math.PI *
        LaserPointer.constants.cornerDetectionVariance(speed);

      if (Math.abs(cAngle) < D_ANGLE) {
        const tAngle = Math.abs(m.normAngle(Math.PI - cAngle)); // turn angle

        if (tAngle === 0) {
          continue;
        }

        if (cAngle < 0) {
          backwardPoints.push(p2PC, paNC);

          for (let theta = 0; theta <= tAngle; theta += tAngle / 4) {
            forwardPoints.push(m.add(c, m.rot(m.smul(p1dirPC, cSize), theta)));
          }

          for (let theta = tAngle; theta >= 0; theta -= tAngle / 4) {
            backwardPoints.push(m.add(c, m.rot(m.smul(p1dirPC, cSize), theta)));
          }

          backwardPoints.push(paNC, p1NC);
        } else {
          forwardPoints.push(p1PC, paPC);

          for (let theta = 0; theta <= tAngle; theta += tAngle / 4) {
            backwardPoints.push(
              m.add(c, m.rot(m.smul(p1dirPC, -cSize), -theta)),
            );
          }

          for (let theta = tAngle; theta >= 0; theta -= tAngle / 4) {
            forwardPoints.push(
              m.add(c, m.rot(m.smul(p1dirPC, -cSize), -theta)),
            );
          }
          forwardPoints.push(paPC, p2NC);
        }
      } else {
        forwardPoints.push(paPC);
        backwardPoints.push(paNC);
      }

      prevSpeed = speed;
    }

    Object.assign(sides, {
      nextIndex: i,
      speed,
      prevSpeed,
      visibleStartIndex,
      runningLength,
    });
  }

  private getStartCap(
    points: Point[],
    visibleStartIndex: number,
    sizeOverride: number | undefined,
  ): Point[] {
    const len = points.length;
    const first = points[visibleStartIndex];
    const second = points[visibleStartIndex + 1];

    const dirFS = m.norm(m.sub(second, first));
    const ppdirFS = m.rot(dirFS, -Math.PI / 2);

    const startCapSize = this.getSize(sizeOverride, first[2], 0, len, 0);
    const startCap: Point[] = [];

    // Lowered threshold to 0.1,
    // ensuring virtually all strokes get proper rounded caps for visual consistency.
    if (startCapSize > 0.1) {
      for (let theta = 0; theta <= Math.PI; theta += Math.PI / 16) {
        startCap.unshift(
          m.add(first, m.rot(m.smul(ppdirFS, startCapSize), -theta)),
        );
      }

      startCap.unshift(m.add(first, m.smul(ppdirFS, -startCapSize)));
    } else {
      startCap.push(first);
    }

    return startCap;
  }

  private getEndCap(
    points: Point[],
    runningLength: number,
    sizeOverride: number | undefined,
  ): Point[] {
    const len = points.length;
    const penultimate = points[len - 2];
    const ultimate = points[len - 1];

    const dirPU = m.norm(m.sub(penultimate, ultimate));
    const ppdirPU = m.rot(dirPU, Math.PI / 2);

    const endCapSize = this.options.keepHead
      ? this.options.size
      : this.getSize(sizeOverride, penultimate[2], len - 2, len, runningLength);

    const endCap: Point[] = [];

    for (let theta = 0; theta <= Math.PI * 3; theta += Math.PI / 16) {
      endCap.push(m.add(ultimate, m.rot(m.smul(ppdirPU, -endCapSize), -theta)));
    }

    return endCap;
  }

  /**
   * The outline `getStrokeOutline` returns, in parts that stay valid as
   * points are added: `head` and `footReversed` only get points appended, so
   * a consumer redrawing a growing stroke can keep what it derived from them.
   * Each call resumes from the previous one, so it costs O(1) per added point
   * instead of O(n).
   *
   * The outline of a point must not change as points are added after it:
   * `sizeMapping` must depend only on its arguments, and not on `totalLength`.
   *
   * Returns `null` when the outline isn't made of a start cap, two sides and
   * an end cap (under 3 points, an invisible start, simplification): use
   * `getStrokeOutline` then. Stabilizes the tail (see `close`).
   */
  getStrokeOutlineParts(
    sizeOverride?: number | undefined,
  ): StrokeOutlineParts | null {
    if (this.options.simplify > 0) {
      return null;
    }

    // all the points are then stable, so they don't need to be copied
    this.stabilizeTail();
    const points = this.stablePoints;

    if (points.length < 3) {
      return null;
    }

    let sides = this.partsSides;

    if (!sides || sides.sizeOverride !== sizeOverride) {
      const startCap = this.getStartCap(points, 0, sizeOverride);
      // the outline starts with the start cap, and closes on its first point
      sides = this.partsSides = newOutlineSides(
        sizeOverride,
        [...startCap],
        [startCap[0]],
      );
    }

    this.extendOutlineSides(points, sides);

    if (sides.visibleStartIndex > 0) {
      return null;
    }

    return {
      head: sides.forwardPoints,
      middle: this.getEndCap(
        points,
        sides.runningLength,
        sizeOverride,
      ).reverse(),
      footReversed: sides.backwardPoints,
    };
  }
}

const newOutlineSides = (
  sizeOverride: number | undefined,
  forwardPoints: Point[],
  backwardPoints: Point[],
): OutlineSides => ({
  sizeOverride,
  nextIndex: 1,
  speed: 0,
  prevSpeed: 0,
  visibleStartIndex: 0,
  runningLength: 0,
  forwardPoints,
  backwardPoints,
});
