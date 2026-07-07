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
import { getFreeDrawCapsuleSegments } from "./freedraw";

import type { ExcalidrawElementWithCanvas } from "./renderElement";
import type {
  ExcalidrawFreeDrawElement,
  NonDeletedSceneElementsMap,
} from "./types";

/**
 * Traces a single tapered-capsule primitive (segment `(x0,y0,r0)→(x1,y1,r1)`)
 * as one closed sub-path onto the *current* canvas path.  It does not call
 * `beginPath`/`fill` — the caller batches every capsule of a stroke into one
 * path and fills once.  All sub-paths are wound the same way so overlapping
 * capsules union cleanly under the nonzero winding rule, which is what lets us
 * drop the old per-junction sealing circles: each capsule already carries round
 * end caps, so consecutive caps at a shared joint form a full round join with
 * no seam.
 *
 * Geometry matches `freedrawTaperedCapsulePath` in shape.ts (the SVG export)
 * so the raster and the exported vector coincide.
 */
const appendCapsuleSubPath = (
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
    // Degenerate — full circle at the midpoint (covers the single-point dot).
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    context.moveTo(cx + r, cy);
    context.arc(cx, cy, r, 0, Math.PI * 2);
    return;
  }

  // Perpendicular unit vector (segment direction rotated +90°).
  const px = -dy / len;
  const py = dx / len;
  // Angle of the +perp offset; the two half-circle caps sweep π from here.
  const theta = Math.atan2(py, px);

  // Back cap (trailing half-circle around P0) then outer edge to P1's front
  // cap, then close along the other outer edge back to the start.
  context.moveTo(x0 + px * r0, y0 + py * r0); // b0 = P0 + perp·r0
  context.arc(x0, y0, r0, theta, theta + Math.PI, false); // -> b1 = P0 − perp·r0
  context.lineTo(x1 - px * r1, y1 - py * r1); // f0 = P1 − perp·r1
  context.arc(x1, y1, r1, theta + Math.PI, theta, false); // -> f1 = P1 + perp·r1
  context.closePath();
};

/**
 * Draws a freedraw stroke as a chain of subdivided tapered capsules filled in a
 * single pass.  The centreline is the shared midpoint-quadratic B-spline
 * subdivision from `getFreeDrawCapsuleSegments`, so the raster matches the SVG
 * export and the hit-test outline, and fine subdivision removes the faceting
 * that a one-primitive-per-input-point scheme produced.
 *
 * @param fromIndex   Draw segments starting from this point index.  Pass 0 to
 *                    draw from the beginning.  For an incremental append this is
 *                    the previously committed point count; the batch is silently
 *                    extended one interval earlier so its outer anti-aliased
 *                    edge lands inside already-painted pixels, leaving no seam
 *                    against the previous batch.
 * @param upToIndex   Draw segments only up to (but not including) this point
 *                    index.  Omit or pass `undefined` to draw all remaining
 *                    points.  Used by the incremental canvas to stop short of
 *                    the last (provisional) segment.
 */
export const drawFreeDrawSegments = (
  element: ExcalidrawFreeDrawElement,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  fromIndex: number,
  upToIndex?: number,
  scale = 1,
) => {
  const strokeColor =
    renderConfig.theme === THEME.DARK
      ? applyDarkModeFilter(element.strokeColor)
      : element.strokeColor;

  context.fillStyle = strokeColor;

  // Overlap the previous batch by one input interval so the seam between
  // separately-filled batches is buried inside the opaque stroke body rather
  // than sitting on the silhouette.  Pressure smoothing is causal, so redrawing
  // an earlier interval reproduces identical geometry (idempotent overpaint).
  const genFrom = fromIndex <= 0 ? 0 : fromIndex - 1;

  const segments = getFreeDrawCapsuleSegments(element, genFrom, upToIndex);
  if (segments.length === 0) {
    return;
  }

  context.beginPath();
  for (const s of segments) {
    appendCapsuleSubPath(context, s.x0, s.y0, s.r0, s.x1, s.y1, s.r1);
  }
  context.fill();
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
   * Accumulation canvas - contains all spline intervals whose geometry is
   * fully finalised (interval `i` — the quadratic span controlled by point
   * `i` — depends on points up to `i + 1`, so it is final once that
   * right-hand neighbour is known).  With N points the intervals
   * `< committedPointCount` have been drawn with final geometry.  Never
   * cleared; only appended to (or copied when bounds grow).
   */
  committedCanvas: HTMLCanvasElement;
  /**
   * Tip canvas - same pixel dimensions and scene origin as `committedCanvas`.
   * Cleared and redrawn every frame to contain only the trailing intervals
   * `[committedPointCount .. N-1]` whose geometry is still provisional (no
   * right-hand neighbour yet).  Composited on top of `committedCanvas` at
   * display time.
   */
  tipCanvas: HTMLCanvasElement;
  /**
   * Number of points that have been permanently drawn on `committedCanvas`.
   * The committed canvas contains intervals `< committedPointCount` with
   * final geometry.  Always lags the current point count by 1 (the tip holds
   * the last unfinalisable interval).
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
 * Spline interval `i` (the quadratic span controlled by point `i`, from
 * `mid(p[i-1], p[i])` to `mid(p[i], p[i+1])`) depends on `points[i+1]`.
 * Until that neighbour arrives the trailing geometry is provisional: with N
 * points only interval `N-1` (the lead-out to the current pointer position)
 * cannot be finalised yet.
 *
 * - **`committedCanvas`** - contains all intervals whose geometry is final.
 *   With N points: intervals `< N-1` (`committedPointCount = N-1`).  This
 *   canvas is append-only; its pixels are never invalidated.  When a new
 *   point arrives, the previously provisional interval becomes final (its
 *   right-hand neighbour now exists) and is drawn onto the committed canvas.
 *
 * - **`tipCanvas`** - cleared and redrawn every frame to contain only the
 *   provisional trailing intervals `>= committedPointCount`.  Composited on
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
  // With N points the last finalisable interval is N-2 (its quadratic span
  // needs N-1 as right-hand neighbour, and N-1 is always present).  We draw
  // from `committedFromIndex` up to (but not including) interval N-1, so the
  // committed canvas contains intervals [1 .. N-2].
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
  // Always cleared and redrawn: contains only the provisional trailing
  // intervals [committedPointCount .. N-1] (the lead-out to the pointer).
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
