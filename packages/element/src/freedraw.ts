import type { ExcalidrawFreeDrawElement } from "./types";

// -----------------------------------------------------------------------------
//            freedraw stroke geometry — single source of truth
// -----------------------------------------------------------------------------
// The canvas rasteriser (renderFreedraw.ts) and the SVG/hit-test path
// (shape.ts) both derive their outline from the helpers below so the live
// render, the exported SVG, and the eraser/selection hit-region stay identical.

export const FREEDRAW_DEFAULT_PRESSURE = 0.5;
export const FREEDRAW_PRESSURE_SMOOTHING_RADIUS = 6;

/**
 * Target spacing (scene units) between subdivided samples along each
 * quadratic B-spline span.  Small enough that the resulting tapered-capsule
 * chain reads as one smooth ribbon rather than a string of facets.
 */
export const FREEDRAW_BEZIER_SUBDIVIDE_TARGET_SPACING = 3;

/**
 * Base stroke half-width before the pressure multiplier is applied.  The
 * `* 1.25` matches the historical freedraw weighting; the radius used at a
 * point is `baseRadius * smoothedPressure * 2`.
 */
export const getFreeDrawBaseRadius = (
  element: ExcalidrawFreeDrawElement,
): number => (element.strokeWidth * 1.25) / 2;

/**
 * A single tapered-capsule primitive: a segment from (x0,y0) with radius r0 to
 * (x1,y1) with radius r1.  Consumers render it as two half-circle end caps
 * joined by the outer tangent lines (or a full circle when degenerate).
 */
export interface FreeDrawCapsuleSegment {
  x0: number;
  y0: number;
  r0: number;
  x1: number;
  y1: number;
  r1: number;
}

/**
 * Triangular-kernel causal weighted pressure average (backward-only window).
 * Only looks backward [i-R .. i] so a newly-arrived point never retroactively
 * changes the smoothed pressure of an already-rendered segment — the live and
 * final renders therefore agree at every point.  When `simulatePressure` is set
 * or the pressures array is empty, the constant default pressure is returned.
 */
export const getFreeDrawSmoothedPressure = (
  element: ExcalidrawFreeDrawElement,
  i: number,
): number => {
  const { pressures } = element;
  if (element.simulatePressure || pressures.length === 0) {
    return FREEDRAW_DEFAULT_PRESSURE;
  }
  let sum = 0;
  let totalWeight = 0;
  for (let k = -FREEDRAW_PRESSURE_SMOOTHING_RADIUS; k <= 0; k++) {
    const idx = i + k;
    if (idx < 0) {
      continue;
    }
    const p =
      idx < pressures.length ? pressures[idx] : FREEDRAW_DEFAULT_PRESSURE;
    const w = FREEDRAW_PRESSURE_SMOOTHING_RADIUS + 1 + k; // 1 at i-R, R+1 at i
    sum += p * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? sum / totalWeight : FREEDRAW_DEFAULT_PRESSURE;
};

/**
 * Subdivides the freedraw centreline into tapered-capsule primitives.
 *
 * The centreline is a midpoint quadratic B-spline: the raw input points act as
 * *control* points and the curve passes through the midpoints of consecutive
 * input points, with a straight lead-in `p0 -> mid(p0,p1)` and lead-out
 * `mid(pN-2,pN-1) -> pN-1` so the stroke still starts and ends exactly at the
 * pointer positions.  Approximating (rather than interpolating through) the
 * raw points filters hand/pointer jitter ~2:1, which is what keeps ovoids
 * reading as smooth ribbons instead of chains of facets.
 *
 * Each spline span is sampled every
 * `FREEDRAW_BEZIER_SUBDIVIDE_TARGET_SPACING` scene units.  Radii follow the
 * smoothed pressures: quadratic Bernstein interpolation along each curved span
 * (matching the positional weights), linear along the straight end pieces.
 *
 * Windowing: "interval i" (1-based) denotes the quadratic span controlled by
 * point `i` — from `mid(p[i-1], p[i])` to `mid(p[i], p[i+1])` — plus the
 * lead-in for `i === 1` and the lead-out for `i === N-1`.  Interval `i`
 * depends only on points up to `i + 1` and on causal pressure smoothing, so
 * once point `i + 1` exists the interval's geometry is final; consecutive
 * intervals tile the centreline exactly.
 *
 * @param fromIndex Emit capsules for intervals `>= fromIndex` (values `< 1`
 *                  are treated as 1; interval 0 does not exist).  Used by the
 *                  incremental canvas to append only newly finalised spans.
 * @param upToIndex Emit capsules for intervals `< upToIndex`.  Omit to run to
 *                  the natural end.  Used by the incremental canvas to stop
 *                  short of the provisional tip.
 */
export const getFreeDrawCapsuleSegments = (
  element: ExcalidrawFreeDrawElement,
  fromIndex = 0,
  upToIndex?: number,
): FreeDrawCapsuleSegment[] => {
  const { points } = element;
  const N = points.length;
  const baseRadius = getFreeDrawBaseRadius(element);
  const radiusAt = (i: number) =>
    baseRadius * getFreeDrawSmoothedPressure(element, i) * 2;

  const segments: FreeDrawCapsuleSegment[] = [];

  if (N === 0) {
    return segments;
  }

  if (N === 1) {
    if (fromIndex === 0 && (upToIndex === undefined || upToIndex >= 1)) {
      // Single-point stroke -> degenerate capsule -> filled dot.
      const r = radiusAt(0);
      const [x, y] = points[0];
      segments.push({ x0: x, y0: y, r0: r, x1: x, y1: y, r1: r });
    }
    return segments;
  }

  const end = upToIndex !== undefined ? Math.min(upToIndex, N) : N;
  const start = Math.max(fromIndex, 1);

  // Straight piece subdivided into capsules with linear radius interpolation.
  const emitLinear = (
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ) => {
    const len = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    const nSubdiv = Math.max(
      1,
      Math.ceil(len / FREEDRAW_BEZIER_SUBDIVIDE_TARGET_SPACING),
    );
    let prevX = x0;
    let prevY = y0;
    let prevR = r0;
    for (let k = 1; k <= nSubdiv; k++) {
      const t = k / nSubdiv;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const r = r0 + (r1 - r0) * t;
      segments.push({ x0: prevX, y0: prevY, r0: prevR, x1: x, y1: y, r1: r });
      prevX = x;
      prevY = y;
      prevR = r;
    }
  };

  // Quadratic Bezier piece A -> (ctrl C) -> B subdivided into capsules with
  // quadratic Bernstein radius interpolation.
  const emitQuadratic = (
    ax: number,
    ay: number,
    ra: number,
    cx: number,
    cy: number,
    rc: number,
    bx: number,
    by: number,
    rb: number,
  ) => {
    const approxLen =
      Math.sqrt((cx - ax) ** 2 + (cy - ay) ** 2) +
      Math.sqrt((bx - cx) ** 2 + (by - cy) ** 2);
    const nSubdiv = Math.max(
      1,
      Math.ceil(approxLen / FREEDRAW_BEZIER_SUBDIVIDE_TARGET_SPACING),
    );
    let prevX = ax;
    let prevY = ay;
    let prevR = ra;
    for (let k = 1; k <= nSubdiv; k++) {
      const t = k / nSubdiv;
      const mt = 1 - t;
      const w0 = mt * mt;
      const w1 = 2 * mt * t;
      const w2 = t * t;
      const x = w0 * ax + w1 * cx + w2 * bx;
      const y = w0 * ay + w1 * cy + w2 * by;
      const r = w0 * ra + w1 * rc + w2 * rb;
      segments.push({ x0: prevX, y0: prevY, r0: prevR, x1: x, y1: y, r1: r });
      prevX = x;
      prevY = y;
      prevR = r;
    }
  };

  for (let i = start; i < end; i++) {
    const pPrev = points[i - 1];
    const pCur = points[i];
    const rPrev = radiusAt(i - 1);
    const rCur = radiusAt(i);

    if (i === 1) {
      // Straight lead-in from the first raw point to the first midpoint.
      emitLinear(
        pPrev[0],
        pPrev[1],
        rPrev,
        (pPrev[0] + pCur[0]) / 2,
        (pPrev[1] + pCur[1]) / 2,
        (rPrev + rCur) / 2,
      );
    }

    if (i <= N - 2) {
      // Quadratic span controlled by pCur: mid(pPrev,pCur) -> mid(pCur,pNext).
      const pNext = points[i + 1];
      const rNext = radiusAt(i + 1);
      emitQuadratic(
        (pPrev[0] + pCur[0]) / 2,
        (pPrev[1] + pCur[1]) / 2,
        (rPrev + rCur) / 2,
        pCur[0],
        pCur[1],
        rCur,
        (pCur[0] + pNext[0]) / 2,
        (pCur[1] + pNext[1]) / 2,
        (rCur + rNext) / 2,
      );
    }

    if (i === N - 1) {
      // Straight lead-out from the last midpoint to the last raw point.
      emitLinear(
        (pPrev[0] + pCur[0]) / 2,
        (pPrev[1] + pCur[1]) / 2,
        (rPrev + rCur) / 2,
        pCur[0],
        pCur[1],
        rCur,
      );
    }
  }

  return segments;
};
