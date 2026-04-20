import { applyDarkModeFilter, THEME } from "@excalidraw/common";

import type { StaticCanvasRenderConfig } from "@excalidraw/excalidraw/scene/types";

import type {
  AppState,
  InteractiveCanvasAppState,
  StaticCanvasAppState,
  Zoom,
} from "@excalidraw/excalidraw/types";

import { getElementAbsoluteCoords } from "./bounds";
import { getContainingFrame } from "./frame";

import type { ExcalidrawElementWithCanvas } from "./renderElement";
import type {
  ExcalidrawFreeDrawElement,
  NonDeletedSceneElementsMap,
} from "./types";

const DEFAULT_FREEDRAW_PRESSURE = 0.5;

// Ever-incrementing capsule counter used to produce rotating hue coloring.
let capsuleIndex = 0;

/**
 * Draws a single tapered capsule (variable-width filled stroke segment) from
 * (x0,y0) with radius r0 to (x1,y1) with radius r1.  The shape is a filled
 * path consisting of a back semicircle at the start, a straight side on each
 * side, and a front semicircle at the end, so that adjacent segments sharing
 * a point use the same radius and produce a seamlessly continuous stroke.
 */
const drawTaperedCapsule = (
  context: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const r = Math.max(r0, r1);

  if (len < r / 2) {
    // Degenerate segment - draw a filled circle at the larger radius
    context.beginPath();
    context.arc((x0 + x1) / 2, (y0 + y1) / 2, r, 0, Math.PI * 2);
    context.fill();
    return;
  }

  // Debug: rotating hue based on capsule index to visually verify that segments
  //
  const strokeColor = `hsl(${(capsuleIndex * 37) % 360} 100% 50%)`;
  capsuleIndex++;
  if (false) {
    context.fillStyle = strokeColor;
  }

  const angle = Math.atan2(dy, dx);
  const px = -dy / len; // perpendicular unit x = -sin(angle)
  const py = dx / len; // perpendicular unit y =  cos(angle)

  context.beginPath();
  // Back semicircle at P0: clockwise from (P0 + perp*r0) through (back of P0) to (P0 - perp*r0)
  context.arc(x0, y0, r0, angle + Math.PI / 2, angle - Math.PI / 2, false);
  // Neg-perp side: P0 - perp*r0  ->  P1 - perp*r1  (arc endpoint is already P0 - perp*r0)
  context.lineTo(x1 - px * r1, y1 - py * r1);
  // Front semicircle at P1: clockwise from (P1 - perp*r1) through (front of P1) to (P1 + perp*r1)
  context.arc(x1, y1, r1, angle - Math.PI / 2, angle + Math.PI / 2, false);
  // Perp side: P1 + perp*r1  ->  P0 + perp*r0
  context.lineTo(x0 + px * r0, y0 + py * r0);
  context.closePath();
  context.fill();
};

/**
 * Flatness tolerance in screen pixels for adaptive Bezier subdivision.
 * A cubic segment is considered flat (and drawn as a single capsule) when
 * both interior control points deviate less than this many pixels from the
 * p0→p1 chord.  Smaller values give smoother curves at the cost of more draw
 * calls.
 */
const BEZIER_FLATNESS_TOLERANCE_PX = 0.1;

/**
 * Half-width (in samples) of the triangular smoothing kernel applied to raw
 * pressure values before computing stroke radii.  A radius of R means each
 * pressure sample is averaged with R neighbours on each side, weighted
 * linearly so the centre sample has weight R+1 and the outermost weight 1.
 * Larger values produce a smoother, more uniform stroke width.
 */
const PRESSURE_SMOOTHING_RADIUS = 6;

/**
 * Returns the Catmull-Rom tangent vector at points[i], using the neighbouring
 * points for a uniform parameterisation.  At the first point a one-sided
 * forward tangent is used.
 */
const getCatmullRomTangent = (
  points: readonly (readonly [number, number])[],
  i: number,
): [number, number] => {
  const N = points.length;
  const cur = points[i];

  // Determine the "next" point: real neighbour, predicted point, or mirrored.
  let next: readonly [number, number];
  if (i < N - 1) {
    next = points[i + 1];
  } else {
    // Mirror back across cur to get a forward tangent at the last point.
    const prev2 = i > 0 ? points[i - 1] : cur;
    next = [2 * cur[0] - prev2[0], 2 * cur[1] - prev2[1]];
  }

  let tx: number;
  let ty: number;

  if (i === 0) {
    // One-sided tangent at the first point.
    tx = (next[0] - cur[0]) * 0.5;
    ty = (next[1] - cur[1]) * 0.5;
  } else {
    const prev = points[i - 1];
    tx = (next[0] - prev[0]) * 0.5;
    ty = (next[1] - prev[1]) * 0.5;
  }

  // Chord-length clamping (PCHIP-style):
  // |t| <= 3 * min(chord_to_prev, chord_to_next).
  const magSq = tx * tx + ty * ty;
  if (magSq > 0) {
    const dNx = next[0] - cur[0];
    const dNy = next[1] - cur[1];
    const chordNext = Math.sqrt(dNx * dNx + dNy * dNy);
    let chordPrev = chordNext;
    if (i > 0) {
      const prev = points[i - 1];
      const dPx = cur[0] - prev[0];
      const dPy = cur[1] - prev[1];
      chordPrev = Math.sqrt(dPx * dPx + dPy * dPy);
    }
    const maxMag = 3 * Math.min(chordNext, chordPrev);
    const mag = Math.sqrt(magSq);
    if (mag > maxMag) {
      const scale = maxMag / mag;
      tx *= scale;
      ty *= scale;
    }
  }

  return [tx, ty];
};

// Stack entry for adaptive Bezier subdivision.
// [p0x, p0y, r0, cp1x, cp1y, cp2x, cp2y, p1x, p1y, r1]
type BezierSegment = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

// Reusable stack to avoid per-frame allocation.
const subdivStack: BezierSegment[] = [];

/**
 * Draws one adaptively-subdivided tapered segment from p0 (radius r0) to p1
 * (radius r1). t0/t1 are the Catmull-Rom tangents at p0 and p1 respectively.
 *
 * Uses de Casteljau bisection: a segment is split at t=0.5 until both interior
 * control points are within BEZIER_FLATNESS_TOLERANCE_PX pixels of the chord,
 * guaranteeing that each drawn capsule has focus-point distance ≈ chord ≈ arc.
 */
const drawSubdividedSegment = (
  context: CanvasRenderingContext2D,
  p0x: number,
  p0y: number,
  r0: number,
  p1x: number,
  p1y: number,
  r1: number,
  t0x: number,
  t0y: number,
  t1x: number,
  t1y: number,
  scale: number,
) => {
  // Cubic Bezier control points derived from Catmull-Rom tangents.
  const cp1x = p0x + t0x / 3;
  const cp1y = p0y + t0y / 3;
  const cp2x = p1x - t1x / 3;
  const cp2y = p1y - t1y / 3;

  // Tighten the flatness tolerance at high-angle turns to produce 2× more
  // capsules there.  The turn angle is the angle between the entry tangent t0
  // and exit tangent t1.  cos θ goes from 1 (straight) to −1 (U-turn).
  // toleranceFactor = 0.5 + 0.5·max(0, cos θ), so it is 1.0 for straight
  // segments and 0.5 (half tolerance → 2× resolution) for turns ≥ 90°.
  const t0Len = Math.sqrt(t0x * t0x + t0y * t0y);
  const t1Len = Math.sqrt(t1x * t1x + t1y * t1y);
  const cosTheta =
    t0Len > 1e-10 && t1Len > 1e-10
      ? (t0x * t1x + t0y * t1y) / (t0Len * t1Len)
      : 1;
  const toleranceFactor = 0.5 + 0.5 * Math.max(0, cosTheta);

  // Flatness tolerance in scene units.
  const tol = (BEZIER_FLATNESS_TOLERANCE_PX * toleranceFactor) / scale;
  const tolSq = tol * tol;

  let top = 0;
  subdivStack[top++] = [p0x, p0y, r0, cp1x, cp1y, cp2x, cp2y, p1x, p1y, r1];

  while (top > 0) {
    const seg = subdivStack[--top];
    const [ax, ay, ar, b1x, b1y, b2x, b2y, dx, dy, dr] = seg;

    // Squared distance from a point to the chord (ax,ay)→(dx,dy).
    const cdx = dx - ax;
    const cdy = dy - ay;
    const chordLenSq = cdx * cdx + cdy * cdy;

    let flat: boolean;
    if (chordLenSq < 1e-10) {
      // Degenerate chord: check raw distance to endpoints.
      flat =
        (b1x - ax) * (b1x - ax) + (b1y - ay) * (b1y - ay) <= tolSq &&
        (b2x - ax) * (b2x - ax) + (b2y - ay) * (b2y - ay) <= tolSq;
    } else {
      // Perpendicular distance² = |cross|² / |chord|²
      const cross1 = (b1x - ax) * cdy - (b1y - ay) * cdx;
      const cross2 = (b2x - ax) * cdy - (b2y - ay) * cdx;
      flat =
        cross1 * cross1 <= tolSq * chordLenSq &&
        cross2 * cross2 <= tolSq * chordLenSq;
    }

    if (flat) {
      drawTaperedCapsule(context, ax, ay, ar, dx, dy, dr);
      continue;
    }

    // De Casteljau bisection at t = 0.5.
    const m01x = (ax + b1x) * 0.5;
    const m01y = (ay + b1y) * 0.5;
    const m12x = (b1x + b2x) * 0.5;
    const m12y = (b1y + b2y) * 0.5;
    const m23x = (b2x + dx) * 0.5;
    const m23y = (b2y + dy) * 0.5;
    const m012x = (m01x + m12x) * 0.5;
    const m012y = (m01y + m12y) * 0.5;
    const m123x = (m12x + m23x) * 0.5;
    const m123y = (m12y + m23y) * 0.5;
    const mx = (m012x + m123x) * 0.5;
    const my = (m012y + m123y) * 0.5;
    const mr = (ar + dr) * 0.5;

    // Push right half first so left half is processed first (LIFO).
    subdivStack[top++] = [mx, my, mr, m123x, m123y, m23x, m23y, dx, dy, dr];
    subdivStack[top++] = [ax, ay, ar, m01x, m01y, m012x, m012y, mx, my, mr];
  }
};

/**
 * Draws freedraw points as bezier-subdivided, pressure-aware tapered capsule
 * segments.  Consecutive real points are connected with Catmull-Rom cubic
 * bezier curves so the rendered stroke is smooth even when input samples are
 * sparse.
 *
 * @param fromIndex   Draw segments starting from this point index (inclusive).
 *                    Pass 0 to draw from the beginning.
 * @param upToIndex   Draw segments only up to (but not including) this point
 *                    index.  Omit or pass `undefined` to draw all remaining
 *                    points.  Used by the incremental canvas to stop short of
 *                    the last segment so the committed canvas only contains
 *                    segments whose Catmull-Rom tangents are fully finalised
 *                    (i.e.  the right-hand neighbour is known).
 */
export const drawFreeDrawSegments = (
  element: ExcalidrawFreeDrawElement,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  fromIndex: number,
  upToIndex?: number,
  scale = 1,
) => {
  const { points, pressures } = element;
  const N = points.length;
  const strokeColor =
    renderConfig.theme === THEME.DARK
      ? applyDarkModeFilter(element.strokeColor)
      : element.strokeColor;

  context.fillStyle = strokeColor;

  const baseRadius = (element.strokeWidth * 1.25) / 2;

  // Causal (one-sided) triangular-kernel weighted average of past pressure
  // samples.  Only looks backward [i-R .. i], so a newly-arrived point never
  // retroactively changes the smoothed pressure of any previously rendered
  // segment.  This ensures live and final renders are identical at all points.
  // When simulatePressure is true, constant pressure is used for all points.
  const getSmoothedPressure = (i: number): number => {
    if (element.simulatePressure || pressures.length === 0) {
      return DEFAULT_FREEDRAW_PRESSURE;
    }
    let sum = 0;
    let totalWeight = 0;
    for (let k = -PRESSURE_SMOOTHING_RADIUS; k <= 0; k++) {
      const idx = i + k;
      if (idx < 0) {
        continue;
      }
      const p =
        idx < pressures.length ? pressures[idx] : DEFAULT_FREEDRAW_PRESSURE;
      const w = PRESSURE_SMOOTHING_RADIUS + 1 + k; // 1 at i-R, R+1 at i
      sum += p * w;
      totalWeight += w;
    }
    return totalWeight > 0 ? sum / totalWeight : DEFAULT_FREEDRAW_PRESSURE;
  };

  if (
    fromIndex === 0 &&
    N === 1 &&
    (upToIndex === undefined || upToIndex >= 1)
  ) {
    // Single-point stroke -> filled circle (dot)
    const r = baseRadius * getSmoothedPressure(0) * 2;
    context.beginPath();
    context.arc(points[0][0], points[0][1], r, 0, Math.PI * 2);
    context.fill();

    return;
  }

  const end = upToIndex !== undefined ? Math.min(upToIndex, N) : N;
  const start = Math.max(fromIndex, 1);
  for (let i = start; i < end; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    // Very first pressure values are often unreliable,
    // so for the first couple of segments use a radius
    const r0 = baseRadius * getSmoothedPressure(i - 1) * 2;
    const r1 = baseRadius * getSmoothedPressure(i) * 2;

    const t0 = getCatmullRomTangent(points, i - 1);
    const t1 = getCatmullRomTangent(points, i);

    drawSubdividedSegment(
      context,
      p0[0],
      p0[1],
      r0,
      p1[0],
      p1[1],
      r1,
      t0[0],
      t0[1],
      t1[0],
      t1[1],
      scale,
    );
  }
};

// ─── Incremental freedraw canvas cache ───────────────────────────────────────
// A separate WeakMap that survives ShapeCache.delete() calls so that the raster
// accumulates new capsule segments without full regeneration on every added
// point.

// screen pixels - minimum extra lookahead space on each side
// (divided by scale at use)
const FREEDRAW_CANVAS_OVERSHOOT_MIN = 200;

// allocate current_dimension * factor extra on each side
const FREEDRAW_CANVAS_OVERSHOOT_FACTOR = 0.5;

interface FreeDrawIncrementalCanvas {
  /**
   * Accumulation canvas - contains all segments whose Catmull-Rom tangents are
   * fully finalised (right-hand neighbour is known).  With N points the last
   * finalised segment ends at index `committedPointCount - 1`, meaning segment
   * `[committedPointCount-2 -> committedPointCount-1]` has been drawn with the
   * correct tangent at `committedPointCount-1` (since point
   * `committedPointCount` existed when it was drawn).  Never cleared; only
   * appended to (or copied when bounds grow).
   */
  committedCanvas: HTMLCanvasElement;
  /**
   * Tip canvas - same pixel dimensions and scene origin as `committedCanvas`.
   * Cleared and redrawn every frame to contain only the last segment
   * `[committedPointCount-1 -> N-1]` whose tangent at `N-1` is still
   * provisional (no right-hand neighbour yet).  Composited on top of
   * `committedCanvas` at display time.
   */
  tipCanvas: HTMLCanvasElement;
  /**
   * Number of points that have been permanently drawn on `committedCanvas`.
   * The committed canvas contains segments through point index
   * `committedPointCount - 1` with final tangents.  Always lags the current
   * point count by 1 (the tip holds the last unfinalisable segment).
   */
  committedPointCount: number;
  canvasOriginSceneX: number;
  canvasOriginSceneY: number;
  canvasAllocX1: number;
  canvasAllocY1: number;
  canvasAllocX2: number;
  canvasAllocY2: number;
  scale: number;
  theme: AppState["theme"];
}

const freedrawIncrementalCache = new WeakMap<
  ExcalidrawFreeDrawElement,
  FreeDrawIncrementalCanvas
>();

export const getFreedrawCanvasPadding = (element: ExcalidrawFreeDrawElement) =>
  element.strokeWidth * 12;

/**
 * Generates or incrementally updates the two-canvas (committed + tip) raster
 * for a freedraw element being actively drawn.
 *
 * ## Two-canvas split
 *
 * A Catmull-Rom tangent at point `i` depends on `points[i+1]`.  Until
 * `points[i+1]` arrives, the tangent at `i` uses a mirrored fallback and is
 * therefore provisional.  The segment ending at the current tip `[N-2 -> N-1]`
 * is the only one with a provisional tangent.
 *
 * - **`committedCanvas`** - contains all segments whose tangents are final.
 *   With N points: segments `[0->1, ..., N-3->N-2]` (`committedPointCount =
 *   N-1`).  This canvas is append-only; its pixels are never invalidated.
 *   When a new point `N` arrives, the segment `[N-2 -> N-1]` is now
 *   finalised (tangent at `N-1` uses `N` as the right-hand neighbour) and is
 *   drawn onto the committed canvas.  `committedPointCount` advances to `N`.
 *
 * - **`tipCanvas`** - cleared and redrawn every frame to contain only the
 *   last provisional segment `[committedPointCount-1 -> N-1]`.  Composited on
 *   top of `committedCanvas` at display time.
 */
export const generateOrUpdateFreeDrawIncrementalCanvas = (
  element: ExcalidrawFreeDrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  zoom: Zoom,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
): ExcalidrawElementWithCanvas | null => {
  const scale = zoom.value;
  const dpr = window.devicePixelRatio;
  const padding = getFreedrawCanvasPadding(element);
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const containingFrameOpacity =
    getContainingFrame(element, elementsMap)?.opacity || 100;
  const N = element.points.length;

  const prevInc = freedrawIncrementalCache.get(element);

  const boundsExceeded =
    prevInc !== undefined &&
    (x1 < prevInc.canvasAllocX1 ||
      y1 < prevInc.canvasAllocY1 ||
      x2 > prevInc.canvasAllocX2 ||
      y2 > prevInc.canvasAllocY2);

  const needsAlloc =
    prevInc === undefined ||
    boundsExceeded ||
    prevInc.scale !== scale ||
    prevInc.theme !== appState.theme;

  // ── Canvas allocation / reallocation ──────────────────────────────────────
  let committedCanvas: HTMLCanvasElement;
  let tipCanvas: HTMLCanvasElement;
  let canvasOriginSceneX: number;
  let canvasOriginSceneY: number;
  let canvasScale: number;
  // How many points to start the committed-canvas update from.  On a full
  // regen this is 0; on a bounds-exceeded realloc it is the existing committed
  // count so we only append the new segments.
  let committedFromIndex: number;

  if (needsAlloc) {
    // Over-allocate proportionally to the current bounding box so fast large
    // strokes trigger far fewer reallocations.
    const overshootX = Math.max(
      FREEDRAW_CANVAS_OVERSHOOT_MIN / scale,
      (x2 - x1) * FREEDRAW_CANVAS_OVERSHOOT_FACTOR,
    );
    const overshootY = Math.max(
      FREEDRAW_CANVAS_OVERSHOOT_MIN / scale,
      (y2 - y1) * FREEDRAW_CANVAS_OVERSHOOT_FACTOR,
    );
    const allocX1 = x1 - overshootX;
    const allocY1 = y1 - overshootY;
    const allocX2 = x2 + overshootX;
    const allocY2 = y2 + overshootY;

    canvasOriginSceneX = allocX1 - padding / dpr;
    canvasOriginSceneY = allocY1 - padding / dpr;

    const rawW = (allocX2 - allocX1) * dpr + padding * 2;
    const rawH = (allocY2 - allocY1) * dpr + padding * 2;

    // Respect browser canvas size limits.
    const AREA_LIMIT = 16777216;
    const WIDTH_HEIGHT_LIMIT = 32767;
    canvasScale = scale;
    if (
      rawW * canvasScale > WIDTH_HEIGHT_LIMIT ||
      rawH * canvasScale > WIDTH_HEIGHT_LIMIT
    ) {
      canvasScale = Math.min(
        WIDTH_HEIGHT_LIMIT / rawW,
        WIDTH_HEIGHT_LIMIT / rawH,
      );
    }
    if (rawW * rawH * canvasScale * canvasScale > AREA_LIMIT) {
      canvasScale = Math.sqrt(AREA_LIMIT / (rawW * rawH));
    }

    const canvasWidth = Math.floor(rawW * canvasScale);
    const canvasHeight = Math.floor(rawH * canvasScale);
    if (!canvasWidth || !canvasHeight) {
      return null;
    }

    committedCanvas = document.createElement("canvas");
    committedCanvas.width = canvasWidth;
    committedCanvas.height = canvasHeight;

    tipCanvas = document.createElement("canvas");
    tipCanvas.width = canvasWidth;
    tipCanvas.height = canvasHeight;

    if (
      prevInc !== undefined &&
      boundsExceeded &&
      prevInc.scale === canvasScale &&
      prevInc.theme === appState.theme
    ) {
      // Bounds grew: copy committed raster to new canvas at the correct offset
      // and keep accumulating.  Tip will be redrawn below.
      const copyX =
        (prevInc.canvasOriginSceneX - canvasOriginSceneX) * dpr * canvasScale;
      const copyY =
        (prevInc.canvasOriginSceneY - canvasOriginSceneY) * dpr * canvasScale;
      committedCanvas
        .getContext("2d")!
        .drawImage(prevInc.committedCanvas, copyX, copyY);
      committedFromIndex = prevInc.committedPointCount;
    } else {
      // Full regeneration: zoom/theme change or first frame.
      committedFromIndex = 0;
    }

    freedrawIncrementalCache.set(element, {
      committedCanvas,
      tipCanvas,
      committedPointCount: committedFromIndex,
      canvasOriginSceneX,
      canvasOriginSceneY,
      canvasAllocX1: allocX1,
      canvasAllocY1: allocY1,
      canvasAllocX2: allocX2,
      canvasAllocY2: allocY2,
      scale: canvasScale,
      theme: appState.theme,
    });
  } else {
    committedCanvas = prevInc.committedCanvas;
    tipCanvas = prevInc.tipCanvas;
    canvasOriginSceneX = prevInc.canvasOriginSceneX;
    canvasOriginSceneY = prevInc.canvasOriginSceneY;
    canvasScale = prevInc.scale;
    committedFromIndex = prevInc.committedPointCount;
  }

  const inc = freedrawIncrementalCache.get(element)!;

  // ── Helper: draw onto a canvas with the element's scene->pixel transform ──
  const withElementContext = (
    target: HTMLCanvasElement,
    fn: (ctx: CanvasRenderingContext2D) => void,
  ) => {
    const ctx = target.getContext("2d")!;
    const offsetX = (element.x - canvasOriginSceneX) * dpr * canvasScale;
    const offsetY = (element.y - canvasOriginSceneY) * dpr * canvasScale;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(dpr * canvasScale, dpr * canvasScale);
    fn(ctx);
    ctx.restore();
  };

  // ── Update committed canvas ───────────────────────────────────────────────
  // With N points the last finalisable segment ends at N-2 (needs N-1 as
  // right-hand neighbour for the tangent at N-2, and N-1 is always present).
  // We draw from `committedFromIndex` up to (but not including) point N-1,
  // so the committed canvas contains segments [0->1, ..., N-3->N-2].
  const newCommittedCount = Math.max(1, N - 1);
  if (committedFromIndex < newCommittedCount) {
    withElementContext(committedCanvas, (ctx) => {
      drawFreeDrawSegments(
        element,
        ctx,
        renderConfig,
        committedFromIndex,
        newCommittedCount, // upToIndex - stop before the last provisional segment
        canvasScale,
      );
    });
    inc.committedPointCount = newCommittedCount;
  }

  // ── Redraw tip canvas ─────────────────────────────────────────────────────
  // Always cleared and redrawn: contains the single provisional segment
  // [committedPointCount-1 -> N-1] with a predicted-point ghost if available.
  withElementContext(tipCanvas, (ctx) => {
    ctx.clearRect(
      -(element.x - canvasOriginSceneX),
      -(element.y - canvasOriginSceneY),
      tipCanvas.width / (dpr * canvasScale),
      tipCanvas.height / (dpr * canvasScale),
    );
    drawFreeDrawSegments(
      element,
      ctx,
      renderConfig,
      inc.committedPointCount,
      undefined, // draw to natural end (the tip segment)
      canvasScale,
    );
  });

  return {
    element,
    canvas: committedCanvas,
    tipCanvas,
    theme: appState.theme,
    scale: canvasScale,
    angle: element.angle,
    zoomValue: zoom.value,
    canvasOffsetX: 0,
    canvasOffsetY: 0,
    boundTextElementVersion: null,
    imageCrop: null,
    containingFrameOpacity,
    boundTextCanvas: document.createElement("canvas"),
    canvasOriginSceneX: inc.canvasOriginSceneX,
    canvasOriginSceneY: inc.canvasOriginSceneY,
  };
};

/**
 * Removes the incremental freedraw canvas for the given element.
 * Call this when a freedraw stroke is finalised so the next render
 * produces a fresh tight-bounds canvas instead of the over-allocated one.
 */
export const invalidateFreeDrawIncrementalCanvas = (
  element: ExcalidrawFreeDrawElement,
) => {
  capsuleIndex = 0;
  freedrawIncrementalCache.delete(element);
};
