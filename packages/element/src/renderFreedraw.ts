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

/**
 * Half-width (in samples) of the triangular smoothing kernel applied to raw
 * pressure values before computing stroke radii.  A radius of R means each
 * pressure sample is averaged with R neighbours on each side, weighted
 * linearly so the centre sample has weight R+1 and the outermost weight 1.
 * Larger values produce a smoother, more uniform stroke width.
 */
const PRESSURE_SMOOTHING_RADIUS = 6;

/**
 * Draws a single stroke segment primitive for the triplet (pPrev, pCur, pNext).
 *
 * The primitive is a closed quadrilateral with curved top and bottom edges:
 *   A        = midpoint(pPrev, pCur)  — left junction, shared with the previous primitive
 *   B        = midpoint(pCur, pNext)  — right junction, shared with the next primitive
 *   M'1/M'2  at A:    ±rA perpendicular to the pPrev→pCur direction
 *   M1/M2    at pCur: ±rCur along the bisector normal of the two edge directions
 *   M''1/M''2 at B:   ±rB perpendicular to the pCur→pNext direction
 *
 * Shape boundary (clockwise):
 *   M'1 →[quadratic Bezier through M1]→ M''1 →[line]→ M''2
 *       →[quadratic Bezier through M2]→  M'2  →[line]→  M'1
 *
 * Adjacent primitives share their junction points so the stroke outline is
 * geometrically continuous with no gaps or overlaps.
 */
const drawStrokeSegment = (
  context: CanvasRenderingContext2D,
  pPrevX: number,
  pPrevY: number,
  rPrev: number,
  pCurX: number,
  pCurY: number,
  rCur: number,
  pNextX: number,
  pNextY: number,
  rNext: number,
) => {
  // A = midpoint(pPrev, pCur), B = midpoint(pCur, pNext)
  const ax = (pPrevX + pCurX) * 0.5;
  const ay = (pPrevY + pCurY) * 0.5;
  const rA = (rPrev + rCur) * 0.5;
  const bx = (pCurX + pNextX) * 0.5;
  const by = (pCurY + pNextY) * 0.5;
  const rB = (rCur + rNext) * 0.5;

  // Perpendicular unit vector at A (normal to pPrev→pCur)
  const daX = pCurX - pPrevX;
  const daY = pCurY - pPrevY;
  const daLenInv = 1 / (Math.sqrt(daX * daX + daY * daY) || 1e-10);
  const nAX = -daY * daLenInv;
  const nAY = daX * daLenInv;

  // Perpendicular unit vector at B (normal to pCur→pNext)
  const dbX = pNextX - pCurX;
  const dbY = pNextY - pCurY;
  const dbLenInv = 1 / (Math.sqrt(dbX * dbX + dbY * dbY) || 1e-10);
  const nBX = -dbY * dbLenInv;
  const nBY = dbX * dbLenInv;

  // Bisector normal at pCur: normalised average of nA and nB
  const bisRawX = nAX + nBX;
  const bisRawY = nAY + nBY;
  const bisLen = Math.sqrt(bisRawX * bisRawX + bisRawY * bisRawY);
  const bisNX = bisLen > 1e-10 ? bisRawX / bisLen : nAX;
  const bisNY = bisLen > 1e-10 ? bisRawY / bisLen : nAY;

  // M'1, M'2 at A
  const mp1x = ax + nAX * rA;
  const mp1y = ay + nAY * rA;
  const mp2x = ax - nAX * rA;
  const mp2y = ay - nAY * rA;

  // M1, M2 at pCur — used directly as the quadratic Bézier control points.
  // The junction points (M'1, M''1, etc.) are midpoints between consecutive
  // control points, which is the classic midpoint quadratic B-spline scheme.
  // This guarantees C1 continuity: the shared junction is always the midpoint
  // of the two flanking CPs, so the tangent is continuous across segments.
  const m1x = pCurX + bisNX * rCur;
  const m1y = pCurY + bisNY * rCur;
  const m2x = pCurX - bisNX * rCur;
  const m2y = pCurY - bisNY * rCur;

  // M''1, M''2 at B
  const mpp1x = bx + nBX * rB;
  const mpp1y = by + nBY * rB;
  const mpp2x = bx - nBX * rB;
  const mpp2y = by - nBY * rB;

  context.beginPath();
  context.moveTo(mp1x, mp1y);
  // Top edge: M'1 → M''1, control point = M1 (bisector offset at pCur)
  context.quadraticCurveTo(m1x, m1y, mpp1x, mpp1y);
  // Right cap: M''1 → M''2
  context.lineTo(mpp2x, mpp2y);
  // Bottom edge: M''2 → M'2, control point = M2
  context.quadraticCurveTo(m2x, m2y, mp2x, mp2y);
  // Left cap: M'2 → M'1
  context.closePath();
  context.fill();

  // Filled circles at the junction midpoints seal any sub-pixel anti-aliasing
  // gap where adjacent segment fills share a boundary edge.
  context.beginPath();
  context.arc(ax, ay, rA, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(bx, by, rB, 0, Math.PI * 2);
  context.fill();
};

/**
 * Draws freedraw points as pressure-aware curved stroke segment primitives.
 * For each consecutive triplet of points (i-1, i, i+1) a curved quadrilateral
 * is drawn whose side edges sit at the midpoints of the consecutive point pairs
 * and whose top/bottom edges are quadratic Bezier curves passing through the
 * stroke-width offset at the centre point.  Adjacent primitives share their
 * side-edge positions, so the rendered outline is continuous with no gaps.
 *
 * @param fromIndex   Draw segments starting from this point index (inclusive).
 *                    Pass 0 to draw from the beginning.
 * @param upToIndex   Draw segments only up to (but not including) this point
 *                    index.  Omit or pass `undefined` to draw all remaining
 *                    points.  Used by the incremental canvas to stop short of
 *                    the last segment so the committed canvas only contains
 *                    segments whose geometry is fully determined by immutable
 *                    points.
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
    const r0 = baseRadius * getSmoothedPressure(i - 1) * 2;
    const r1 = baseRadius * getSmoothedPressure(i) * 2;

    // Triplet: need i+1; if at the last point, mirror i-1 around i (degenerate tip).
    let p2x: number;
    let p2y: number;
    let r2: number;
    if (i < N - 1) {
      p2x = points[i + 1][0];
      p2y = points[i + 1][1];
      r2 = baseRadius * getSmoothedPressure(i + 1) * 2;
    } else {
      p2x = 2 * p1[0] - p0[0];
      p2y = 2 * p1[1] - p0[1];
      r2 = r0;
    }

    drawStrokeSegment(
      context,
      p0[0],
      p0[1],
      r0,
      p1[0],
      p1[1],
      r1,
      p2x,
      p2y,
      r2,
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
  freedrawIncrementalCache.delete(element);
};
