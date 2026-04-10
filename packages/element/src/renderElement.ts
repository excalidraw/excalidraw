import rough from "roughjs/bin/rough";

import {
  type GlobalPoint,
  isRightAngleRads,
  lineSegment,
  pointFrom,
  pointRotateRads,
  type Radians,
} from "@excalidraw/math";

import {
  BOUND_TEXT_PADDING,
  DEFAULT_REDUCED_GLOBAL_ALPHA,
  ELEMENT_READY_TO_ERASE_OPACITY,
  FRAME_STYLE,
  DARK_THEME_FILTER,
  MIME_TYPES,
  THEME,
  distance,
  getFontString,
  isRTL,
  getVerticalOffset,
  invariant,
  applyDarkModeFilter,
  isSafari,
} from "@excalidraw/common";

import type {
  AppState,
  StaticCanvasAppState,
  Zoom,
  InteractiveCanvasAppState,
  ElementsPendingErasure,
  PendingExcalidrawElements,
  NormalizedZoomValue,
} from "@excalidraw/excalidraw/types";

import type {
  StaticCanvasRenderConfig,
  RenderableElementsMap,
  InteractiveCanvasRenderConfig,
} from "@excalidraw/excalidraw/scene/types";

import { getElementAbsoluteCoords, getElementBounds } from "./bounds";
import { getUncroppedImageElement } from "./cropElement";
import { LinearElementEditor } from "./linearElementEditor";
import {
  getBoundTextElement,
  getContainerCoords,
  getContainerElement,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
} from "./textElement";
import { getLineHeightInPx } from "./textMeasurements";
import {
  isTextElement,
  isLinearElement,
  isFreeDrawElement,
  isInitializedImageElement,
  isArrowElement,
  hasBoundTextElement,
  isMagicFrameElement,
  isImageElement,
} from "./typeChecks";
import { getContainingFrame } from "./frame";
import { getCornerRadius } from "./utils";

import { ShapeCache } from "./shape";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawFrameLikeElement,
  NonDeletedSceneElementsMap,
  ElementsMap,
} from "./types";

import type { RoughCanvas } from "roughjs/bin/canvas";

const isPendingImageElement = (
  element: ExcalidrawElement,
  renderConfig: StaticCanvasRenderConfig,
) =>
  isInitializedImageElement(element) &&
  !renderConfig.imageCache.has(element.fileId);

const getCanvasPadding = (element: ExcalidrawElement) => {
  switch (element.type) {
    case "freedraw":
      return element.strokeWidth * 12;
    case "text":
      return element.fontSize / 2;
    case "arrow":
      if (element.endArrowhead || element.endArrowhead) {
        return 40;
      }
      return 20;
    default:
      return 20;
  }
};

export const getRenderOpacity = (
  element: ExcalidrawElement,
  containingFrame: ExcalidrawFrameLikeElement | null,
  elementsPendingErasure: ElementsPendingErasure,
  pendingNodes: Readonly<PendingExcalidrawElements> | null,
  globalAlpha: number = 1,
) => {
  // multiplying frame opacity with element opacity to combine them
  // (e.g. frame 50% and element 50% opacity should result in 25% opacity)
  let opacity =
    (((containingFrame?.opacity ?? 100) * element.opacity) / 10000) *
    globalAlpha;

  // if pending erasure, multiply again to combine further
  // (so that erasing always results in lower opacity than original)
  if (
    elementsPendingErasure.has(element.id) ||
    (pendingNodes && pendingNodes.some((node) => node.id === element.id)) ||
    (containingFrame && elementsPendingErasure.has(containingFrame.id))
  ) {
    opacity *= ELEMENT_READY_TO_ERASE_OPACITY / 100;
  }

  return opacity;
};

export interface ExcalidrawElementWithCanvas {
  element: ExcalidrawElement | ExcalidrawTextElement;
  canvas: HTMLCanvasElement;
  theme: AppState["theme"];
  scale: number;
  angle: number;
  zoomValue: AppState["zoom"]["value"];
  canvasOffsetX: number;
  canvasOffsetY: number;
  boundTextElementVersion: number | null;
  imageCrop: ExcalidrawImageElement["crop"] | null;
  containingFrameOpacity: number;
  boundTextCanvas: HTMLCanvasElement;
  canvasOriginSceneX?: number;
  canvasOriginSceneY?: number;
}

const cappedElementCanvasSize = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  zoom: Zoom,
): {
  width: number;
  height: number;
  scale: number;
} => {
  // these limits are ballpark, they depend on specific browsers and device.
  // We've chosen lower limits to be safe. We might want to change these limits
  // based on browser/device type, if we get reports of low quality rendering
  // on zoom.
  //
  // ~ safari mobile canvas area limit
  const AREA_LIMIT = 16777216;
  // ~ safari width/height limit based on developer.mozilla.org.
  const WIDTH_HEIGHT_LIMIT = 32767;

  const padding = getCanvasPadding(element);

  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const elementWidth =
    isLinearElement(element) || isFreeDrawElement(element)
      ? distance(x1, x2)
      : element.width;
  const elementHeight =
    isLinearElement(element) || isFreeDrawElement(element)
      ? distance(y1, y2)
      : element.height;

  let width = elementWidth * window.devicePixelRatio + padding * 2;
  let height = elementHeight * window.devicePixelRatio + padding * 2;

  let scale: number = zoom.value;

  // rescale to ensure width and height is within limits
  if (
    width * scale > WIDTH_HEIGHT_LIMIT ||
    height * scale > WIDTH_HEIGHT_LIMIT
  ) {
    scale = Math.min(WIDTH_HEIGHT_LIMIT / width, WIDTH_HEIGHT_LIMIT / height);
  }

  // rescale to ensure canvas area is within limits
  if (width * height * scale * scale > AREA_LIMIT) {
    scale = Math.sqrt(AREA_LIMIT / (width * height));
  }

  width = Math.floor(width * scale);
  height = Math.floor(height * scale);

  return { width, height, scale };
};

const generateElementCanvas = (
  element: NonDeletedExcalidrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  zoom: Zoom,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
): ExcalidrawElementWithCanvas | null => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const padding = getCanvasPadding(element);

  const { width, height, scale } = cappedElementCanvasSize(
    element,
    elementsMap,
    zoom,
  );

  if (!width || !height) {
    return null;
  }

  canvas.width = width;
  canvas.height = height;

  let canvasOffsetX = -100;
  let canvasOffsetY = 0;

  if (isLinearElement(element) || isFreeDrawElement(element)) {
    const [x1, y1] = getElementAbsoluteCoords(element, elementsMap);

    canvasOffsetX =
      element.x > x1
        ? distance(element.x, x1) * window.devicePixelRatio * scale
        : 0;

    canvasOffsetY =
      element.y > y1
        ? distance(element.y, y1) * window.devicePixelRatio * scale
        : 0;

    context.translate(canvasOffsetX, canvasOffsetY);
  }

  context.save();
  context.translate(padding * scale, padding * scale);
  context.scale(
    window.devicePixelRatio * scale,
    window.devicePixelRatio * scale,
  );

  const rc = rough.canvas(canvas);

  drawElementOnCanvas(element, rc, context, renderConfig);

  context.restore();

  const boundTextElement = getBoundTextElement(element, elementsMap);
  const boundTextCanvas = document.createElement("canvas");
  const boundTextCanvasContext = boundTextCanvas.getContext("2d")!;

  if (isArrowElement(element) && boundTextElement) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    // Take max dimensions of arrow canvas so that when canvas is rotated
    // the arrow doesn't get clipped
    const maxDim = Math.max(distance(x1, x2), distance(y1, y2));
    boundTextCanvas.width =
      maxDim * window.devicePixelRatio * scale + padding * scale * 10;
    boundTextCanvas.height =
      maxDim * window.devicePixelRatio * scale + padding * scale * 10;
    boundTextCanvasContext.translate(
      boundTextCanvas.width / 2,
      boundTextCanvas.height / 2,
    );
    boundTextCanvasContext.rotate(element.angle);
    boundTextCanvasContext.drawImage(
      canvas!,
      -canvas.width / 2,
      -canvas.height / 2,
      canvas.width,
      canvas.height,
    );

    const [, , , , boundTextCx, boundTextCy] = getElementAbsoluteCoords(
      boundTextElement,
      elementsMap,
    );

    boundTextCanvasContext.rotate(-element.angle);
    const offsetX = (boundTextCanvas.width - canvas!.width) / 2;
    const offsetY = (boundTextCanvas.height - canvas!.height) / 2;
    const shiftX =
      boundTextCanvas.width / 2 -
      (boundTextCx - x1) * window.devicePixelRatio * scale -
      offsetX -
      padding * scale;

    const shiftY =
      boundTextCanvas.height / 2 -
      (boundTextCy - y1) * window.devicePixelRatio * scale -
      offsetY -
      padding * scale;
    boundTextCanvasContext.translate(-shiftX, -shiftY);
    // Clear the bound text area
    boundTextCanvasContext.clearRect(
      -(boundTextElement.width / 2 + BOUND_TEXT_PADDING) *
        window.devicePixelRatio *
        scale,
      -(boundTextElement.height / 2 + BOUND_TEXT_PADDING) *
        window.devicePixelRatio *
        scale,
      (boundTextElement.width + BOUND_TEXT_PADDING * 2) *
        window.devicePixelRatio *
        scale,
      (boundTextElement.height + BOUND_TEXT_PADDING * 2) *
        window.devicePixelRatio *
        scale,
    );
  }

  return {
    element,
    canvas,
    theme: appState.theme,
    scale,
    zoomValue: zoom.value,
    canvasOffsetX,
    canvasOffsetY,
    boundTextElementVersion:
      getBoundTextElement(element, elementsMap)?.version || null,
    containingFrameOpacity:
      getContainingFrame(element, elementsMap)?.opacity || 100,
    boundTextCanvas,
    angle: element.angle,
    imageCrop: isImageElement(element) ? element.crop : null,
  };
};

export const DEFAULT_LINK_SIZE = 14;

const IMAGE_PLACEHOLDER_IMG =
  typeof document !== "undefined"
    ? document.createElement("img")
    : ({ src: "" } as HTMLImageElement); // mock image element outside of browser

IMAGE_PLACEHOLDER_IMG.src = `data:${MIME_TYPES.svg},${encodeURIComponent(
  `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="image" class="svg-inline--fa fa-image fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#888" d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48zM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56zM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48z"></path></svg>`,
)}`;

const IMAGE_ERROR_PLACEHOLDER_IMG =
  typeof document !== "undefined"
    ? document.createElement("img")
    : ({ src: "" } as HTMLImageElement); // mock image element outside of browser

IMAGE_ERROR_PLACEHOLDER_IMG.src = `data:${MIME_TYPES.svg},${encodeURIComponent(
  `<svg viewBox="0 0 668 668" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2"><path d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48ZM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56ZM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.81709 0 0 .81709 124.825 145.825)"/><path d="M256 8C119.034 8 8 119.033 8 256c0 136.967 111.034 248 248 248s248-111.034 248-248S392.967 8 256 8Zm130.108 117.892c65.448 65.448 70 165.481 20.677 235.637L150.47 105.216c70.204-49.356 170.226-44.735 235.638 20.676ZM125.892 386.108c-65.448-65.448-70-165.481-20.677-235.637L361.53 406.784c-70.203 49.356-170.226 44.736-235.638-20.676Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.30366 0 0 .30366 506.822 60.065)"/></svg>`,
)}`;

const drawImagePlaceholder = (
  element: ExcalidrawImageElement,
  context: CanvasRenderingContext2D,
  theme: StaticCanvasRenderConfig["theme"],
) => {
  context.fillStyle = theme === THEME.DARK ? "#2E2E2E" : "#E7E7E7";
  context.fillRect(0, 0, element.width, element.height);

  const imageMinWidthOrHeight = Math.min(element.width, element.height);

  const size = Math.min(
    imageMinWidthOrHeight,
    Math.min(imageMinWidthOrHeight * 0.4, 100),
  );

  context.drawImage(
    element.status === "error"
      ? IMAGE_ERROR_PLACEHOLDER_IMG
      : IMAGE_PLACEHOLDER_IMG,
    element.width / 2 - size / 2,
    element.height / 2 - size / 2,
    size,
    size,
  );
};

const DEFAULT_FREEDRAW_PRESSURE = 0.5;

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
    // Degenerate segment — draw a filled circle at the larger radius
    context.beginPath();
    context.arc((x0 + x1) / 2, (y0 + y1) / 2, r, 0, Math.PI * 2);
    context.fill();
    return;
  }

  const angle = Math.atan2(dy, dx);
  const px = -dy / len; // perpendicular unit x = -sin(angle)
  const py = dx / len; // perpendicular unit y =  cos(angle)

  context.beginPath();
  // Back semicircle at P0: clockwise from (P0 + perp*r0) through (back of P0) to (P0 - perp*r0)
  context.arc(x0, y0, r0, angle + Math.PI / 2, angle - Math.PI / 2, false);
  // Neg-perp side: P0 - perp*r0  →  P1 - perp*r1  (arc endpoint is already P0 - perp*r0)
  context.lineTo(x1 - px * r1, y1 - py * r1);
  // Front semicircle at P1: clockwise from (P1 - perp*r1) through (front of P1) to (P1 + perp*r1)
  context.arc(x1, y1, r1, angle - Math.PI / 2, angle + Math.PI / 2, false);
  // Perp side: P1 + perp*r1  →  P0 + perp*r0
  context.lineTo(x0 + px * r0, y0 + py * r0);
  context.closePath();
  context.fill();
};

/**
 * Target spacing (in scene units) between consecutive capsule sub-segments
 * produced by the Catmull-Rom bezier subdivision.  Smaller values give
 * smoother curves at the cost of more draw calls.
 */
const BEZIER_SUBDIVIDE_TARGET_SPACING = 3;

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
 * forward tangent is used.  At the last real point, `predictedPoint` (if
 * supplied) stands in for the missing next neighbour so the stroke tip curves
 * smoothly toward the predicted pen position.
 */
const getCatmullRomTangent = (
  points: readonly (readonly [number, number])[],
  i: number,
  predictedPoint: readonly [number, number] | undefined,
): [number, number] => {
  const N = points.length;
  const cur = points[i];

  // Determine the "next" point: real neighbour, predicted point, or mirrored.
  let next: readonly [number, number];
  if (i < N - 1) {
    next = points[i + 1];
  } else if (predictedPoint !== undefined) {
    next = predictedPoint;
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

/**
 * Draws one bezier-subdivided tapered segment from p0 (radius r0) to p1
 * (radius r1). t0/t1 are the Catmull-Rom tangents at p0 and p1 respectively.
 * The segment is sampled at BEZIER_SUBDIVIDE_TARGET_SPACING scene-unit
 * intervals and each sub-interval is drawn as a tapered capsule.
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
) => {
  const segLen = Math.sqrt((p1x - p0x) ** 2 + (p1y - p0y) ** 2);
  const nSubdiv = Math.max(
    1,
    Math.ceil(segLen / BEZIER_SUBDIVIDE_TARGET_SPACING),
  );

  // Cubic Bezier control points derived from Catmull-Rom tangents.
  const cp1x = p0x + t0x / 3;
  const cp1y = p0y + t0y / 3;
  const cp2x = p1x - t1x / 3;
  const cp2y = p1y - t1y / 3;

  let prevX = p0x;
  let prevY = p0y;
  let prevR = r0;

  for (let k = 1; k <= nSubdiv; k++) {
    const t = k / nSubdiv;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const mt3 = mt2 * mt;
    const t3 = t2 * t;
    const mt2t3 = 3 * mt2 * t;
    const mtt23 = 3 * mt * t2;

    const x = mt3 * p0x + mt2t3 * cp1x + mtt23 * cp2x + t3 * p1x;
    const y = mt3 * p0y + mt2t3 * cp1y + mtt23 * cp2y + t3 * p1y;
    const r = r0 + (r1 - r0) * t;

    drawTaperedCapsule(context, prevX, prevY, prevR, x, y, r);
    prevX = x;
    prevY = y;
    prevR = r;
  }
};

/**
 * Draws freedraw points as bezier-subdivided, pressure-aware tapered capsule
 * segments.  Consecutive real points are connected with Catmull-Rom cubic
 * bezier curves so the rendered stroke is smooth even when input samples are
 * sparse.  When `predictedPoint` is supplied it is used as the tangent hint at
 * the tip of the stroke and an additional ghost segment is drawn toward it,
 * compensating for pointer-event latency.
 *
 * @param fromIndex  Draw segments starting from this index (inclusive).
 *                   Pass 0 to draw everything.
 * @param predictedPoint  Element-local scene coords of the first predicted
 *                        pointer event, used for tangent and ghost rendering.
 */
const drawFreeDrawSegments = (
  element: ExcalidrawFreeDrawElement,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  fromIndex: number,
  predictedPoint?: readonly [number, number],
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

  if (fromIndex === 0 && N === 1) {
    // Single-point stroke → filled circle (dot)
    const r = baseRadius * getSmoothedPressure(0) * 2;
    context.beginPath();
    context.arc(points[0][0], points[0][1], r, 0, Math.PI * 2);
    context.fill();
    // Draw ghost circle at predicted point if available
    if (predictedPoint !== undefined) {
      context.beginPath();
      context.arc(predictedPoint[0], predictedPoint[1], r, 0, Math.PI * 2);
      context.fill();
    }
    return;
  }

  const start = Math.max(fromIndex, 1);
  for (let i = start; i < N; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    // Very first pressure values are often unreliable,
    // so for the first couple of segments use a radius
    const r0 = baseRadius * getSmoothedPressure(i - 1) * 2;
    const r1 = baseRadius * getSmoothedPressure(i) * 2;

    // Catmull-Rom tangents.  At the last real point, use predictedPoint as
    // the look-ahead so the tip curves smoothly toward the expected position.
    const isLastPoint = i === N - 1;
    const t0 = getCatmullRomTangent(points, i - 1, undefined);
    const t1 = getCatmullRomTangent(
      points,
      i,
      isLastPoint ? predictedPoint : undefined,
    );

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
    );
  }

  // Ghost segment: extend the visible stroke toward the predicted point to
  // compensate for pointer-event latency.  This segment is overwritten when
  // the next real pointer event arrives.
  if (predictedPoint !== undefined && N >= 1) {
    const lastPt = points[N - 1];
    const r0 = baseRadius * getSmoothedPressure(N - 1) * 2;

    // Tangent at the last real point (with predicted look-ahead)
    const t0 = getCatmullRomTangent(points, N - 1, predictedPoint);
    // Forward tangent at the predicted point itself
    const fwdX = predictedPoint[0] - lastPt[0];
    const fwdY = predictedPoint[1] - lastPt[1];

    drawSubdividedSegment(
      context,
      lastPt[0],
      lastPt[1],
      r0,
      predictedPoint[0],
      predictedPoint[1],
      r0, // hold pressure at the tip
      t0[0],
      t0[1],
      fwdX,
      fwdY,
    );
  }
};

const drawElementOnCanvas = (
  element: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
) => {
  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "diamond":
    case "ellipse": {
      context.lineJoin = "round";
      context.lineCap = "round";

      rc.draw(ShapeCache.generateElementShape(element, renderConfig));
      break;
    }
    case "arrow":
    case "line": {
      context.lineJoin = "round";
      context.lineCap = "round";

      ShapeCache.generateElementShape(element, renderConfig).forEach(
        (shape) => {
          rc.draw(shape);
        },
      );
      break;
    }
    case "freedraw": {
      context.save();
      drawFreeDrawSegments(element, context, renderConfig, 0);
      context.restore();
      break;
    }
    case "image": {
      context.save();
      const cacheEntry =
        element.fileId !== null
          ? renderConfig.imageCache.get(element.fileId)
          : null;
      const img = isInitializedImageElement(element)
        ? cacheEntry?.image
        : undefined;

      if (img != null && !(img instanceof Promise)) {
        if (element.roundness && context.roundRect) {
          context.beginPath();
          context.roundRect(
            0,
            0,
            element.width,
            element.height,
            getCornerRadius(Math.min(element.width, element.height), element),
          );
          context.clip();
        }

        const { x, y, width, height } = element.crop
          ? element.crop
          : {
              x: 0,
              y: 0,
              width: img.naturalWidth,
              height: img.naturalHeight,
            };

        const shouldInvertImage =
          renderConfig.theme === THEME.DARK &&
          cacheEntry?.mimeType === MIME_TYPES.svg;

        if (shouldInvertImage && isSafari) {
          const devicePixelRatio = window.devicePixelRatio || 1;
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = element.width * devicePixelRatio;
          tempCanvas.height = element.height * devicePixelRatio;
          const tempContext = tempCanvas.getContext("2d");

          if (tempContext) {
            tempContext.scale(devicePixelRatio, devicePixelRatio);
            tempContext.drawImage(
              img,
              x,
              y,
              width,
              height,
              0,
              0,
              element.width,
              element.height,
            );

            const imageData = tempContext.getImageData(
              0,
              0,
              tempCanvas.width,
              tempCanvas.height,
            );

            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i];
              data[i + 1] = 255 - data[i + 1];
              data[i + 2] = 255 - data[i + 2];
            }

            tempContext.putImageData(imageData, 0, 0);
            context.drawImage(
              tempCanvas,
              0,
              0,
              tempCanvas.width,
              tempCanvas.height,
              0,
              0,
              element.width,
              element.height,
            );
          }
        } else {
          if (shouldInvertImage) {
            context.filter = DARK_THEME_FILTER;
          }

          context.drawImage(
            img,
            x,
            y,
            width,
            height,
            0 /* hardcoded for the selection box*/,
            0,
            element.width,
            element.height,
          );
        }
      } else {
        drawImagePlaceholder(element, context, renderConfig.theme);
      }
      context.restore();
      break;
    }
    default: {
      if (isTextElement(element)) {
        const rtl = isRTL(element.text);
        const shouldTemporarilyAttach = rtl && !context.canvas.isConnected;
        if (shouldTemporarilyAttach) {
          // to correctly render RTL text mixed with LTR, we have to append it
          // to the DOM
          document.body.appendChild(context.canvas);
        }
        context.canvas.setAttribute("dir", rtl ? "rtl" : "ltr");
        context.save();
        context.font = getFontString(element);
        context.fillStyle = applyDarkModeFilter(
          element.strokeColor,
          renderConfig.theme === THEME.DARK,
        );
        context.textAlign = element.textAlign as CanvasTextAlign;

        // Canvas does not support multiline text by default
        const lines = element.text.replace(/\r\n?/g, "\n").split("\n");

        const horizontalOffset =
          element.textAlign === "center"
            ? element.width / 2
            : element.textAlign === "right"
            ? element.width
            : 0;

        const lineHeightPx = getLineHeightInPx(
          element.fontSize,
          element.lineHeight,
        );

        const verticalOffset = getVerticalOffset(
          element.fontFamily,
          element.fontSize,
          lineHeightPx,
        );

        for (let index = 0; index < lines.length; index++) {
          context.fillText(
            lines[index],
            horizontalOffset,
            index * lineHeightPx + verticalOffset,
          );
        }
        context.restore();
        if (shouldTemporarilyAttach) {
          context.canvas.remove();
        }
      } else {
        throw new Error(`Unimplemented type ${element.type}`);
      }
    }
  }
};

export const elementWithCanvasCache = new WeakMap<
  ExcalidrawElement,
  ExcalidrawElementWithCanvas
>();

// ─── Incremental freedraw canvas cache ───────────────────────────────────────
// A separate WeakMap that survives ShapeCache.delete() calls so that the raster
// accumulates new capsule segments without full regeneration on every added
// point.

// screen pixels — minimum extra lookahead space on each side
// (divided by scale at use)
const FREEDRAW_CANVAS_OVERSHOOT_MIN = 200;

// allocate current_dimension * factor extra on each side
const FREEDRAW_CANVAS_OVERSHOOT_FACTOR = 0.5;

interface FreeDrawIncrementalCanvas {
  canvas: HTMLCanvasElement;
  lastRenderedPointCount: number;
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

/**
 * Generates or incrementally updates a raster canvas for a freedraw element
 * that is being actively drawn. Unlike the standard element canvas cache, this
 * cache is NOT cleared on each mutateElement call, allowing new segments to be
 * appended without full regeneration.
 *
 * When element bounds grow beyond the over-allocated canvas, the existing
 * raster  is copied into a new larger canvas before appending the next segments
 */
const generateOrUpdateFreeDrawIncrementalCanvas = (
  element: ExcalidrawFreeDrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  zoom: Zoom,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
): ExcalidrawElementWithCanvas | null => {
  const scale = zoom.value;
  const dpr = window.devicePixelRatio;
  const padding = getCanvasPadding(element);
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const containingFrameOpacity =
    getContainingFrame(element, elementsMap)?.opacity || 100;

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

  let canvas: HTMLCanvasElement;
  let canvasOriginSceneX: number;
  let canvasOriginSceneY: number;
  let fromIndex: number;
  let canvasScale: number;

  if (needsAlloc) {
    // Over-allocate proportionally to the current bounding box, like std::vector doubling,
    // so fast large strokes trigger far fewer reallocations. The over-sized canvas is
    // discarded on stroke finalisation so the memory waste is only transient.
    const overshootX = Math.max(
      FREEDRAW_CANVAS_OVERSHOOT_MIN / scale, // convert screen-pixel budget to scene units
      (x2 - x1) * FREEDRAW_CANVAS_OVERSHOOT_FACTOR,
    );
    const overshootY = Math.max(
      FREEDRAW_CANVAS_OVERSHOOT_MIN / scale, // convert screen-pixel budget to scene units
      (y2 - y1) * FREEDRAW_CANVAS_OVERSHOOT_FACTOR,
    );
    const allocX1 = x1 - overshootX;
    const allocY1 = y1 - overshootY;
    const allocX2 = x2 + overshootX;
    const allocY2 = y2 + overshootY;

    canvasOriginSceneX = allocX1 - padding / dpr;
    canvasOriginSceneY = allocY1 - padding / dpr;

    // Raw canvas pixels before zoom scale
    const rawW = (allocX2 - allocX1) * dpr + padding * 2;
    const rawH = (allocY2 - allocY1) * dpr + padding * 2;

    // Respect browser canvas size limits
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

    canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext("2d")!;

    if (
      prevInc !== undefined &&
      boundsExceeded &&
      prevInc.scale === canvasScale &&
      prevInc.theme === appState.theme
    ) {
      // Copy existing raster to the new canvas at the correct pixel offset.
      // The shift is determined by how much the canvas origin moved in scene coords.
      const copyX =
        (prevInc.canvasOriginSceneX - canvasOriginSceneX) * dpr * canvasScale;
      const copyY =
        (prevInc.canvasOriginSceneY - canvasOriginSceneY) * dpr * canvasScale;
      context.drawImage(prevInc.canvas, copyX, copyY);
      fromIndex = prevInc.lastRenderedPointCount;
    } else {
      // Full regeneration on first canvas, zoom change, or theme change
      fromIndex = 0;
    }

    freedrawIncrementalCache.set(element, {
      canvas,
      lastRenderedPointCount: fromIndex,
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
    canvas = prevInc.canvas;
    canvasOriginSceneX = prevInc.canvasOriginSceneX;
    canvasOriginSceneY = prevInc.canvasOriginSceneY;
    fromIndex = prevInc.lastRenderedPointCount;
    canvasScale = prevInc.scale;
  }

  // Roll back 2 points so the Catmull-Rom look-ahead tangent at the last
  // committed segment is redrawn correctly when a new point arrives.
  // Pressure smoothing is causal (one-sided) so it requires no extra rollback.
  // Overpainting with an opaque fill is harmless.
  const drawFrom = Math.max(0, fromIndex - 2);

  // Draw new (and possibly revised) segments plus the ghost toward the
  // predicted point.
  if (drawFrom < element.points.length) {
    const ctx = canvas.getContext("2d")!;
    const canvasElemOffsetX =
      (element.x - canvasOriginSceneX) * dpr * canvasScale;
    const canvasElemOffsetY =
      (element.y - canvasOriginSceneY) * dpr * canvasScale;
    ctx.save();
    ctx.translate(canvasElemOffsetX, canvasElemOffsetY);
    ctx.scale(dpr * canvasScale, dpr * canvasScale);
    drawFreeDrawSegments(
      element,
      ctx,
      renderConfig,
      drawFrom,
      element.points[element.points.length - 1],
      //predictedPoint,
    );
    ctx.restore();

    // Update lastRenderedPointCount in the cache entry.
    const inc = freedrawIncrementalCache.get(element)!;
    inc.lastRenderedPointCount = element.points.length;
  }

  const inc = freedrawIncrementalCache.get(element)!;
  return {
    element,
    canvas,
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

const generateElementWithCanvas = (
  element: NonDeletedExcalidrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
) => {
  const zoom: Zoom = renderConfig
    ? appState.zoom
    : {
        value: 1 as NormalizedZoomValue,
      };

  // Incremental rendering path for freedraw elements being actively drawn.
  // ShapeCache.delete() clears elementWithCanvasCache on every added point, so
  // we bypass that cache entirely and use freedrawIncrementalCache instead.
  if (
    isFreeDrawElement(element) &&
    "newElement" in appState &&
    appState.newElement?.id === element.id
  ) {
    return generateOrUpdateFreeDrawIncrementalCanvas(
      element as ExcalidrawFreeDrawElement,
      elementsMap,
      zoom,
      renderConfig,
      appState,
    );
  }

  const prevElementWithCanvas = elementWithCanvasCache.get(element);
  const shouldRegenerateBecauseZoom =
    prevElementWithCanvas &&
    prevElementWithCanvas.zoomValue !== zoom.value &&
    !appState?.shouldCacheIgnoreZoom;
  const boundTextElement = getBoundTextElement(element, elementsMap);
  const boundTextElementVersion = boundTextElement?.version || null;
  const imageCrop = isImageElement(element) ? element.crop : null;

  const containingFrameOpacity =
    getContainingFrame(element, elementsMap)?.opacity || 100;

  if (
    !prevElementWithCanvas ||
    shouldRegenerateBecauseZoom ||
    prevElementWithCanvas.theme !== appState.theme ||
    prevElementWithCanvas.boundTextElementVersion !== boundTextElementVersion ||
    prevElementWithCanvas.imageCrop !== imageCrop ||
    prevElementWithCanvas.containingFrameOpacity !== containingFrameOpacity ||
    // since we rotate the canvas when copying from cached canvas, we don't
    // regenerate the cached canvas. But we need to in case of labels which are
    // cached alongside the arrow, and we want the labels to remain unrotated
    // with respect to the arrow.
    (isArrowElement(element) &&
      boundTextElement &&
      element.angle !== prevElementWithCanvas.angle)
  ) {
    const elementWithCanvas = generateElementCanvas(
      element,
      elementsMap,
      zoom,
      renderConfig,
      appState,
    );

    if (!elementWithCanvas) {
      return null;
    }

    elementWithCanvasCache.set(element, elementWithCanvas);

    return elementWithCanvas;
  }
  return prevElementWithCanvas;
};

const drawElementFromCanvas = (
  elementWithCanvas: ExcalidrawElementWithCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
  allElementsMap: NonDeletedSceneElementsMap,
) => {
  const element = elementWithCanvas.element;
  const padding = getCanvasPadding(element);
  const zoom = elementWithCanvas.scale;
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, allElementsMap);
  const cx = ((x1 + x2) / 2 + appState.scrollX) * window.devicePixelRatio;
  const cy = ((y1 + y2) / 2 + appState.scrollY) * window.devicePixelRatio;

  context.save();
  context.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);

  const boundTextElement = getBoundTextElement(element, allElementsMap);

  if (isArrowElement(element) && boundTextElement) {
    const offsetX =
      (elementWithCanvas.boundTextCanvas.width -
        elementWithCanvas.canvas!.width) /
      2;
    const offsetY =
      (elementWithCanvas.boundTextCanvas.height -
        elementWithCanvas.canvas!.height) /
      2;
    context.translate(cx, cy);
    context.drawImage(
      elementWithCanvas.boundTextCanvas,
      (-(x2 - x1) / 2) * window.devicePixelRatio - offsetX / zoom - padding,
      (-(y2 - y1) / 2) * window.devicePixelRatio - offsetY / zoom - padding,
      elementWithCanvas.boundTextCanvas.width / zoom,
      elementWithCanvas.boundTextCanvas.height / zoom,
    );
  } else {
    // we translate context to element center so that rotation and scale
    // originates from the element center
    context.translate(cx, cy);

    context.rotate(element.angle);

    if (
      "scale" in elementWithCanvas.element &&
      !isPendingImageElement(element, renderConfig)
    ) {
      context.scale(
        elementWithCanvas.element.scale[0],
        elementWithCanvas.element.scale[1],
      );
    }

    // revert afterwards we don't have account for it during drawing
    context.translate(-cx, -cy);

    // For the incremental freedraw path, the canvas origin is stored explicitly
    // because the canvas is over-allocated beyond the tight element bounds.
    const destX =
      elementWithCanvas.canvasOriginSceneX !== undefined
        ? (elementWithCanvas.canvasOriginSceneX + appState.scrollX) *
          window.devicePixelRatio
        : (x1 + appState.scrollX) * window.devicePixelRatio - padding;
    const destY =
      elementWithCanvas.canvasOriginSceneY !== undefined
        ? (elementWithCanvas.canvasOriginSceneY + appState.scrollY) *
          window.devicePixelRatio
        : (y1 + appState.scrollY) * window.devicePixelRatio - padding;
    context.drawImage(
      elementWithCanvas.canvas!,
      destX,
      destY,
      elementWithCanvas.canvas!.width / elementWithCanvas.scale,
      elementWithCanvas.canvas!.height / elementWithCanvas.scale,
    );

    if (
      import.meta.env.VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX ===
        "true" &&
      hasBoundTextElement(element)
    ) {
      const textElement = getBoundTextElement(
        element,
        allElementsMap,
      ) as ExcalidrawTextElementWithContainer;
      const coords = getContainerCoords(element);
      context.strokeStyle = "#c92a2a";
      context.lineWidth = 3;
      context.strokeRect(
        (coords.x + appState.scrollX) * window.devicePixelRatio,
        (coords.y + appState.scrollY) * window.devicePixelRatio,
        getBoundTextMaxWidth(element, textElement) * window.devicePixelRatio,
        getBoundTextMaxHeight(element, textElement) * window.devicePixelRatio,
      );
    }
  }
  context.restore();

  // Clear the nested element we appended to the DOM
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

export const renderSelectionElement = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  selectionColor: InteractiveCanvasRenderConfig["selectionColor"],
) => {
  context.save();
  context.translate(element.x + appState.scrollX, element.y + appState.scrollY);
  context.fillStyle = "rgba(0, 0, 200, 0.04)";

  // render from 0.5px offset  to get 1px wide line
  // https://stackoverflow.com/questions/7530593/html5-canvas-and-line-width/7531540#7531540
  // TODO can be be improved by offseting to the negative when user selects
  // from right to left
  const offset = 0.5 / appState.zoom.value;

  context.fillRect(offset, offset, element.width, element.height);
  context.lineWidth = 1 / appState.zoom.value;
  context.strokeStyle = selectionColor;
  context.strokeRect(offset, offset, element.width, element.height);

  context.restore();
};

export const renderElement = (
  element: NonDeletedExcalidrawElement,
  elementsMap: RenderableElementsMap,
  allElementsMap: NonDeletedSceneElementsMap,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
) => {
  const reduceAlphaForSelection =
    appState.openDialog?.name === "elementLinkSelector" &&
    !appState.selectedElementIds[element.id] &&
    !appState.hoveredElementIds[element.id];

  context.globalAlpha = getRenderOpacity(
    element,
    getContainingFrame(element, elementsMap),
    renderConfig.elementsPendingErasure,
    renderConfig.pendingFlowchartNodes,
    reduceAlphaForSelection ? DEFAULT_REDUCED_GLOBAL_ALPHA : 1,
  );

  switch (element.type) {
    case "magicframe":
    case "frame": {
      if (appState.frameRendering.enabled && appState.frameRendering.outline) {
        context.save();
        context.translate(
          element.x + appState.scrollX,
          element.y + appState.scrollY,
        );
        context.fillStyle = "rgba(0, 0, 200, 0.04)";

        context.lineWidth = FRAME_STYLE.strokeWidth / appState.zoom.value;
        context.strokeStyle = applyDarkModeFilter(
          FRAME_STYLE.strokeColor,
          appState.theme === THEME.DARK,
        );

        // TODO change later to only affect AI frames
        if (isMagicFrameElement(element)) {
          context.strokeStyle =
            appState.theme === THEME.LIGHT
              ? "#7affd7"
              : applyDarkModeFilter("#1d8264");
        }

        if (FRAME_STYLE.radius && context.roundRect) {
          context.beginPath();
          context.roundRect(
            0,
            0,
            element.width,
            element.height,
            FRAME_STYLE.radius / appState.zoom.value,
          );
          context.stroke();
          context.closePath();
        } else {
          context.strokeRect(0, 0, element.width, element.height);
        }

        context.restore();
      }
      break;
    }
    case "freedraw": {
      if (renderConfig.isExporting) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
        const cx = (x1 + x2) / 2 + appState.scrollX;
        const cy = (y1 + y2) / 2 + appState.scrollY;
        const shiftX = (x2 - x1) / 2 - (element.x - x1);
        const shiftY = (y2 - y1) / 2 - (element.y - y1);
        context.save();
        context.translate(cx, cy);
        context.rotate(element.angle);
        context.translate(-shiftX, -shiftY);
        drawElementOnCanvas(element, rc, context, renderConfig);
        context.restore();
      } else {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          allElementsMap,
          renderConfig,
          appState,
        );
        if (!elementWithCanvas) {
          return;
        }

        const currentImageSmoothingStatus = context.imageSmoothingEnabled;
        if (
          !appState?.shouldCacheIgnoreZoom &&
          (!element.angle || isRightAngleRads(element.angle))
        ) {
          context.imageSmoothingEnabled = false;
        }

        drawElementFromCanvas(
          elementWithCanvas,
          context,
          renderConfig,
          appState,
          allElementsMap,
        );

        context.imageSmoothingEnabled = currentImageSmoothingStatus;
      }

      break;
    }
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "line":
    case "arrow":
    case "image":
    case "text":
    case "iframe":
    case "embeddable": {
      if (renderConfig.isExporting) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const cx = centerX + appState.scrollX;
        const cy = centerY + appState.scrollY;
        let shiftX = (x2 - x1) / 2 - (element.x - x1);
        let shiftY = (y2 - y1) / 2 - (element.y - y1);
        if (isTextElement(element)) {
          const container = getContainerElement(element, elementsMap);
          if (isArrowElement(container)) {
            const boundTextCoords =
              LinearElementEditor.getBoundTextElementPosition(
                container,
                element as ExcalidrawTextElementWithContainer,
                elementsMap,
              );
            shiftX = (x2 - x1) / 2 - (boundTextCoords.x - x1);
            shiftY = (y2 - y1) / 2 - (boundTextCoords.y - y1);
          }
        }
        context.save();
        context.translate(cx, cy);

        const boundTextElement = getBoundTextElement(element, elementsMap);

        if (isArrowElement(element) && boundTextElement) {
          // Draw arrow directly as vector and clear label hole separately.
          // This avoids temp-canvas bitmap blit which introduces resampling blur.
          shiftX = element.width / 2 - (element.x - x1);
          shiftY = element.height / 2 - (element.y - y1);

          context.save();
          context.rotate(element.angle);
          context.translate(-shiftX, -shiftY);
          drawElementOnCanvas(element, rc, context, renderConfig);
          context.restore();

          const [, , , , boundTextCx, boundTextCy] = getElementAbsoluteCoords(
            boundTextElement,
            elementsMap,
          );
          const holeX =
            boundTextCx -
            centerX -
            boundTextElement.width / 2 -
            BOUND_TEXT_PADDING;
          const holeY =
            boundTextCy -
            centerY -
            boundTextElement.height / 2 -
            BOUND_TEXT_PADDING;
          const holeWidth = boundTextElement.width + BOUND_TEXT_PADDING * 2;
          const holeHeight = boundTextElement.height + BOUND_TEXT_PADDING * 2;

          const isTransparentHole =
            "viewBackgroundColor" in appState &&
            (appState.viewBackgroundColor === "transparent" ||
              !appState.viewBackgroundColor);
          if (!isTransparentHole) {
            context.save();
            context.fillStyle = applyDarkModeFilter(
              renderConfig.canvasBackgroundColor,
              renderConfig.theme === THEME.DARK,
            );
            context.fillRect(holeX, holeY, holeWidth, holeHeight);
            context.restore();
          } else {
            context.clearRect(holeX, holeY, holeWidth, holeHeight);
          }
        } else {
          context.rotate(element.angle);

          if (element.type === "image") {
            // note: scale must be applied *after* rotating
            context.scale(element.scale[0], element.scale[1]);
          }

          context.translate(-shiftX, -shiftY);
          drawElementOnCanvas(element, rc, context, renderConfig);
        }

        context.restore();
        // not exporting → optimized rendering (cache & render from element
        // canvases)
      } else {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          allElementsMap,
          renderConfig,
          appState,
        );

        if (!elementWithCanvas) {
          return;
        }

        const currentImageSmoothingStatus = context.imageSmoothingEnabled;

        if (
          // do not disable smoothing during zoom as blurry shapes look better
          // on low resolution (while still zooming in) than sharp ones
          !appState?.shouldCacheIgnoreZoom &&
          // angle is 0 -> always disable smoothing
          (!element.angle ||
            // or check if angle is a right angle in which case we can still
            // disable smoothing without adversely affecting the result
            // We need less-than comparison because of FP artihmetic
            isRightAngleRads(element.angle))
        ) {
          // Disabling smoothing makes output much sharper, especially for
          // text. Unless for non-right angles, where the aliasing is really
          // terrible on Chromium.
          //
          // Note that `context.imageSmoothingQuality="high"` has almost
          // zero effect.
          //
          context.imageSmoothingEnabled = false;
        }

        if (
          element.id === appState.croppingElementId &&
          isImageElement(elementWithCanvas.element) &&
          elementWithCanvas.element.crop !== null
        ) {
          context.save();
          context.globalAlpha = 0.1;

          const uncroppedElementCanvas = generateElementCanvas(
            getUncroppedImageElement(elementWithCanvas.element, elementsMap),
            allElementsMap,
            appState.zoom,
            renderConfig,
            appState,
          );

          if (uncroppedElementCanvas) {
            drawElementFromCanvas(
              uncroppedElementCanvas,
              context,
              renderConfig,
              appState,
              allElementsMap,
            );
          }

          context.restore();
        }

        drawElementFromCanvas(
          elementWithCanvas,
          context,
          renderConfig,
          appState,
          allElementsMap,
        );

        // reset
        context.imageSmoothingEnabled = currentImageSmoothingStatus;
      }
      break;
    }
    default: {
      // @ts-ignore
      throw new Error(`Unimplemented type ${element.type}`);
    }
  }

  context.globalAlpha = 1;
};

export function getFreedrawOutlineAsSegments(
  element: ExcalidrawFreeDrawElement,
  points: [number, number][],
  elementsMap: ElementsMap,
) {
  const bounds = getElementBounds(
    {
      ...element,
      angle: 0 as Radians,
    },
    elementsMap,
  );
  const center = pointFrom<GlobalPoint>(
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
  );

  invariant(points.length >= 2, "Freepath outline must have at least 2 points");

  return points.slice(2).reduce(
    (acc, curr) => {
      acc.push(
        lineSegment<GlobalPoint>(
          acc[acc.length - 1][1],
          pointRotateRads(
            pointFrom<GlobalPoint>(curr[0] + element.x, curr[1] + element.y),
            center,
            element.angle,
          ),
        ),
      );
      return acc;
    },
    [
      lineSegment<GlobalPoint>(
        pointRotateRads(
          pointFrom<GlobalPoint>(
            points[0][0] + element.x,
            points[0][1] + element.y,
          ),
          center,
          element.angle,
        ),
        pointRotateRads(
          pointFrom<GlobalPoint>(
            points[1][0] + element.x,
            points[1][1] + element.y,
          ),
          center,
          element.angle,
        ),
      ),
    ],
  );
}
