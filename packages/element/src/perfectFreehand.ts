/**
 * perfect-freehand 1.2.0, https://github.com/steveruizok/perfect-freehand
 * (packages/perfect-freehand/src at v1.2.0, merged into one file).
 *
 * Changed for deep zoom, where a stroke and its pen are fractions of a unit:
 * - The radius floor is 1e-9, not 0.01, so lines keep getting finer.
 * - Points within 3 units of a stroke's end are skipped to round off its
 *   cap only for a pen of size 4.25 (Excalidraw's thinnest at 1x) or
 *   larger; the distance scales down with a smaller pen, so a stroke
 *   shorter than 3 units keeps its body.
 *
 * MIT License
 *
 * Copyright (c) 2021 Stephen Ruiz Ltd
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * The options object for `getStroke` or `getStrokePoints`.
 * @param points An array of points (as `[x, y, pressure]` or `{x, y, pressure}`). Pressure is optional in both cases.
 * @param options (optional) An object with options.
 * @param options.size	The base size (diameter) of the stroke.
 * @param options.thinning The effect of pressure on the stroke's size.
 * @param options.smoothing	How much to soften the stroke's edges.
 * @param options.easing	An easing function to apply to each point's pressure.
 * @param options.simulatePressure Whether to simulate pressure based on velocity.
 * @param options.start Cap, taper and easing for the start of the line.
 * @param options.end Cap, taper and easing for the end of the line.
 * @param options.last Whether to handle the points as a completed stroke.
 */
export interface StrokeOptions {
  size?: number;
  thinning?: number;
  smoothing?: number;
  streamline?: number;
  easing?: (pressure: number) => number;
  simulatePressure?: boolean;
  start?: {
    cap?: boolean;
    taper?: number | boolean;
    easing?: (distance: number) => number;
  };
  end?: {
    cap?: boolean;
    taper?: number | boolean;
    easing?: (distance: number) => number;
  };
  // Whether to handle the points as a completed stroke.
  last?: boolean;
}

/**
 * The points returned by `getStrokePoints`, and the input for `getStrokeOutlinePoints`.
 */
export interface StrokePoint {
  point: number[];
  pressure: number;
  distance: number;
  vector: number[];
  runningLength: number;
}

/**
 * Negate a vector.
 * @param A
 * @internal
 */
function neg(A: number[]) {
  return [-A[0], -A[1]];
}

/**
 * Add vectors.
 * @param A
 * @param B
 * @internal
 */
function add(A: number[], B: number[]) {
  return [A[0] + B[0], A[1] + B[1]];
}

/**
 * Subtract vectors.
 * @param A
 * @param B
 * @internal
 */
function sub(A: number[], B: number[]) {
  return [A[0] - B[0], A[1] - B[1]];
}

/**
 * Vector multiplication by scalar
 * @param A
 * @param n
 * @internal
 */
function mul(A: number[], n: number) {
  return [A[0] * n, A[1] * n];
}

/**
 * Vector division by scalar.
 * @param A
 * @param n
 * @internal
 */
function div(A: number[], n: number) {
  return [A[0] / n, A[1] / n];
}

/**
 * Perpendicular rotation of a vector A
 * @param A
 * @internal
 */
function per(A: number[]) {
  return [A[1], -A[0]];
}

/**
 * Dot product
 * @param A
 * @param B
 * @internal
 */
function dpr(A: number[], B: number[]) {
  return A[0] * B[0] + A[1] * B[1];
}

/**
 * Get whether two vectors are equal.
 * @param A
 * @param B
 * @internal
 */
function isEqual(A: number[], B: number[]) {
  return A[0] === B[0] && A[1] === B[1];
}

/**
 * Length of the vector
 * @param A
 * @internal
 */
function len(A: number[]) {
  return Math.hypot(A[0], A[1]);
}

/**
 * Length of the vector squared
 * @param A
 * @internal
 */
function len2(A: number[]) {
  return A[0] * A[0] + A[1] * A[1];
}

/**
 * Dist length from A to B squared.
 * @param A
 * @param B
 * @internal
 */
function dist2(A: number[], B: number[]) {
  return len2(sub(A, B));
}

/**
 * Get normalized / unit vector.
 * @param A
 * @internal
 */
function uni(A: number[]) {
  return div(A, len(A));
}

/**
 * Dist length from A to B
 * @param A
 * @param B
 * @internal
 */
function dist(A: number[], B: number[]) {
  return Math.hypot(A[1] - B[1], A[0] - B[0]);
}

/**
 * Rotate a vector around another vector by r (radians)
 * @param A vector
 * @param C center
 * @param r rotation in radians
 * @internal
 */
function rotAround(A: number[], C: number[], r: number) {
  const s = Math.sin(r);
  const c = Math.cos(r);

  const px = A[0] - C[0];
  const py = A[1] - C[1];

  const nx = px * c - py * s;
  const ny = px * s + py * c;

  return [nx + C[0], ny + C[1]];
}

/**
 * Interpolate vector A to B with a scalar t
 * @param A
 * @param B
 * @param t scalar
 * @internal
 */
function lrp(A: number[], B: number[], t: number) {
  return add(A, mul(sub(B, A), t));
}

/**
 * Project a point A in the direction B by a scalar c
 * @param A
 * @param B
 * @param c
 * @internal
 */
function prj(A: number[], B: number[], c: number) {
  return add(A, mul(B, c));
}

/**
 * Compute a radius based on the pressure.
 * @param size
 * @param thinning
 * @param pressure
 * @param easing
 * @internal
 */
function getStrokeRadius(
  size: number,
  thinning: number,
  pressure: number,
  easing: (t: number) => number = (t) => t,
) {
  return size * easing(0.5 - thinning * (0.5 - pressure));
}

/**
 * ## getStrokePoints
 * @description Get an array of points as objects with an adjusted point, pressure, vector, distance, and runningLength.
 * @param points An array of points (as `[x, y, pressure]` or `{x, y, pressure}`). Pressure is optional in both cases.
 * @param options (optional) An object with options.
 * @param options.size	The base size (diameter) of the stroke.
 * @param options.thinning The effect of pressure on the stroke's size.
 * @param options.smoothing	How much to soften the stroke's edges.
 * @param options.easing	An easing function to apply to each point's pressure.
 * @param options.simulatePressure Whether to simulate pressure based on velocity.
 * @param options.start Cap, taper and easing for the start of the line.
 * @param options.end Cap, taper and easing for the end of the line.
 * @param options.last Whether to handle the points as a completed stroke.
 */
export function getStrokePoints<
  T extends number[],
  K extends { x: number; y: number; pressure?: number },
>(points: (T | K)[], options = {} as StrokeOptions): StrokePoint[] {
  const { streamline = 0.5, size = 16, last: isComplete = false } = options;

  // If we don't have any points, return an empty array.
  if (points.length === 0) {
    return [];
  }

  // Find the interpolation level between points.
  const t = 0.15 + (1 - streamline) * 0.85;

  // Whatever the input is, make sure that the points are in number[][].
  let pts = Array.isArray(points[0])
    ? (points as T[])
    : (points as K[]).map(({ x, y, pressure = 0.5 }) => [x, y, pressure]);

  // Add extra points between the two, to help avoid "dash" lines
  // for strokes with tapered start and ends. Don't mutate the
  // input array!
  if (pts.length === 2) {
    const last = pts[1];
    pts = pts.slice(0, -1);
    for (let i = 1; i < 5; i++) {
      pts.push(lrp(pts[0], last, i / 4));
    }
  }

  // If there's only one point, add another point at a 1pt offset.
  // Don't mutate the input array!
  if (pts.length === 1) {
    pts = [...pts, [...add(pts[0], [1, 1]), ...pts[0].slice(2)]];
  }

  // The strokePoints array will hold the points for the stroke.
  // Start it out with the first point, which needs no adjustment.
  const strokePoints: StrokePoint[] = [
    {
      point: [pts[0][0], pts[0][1]],
      pressure: pts[0][2] >= 0 ? pts[0][2] : 0.25,
      vector: [1, 1],
      distance: 0,
      runningLength: 0,
    },
  ];

  // A flag to see whether we've already reached out minimum length
  let hasReachedMinimumLength = false;

  // We use the runningLength to keep track of the total distance
  let runningLength = 0;

  // We're set this to the latest point, so we can use it to calculate
  // the distance and vector of the next point.
  let prev = strokePoints[0];

  const max = pts.length - 1;

  // Iterate through all of the points, creating StrokePoints.
  for (let i = 1; i < pts.length; i++) {
    const point =
      isComplete && i === max
        ? // If we're at the last point, and `options.last` is true,
          // then add the actual input point.
          pts[i].slice(0, 2)
        : // Otherwise, using the t calculated from the streamline
          // option, interpolate a new point between the previous
          // point the current point.
          lrp(prev.point, pts[i], t);

    // If the new point is the same as the previous point, skip ahead.
    if (isEqual(prev.point, point)) {
      continue;
    }

    // How far is the new point from the previous point?
    const distance = dist(point, prev.point);

    // Add this distance to the total "running length" of the line.
    runningLength += distance;

    // At the start of the line, we wait until the new point is a
    // certain distance away from the original point, to avoid noise
    if (i < max && !hasReachedMinimumLength) {
      if (runningLength < size) {
        continue;
      }
      hasReachedMinimumLength = true;
      // TODO: Backfill the missing points so that tapering works correctly.
    }
    // Create a new strokepoint (it will be the new "previous" one).
    prev = {
      // The adjusted point
      point,
      // The input pressure (or .5 if not specified)
      pressure: pts[i][2] >= 0 ? pts[i][2] : 0.5,
      // The vector from the current point to the previous point
      vector: uni(sub(prev.point, point)),
      // The distance between the current point and the previous point
      distance,
      // The total distance so far
      runningLength,
    };

    // Push it to the strokePoints array.
    strokePoints.push(prev);
  }

  // Set the vector of the first point to be the same as the second point.
  strokePoints[0].vector = strokePoints[1]?.vector || [0, 0];

  return strokePoints;
}

const { min, PI } = Math;

// This is the rate of change for simulated pressure. It could be an option.
const RATE_OF_PRESSURE_CHANGE = 0.275;

// Browser strokes seem to be off if PI is regular, a tiny offset seems to fix it
const FIXED_PI = PI + 0.0001;

/**
 * ## getStrokeOutlinePoints
 * @description Get an array of points (as `[x, y]`) representing the outline of a stroke.
 * @param points An array of StrokePoints as returned from `getStrokePoints`.
 * @param options (optional) An object with options.
 * @param options.size	The base size (diameter) of the stroke.
 * @param options.thinning The effect of pressure on the stroke's size.
 * @param options.smoothing	How much to soften the stroke's edges.
 * @param options.easing	An easing function to apply to each point's pressure.
 * @param options.simulatePressure Whether to simulate pressure based on velocity.
 * @param options.start Cap, taper and easing for the start of the line.
 * @param options.end Cap, taper and easing for the end of the line.
 * @param options.last Whether to handle the points as a completed stroke.
 */
export function getStrokeOutlinePoints(
  points: StrokePoint[],
  options: Partial<StrokeOptions> = {} as Partial<StrokeOptions>,
): number[][] {
  const {
    size = 16,
    smoothing = 0.5,
    thinning = 0.5,
    simulatePressure = true,
    easing = (t) => t,
    start = {},
    end = {},
    last: isComplete = false,
  } = options;

  const { cap: capStart = true, easing: taperStartEase = (t) => t * (2 - t) } =
    start;

  const { cap: capEnd = true, easing: taperEndEase = (t) => --t * t * t + 1 } =
    end;

  // We can't do anything with an empty array or a stroke with negative size.
  if (points.length === 0 || size <= 0) {
    return [];
  }

  // The total length of the line
  const totalLength = points[points.length - 1].runningLength;

  const taperStart =
    start.taper === false
      ? 0
      : start.taper === true
      ? Math.max(size, totalLength)
      : (start.taper as number);

  const taperEnd =
    end.taper === false
      ? 0
      : end.taper === true
      ? Math.max(size, totalLength)
      : (end.taper as number);

  // The minimum allowed distance between points (squared)
  const minDistance = Math.pow(size * smoothing, 2);

  // Our collected left and right points
  const leftPts: number[][] = [];
  const rightPts: number[][] = [];

  // Previous pressure (start with average of first five pressures,
  // in order to prevent fat starts for every line. Drawn lines
  // almost always start slow!
  let prevPressure = points.slice(0, 10).reduce((acc, curr) => {
    let pressure = curr.pressure;

    if (simulatePressure) {
      // Speed of change - how fast should the the pressure changing?
      const sp = min(1, curr.distance / size);
      // Rate of change - how much of a change is there?
      const rp = min(1, 1 - sp);
      // Accelerate the pressure
      pressure = min(1, acc + (rp - acc) * (sp * RATE_OF_PRESSURE_CHANGE));
    }

    return (acc + pressure) / 2;
  }, points[0].pressure);

  // The current radius
  let radius = getStrokeRadius(
    size,
    thinning,
    points[points.length - 1].pressure,
    easing,
  );

  // The radius of the first saved point
  let firstRadius: number | undefined = undefined;

  // Previous vector
  let prevVector = points[0].vector;

  // Previous left and right points
  let pl = points[0].point;
  let pr = pl;

  // Temporary left and right points
  let tl = pl;
  let tr = pr;

  // Keep track of whether the previous point is a sharp corner
  // ... so that we don't detect the same corner twice
  let isPrevPointSharpCorner = false;

  // let short = true

  /*
    Find the outline's left and right points

    Iterating through the points and populate the rightPts and leftPts arrays,
    skipping the first and last pointsm, which will get caps later on.
  */

  for (let i = 0; i < points.length; i++) {
    let { pressure } = points[i];
    const { point, vector, distance, runningLength } = points[i];

    // Removes noise from the end of the line
    if (
      i < points.length - 1 &&
      totalLength - runningLength < Math.min(3, (size / 4.25) * 3)
    ) {
      continue;
    }

    /*
      Calculate the radius

      If not thinning, the current point's radius will be half the size; or
      otherwise, the size will be based on the current (real or simulated)
      pressure. 
    */

    if (thinning) {
      if (simulatePressure) {
        // If we're simulating pressure, then do so based on the distance
        // between the current point and the previous point, and the size
        // of the stroke. Otherwise, use the input pressure.
        const sp = min(1, distance / size);
        const rp = min(1, 1 - sp);
        pressure = min(
          1,
          prevPressure + (rp - prevPressure) * (sp * RATE_OF_PRESSURE_CHANGE),
        );
      }

      radius = getStrokeRadius(size, thinning, pressure, easing);
    } else {
      radius = size / 2;
    }

    if (firstRadius === undefined) {
      firstRadius = radius;
    }

    /*
      Apply tapering

      If the current length is within the taper distance at either the
      start or the end, calculate the taper strengths. Apply the smaller 
      of the two taper strengths to the radius.
    */

    const ts =
      runningLength < taperStart
        ? taperStartEase(runningLength / taperStart)
        : 1;

    const te =
      totalLength - runningLength < taperEnd
        ? taperEndEase((totalLength - runningLength) / taperEnd)
        : 1;

    radius = Math.max(1e-9, radius * Math.min(ts, te));

    /* Add points to left and right */

    /*
      Handle sharp corners

      Find the difference (dot product) between the current and next vector.
      If the next vector is at more than a right angle to the current vector,
      draw a cap at the current point.
    */

    const nextVector = (i < points.length - 1 ? points[i + 1] : points[i])
      .vector;
    const nextDpr = i < points.length - 1 ? dpr(vector, nextVector) : 1.0;
    const prevDpr = dpr(vector, prevVector);

    const isPointSharpCorner = prevDpr < 0 && !isPrevPointSharpCorner;
    const isNextPointSharpCorner = nextDpr !== null && nextDpr < 0;

    if (isPointSharpCorner || isNextPointSharpCorner) {
      // It's a sharp corner. Draw a rounded cap and move on to the next point
      // Considering saving these and drawing them later? So that we can avoid
      // crossing future points.

      const offset = mul(per(prevVector), radius);

      for (let step = 1 / 13, t = 0; t <= 1; t += step) {
        tl = rotAround(sub(point, offset), point, FIXED_PI * t);
        leftPts.push(tl);

        tr = rotAround(add(point, offset), point, FIXED_PI * -t);
        rightPts.push(tr);
      }

      pl = tl;
      pr = tr;

      if (isNextPointSharpCorner) {
        isPrevPointSharpCorner = true;
      }
      continue;
    }

    isPrevPointSharpCorner = false;

    // Handle the last point
    if (i === points.length - 1) {
      const offset = mul(per(vector), radius);
      leftPts.push(sub(point, offset));
      rightPts.push(add(point, offset));
      continue;
    }

    /* 
      Add regular points

      Project points to either side of the current point, using the
      calculated size as a distance. If a point's distance to the 
      previous point on that side greater than the minimum distance
      (or if the corner is kinda sharp), add the points to the side's
      points array.
    */

    const offset = mul(per(lrp(nextVector, vector, nextDpr)), radius);

    tl = sub(point, offset);

    if (i <= 1 || dist2(pl, tl) > minDistance) {
      leftPts.push(tl);
      pl = tl;
    }

    tr = add(point, offset);

    if (i <= 1 || dist2(pr, tr) > minDistance) {
      rightPts.push(tr);
      pr = tr;
    }

    // Set variables for next iteration
    prevPressure = pressure;
    prevVector = vector;
  }

  /*
    Drawing caps
    
    Now that we have our points on either side of the line, we need to
    draw caps at the start and end. Tapered lines don't have caps, but
    may have dots for very short lines.
  */

  const firstPoint = points[0].point.slice(0, 2);

  const lastPoint =
    points.length > 1
      ? points[points.length - 1].point.slice(0, 2)
      : add(points[0].point, [1, 1]);

  const startCap: number[][] = [];

  const endCap: number[][] = [];

  /* 
    Draw a dot for very short or completed strokes
    
    If the line is too short to gather left or right points and if the line is
    not tapered on either side, draw a dot. If the line is tapered, then only
    draw a dot if the line is both very short and complete. If we draw a dot,
    we can just return those points.
  */

  if (points.length === 1) {
    if (!(taperStart || taperEnd) || isComplete) {
      const start = prj(
        firstPoint,
        uni(per(sub(firstPoint, lastPoint))),
        -(firstRadius || radius),
      );
      const dotPts: number[][] = [];
      for (let step = 1 / 13, t = step; t <= 1; t += step) {
        dotPts.push(rotAround(start, firstPoint, FIXED_PI * 2 * t));
      }
      return dotPts;
    }
  } else {
    /*
    Draw a start cap

    Unless the line has a tapered start, or unless the line has a tapered end
    and the line is very short, draw a start cap around the first point. Use
    the distance between the second left and right point for the cap's radius.
    Finally remove the first left and right points. :psyduck:
  */

    if (taperStart || (taperEnd && points.length === 1)) {
      // The start point is tapered, noop
    } else if (capStart) {
      // Draw the round cap - add thirteen points rotating the right point around the start point to the left point
      for (let step = 1 / 13, t = step; t <= 1; t += step) {
        const pt = rotAround(rightPts[0], firstPoint, FIXED_PI * t);
        startCap.push(pt);
      }
    } else {
      // Draw the flat cap - add a point to the left and right of the start point
      const cornersVector = sub(leftPts[0], rightPts[0]);
      const offsetA = mul(cornersVector, 0.5);
      const offsetB = mul(cornersVector, 0.51);

      startCap.push(
        sub(firstPoint, offsetA),
        sub(firstPoint, offsetB),
        add(firstPoint, offsetB),
        add(firstPoint, offsetA),
      );
    }

    /*
    Draw an end cap

    If the line does not have a tapered end, and unless the line has a tapered
    start and the line is very short, draw a cap around the last point. Finally,
    remove the last left and right points. Otherwise, add the last point. Note
    that This cap is a full-turn-and-a-half: this prevents incorrect caps on
    sharp end turns.
  */

    const direction = per(neg(points[points.length - 1].vector));

    if (taperEnd || (taperStart && points.length === 1)) {
      // Tapered end - push the last point to the line
      endCap.push(lastPoint);
    } else if (capEnd) {
      // Draw the round end cap
      const start = prj(lastPoint, direction, radius);
      for (let step = 1 / 29, t = step; t < 1; t += step) {
        endCap.push(rotAround(start, lastPoint, FIXED_PI * 3 * t));
      }
    } else {
      // Draw the flat end cap

      endCap.push(
        add(lastPoint, mul(direction, radius)),
        add(lastPoint, mul(direction, radius * 0.99)),
        sub(lastPoint, mul(direction, radius * 0.99)),
        sub(lastPoint, mul(direction, radius)),
      );
    }
  }

  /*
    Return the points in the correct winding order: begin on the left side, then 
    continue around the end cap, then come back along the right side, and finally 
    complete the start cap.
  */

  return leftPts.concat(endCap, rightPts.reverse(), startCap);
}

/**
 * ## getStroke
 * @description Get an array of points describing a polygon that surrounds the input points.
 * @param points An array of points (as `[x, y, pressure]` or `{x, y, pressure}`). Pressure is optional in both cases.
 * @param options (optional) An object with options.
 * @param options.size	The base size (diameter) of the stroke.
 * @param options.thinning The effect of pressure on the stroke's size.
 * @param options.smoothing	How much to soften the stroke's edges.
 * @param options.easing	An easing function to apply to each point's pressure.
 * @param options.simulatePressure Whether to simulate pressure based on velocity.
 * @param options.start Cap, taper and easing for the start of the line.
 * @param options.end Cap, taper and easing for the end of the line.
 * @param options.last Whether to handle the points as a completed stroke.
 */

export function getStroke(
  points: (number[] | { x: number; y: number; pressure?: number })[],
  options: StrokeOptions = {} as StrokeOptions,
): number[][] {
  return getStrokeOutlinePoints(getStrokePoints(points, options), options);
}
