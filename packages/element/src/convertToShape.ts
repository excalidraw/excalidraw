import { getElementAbsoluteCoords } from "@excalidraw/element/bounds";
import {
  newArrowElement,
  newElement,
  newLinearElement,
} from "@excalidraw/element/newElement";
import { getElementBoundsFromPoints, ROUNDNESS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { LocalPoint, GlobalPoint, Radians } from "@excalidraw/math";
import type { Bounds } from "@excalidraw/common";
import type {
  ExcalidrawArrowElement,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
  ElementsMap,
} from "@excalidraw/element/types";

import { getFrameLikeElements } from "./frame";
import { isUsingAdaptiveRadius } from "./typeChecks";
import { LinearElementEditor } from "./linearElementEditor";

// A simplified Protractor recognizer (Yang Li, 2010) customized forour specific
// shape set and use case.
//
// NOTE: We skip Golden Section Search and instead zero-out orientation by rotating
// each stroke to its indicative angle before matching, which is sufficient
// when no rotation invariance is required.

type Shape =
  | ExcalidrawRectangleElement["type"]
  | ExcalidrawEllipseElement["type"]
  | ExcalidrawDiamondElement["type"]
  | ExcalidrawArrowElement["type"]
  | ExcalidrawLinearElement["type"]
  | ExcalidrawFreeDrawElement["type"];

interface Template {
  type: Shape;
  vec: Vec;
  // Whether this template was vectorised with rotation normalisation.
  rotationInvariant: boolean;
}

interface ShapeRecognitionResult<P extends LocalPoint | GlobalPoint> {
  // The type of the recognized shape, or "freedraw" if no good match was found
  type: Shape;

  // The original input points (not simplified)
  points: readonly P[];

  // Bounding box of the original input points, used for positioning the
  // converted shape
  boundingBox: Bounds;
}

// Number of resampled points used for every template and candidate.
const PROTRACTOR_N = 64;

// Side length of the reference square used for scaling.
const PROTRACTOR_SQUARE_SIZE = 250;

// Minimum score (0–1) required to commit to a shape; below that we assume
// freedraw.
const PROTRACTOR_SCORE_THRESHOLD = 0.75;

type Vec = Float64Array; // interleaved [x0, y0, x1, y1, …] of length 2*N

// =============================================================================
// Protractor recognizer helpers
// =============================================================================

// Resample `pts` to exactly `n` evenly-spaced points along the stroke path.
function resample<P extends LocalPoint | GlobalPoint>(
  pts: readonly P[],
  n: number,
): P[] {
  let totalLen = 0;
  for (let i = 1; i < pts.length; i++) {
    totalLen += Math.hypot(
      pts[i][0] - pts[i - 1][0],
      pts[i][1] - pts[i - 1][1],
    );
  }

  const interval = totalLen / (n - 1);
  let accumulated = 0;
  const result: P[] = [pts[0]];
  let prev = pts[0];

  for (let i = 1; i < pts.length; i++) {
    const curr = pts[i];
    const segLen = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
    if (accumulated + segLen >= interval) {
      // Insert interpolated points within this segment
      let remaining = interval - accumulated;
      while (remaining <= segLen + 1e-10) {
        const t = remaining / segLen;
        const newPt: P = [
          prev[0] + t * (curr[0] - prev[0]),
          prev[1] + t * (curr[1] - prev[1]),
        ] as P;
        result.push(newPt);
        if (result.length === n) {
          return result;
        }
        prev = newPt;
        accumulated = 0;
        remaining += interval;
      }
      accumulated = segLen - (remaining - interval);
    } else {
      accumulated += segLen;
    }
    prev = curr;
  }

  // Fill any remaining slots with the last point (rounding errors)
  while (result.length < n) {
    result.push(pts[pts.length - 1]);
  }
  return result;
}

// Translate points so their centroid is at the origin.
function translateToOrigin<P extends LocalPoint | GlobalPoint>(pts: P[]): P[] {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p[0];
    cy += p[1];
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.map(([x, y]) => [x - cx, y - cy] as P);
}

// Scale points to fit inside a square of `size` centred at origin.
function scaleTo<P extends LocalPoint | GlobalPoint>(
  pts: P[],
  size: number,
): P[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) {
      minX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y > maxY) {
      maxY = y;
    }
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const scale = size / Math.max(w, h);
  return pts.map(([x, y]) => [x * scale, y * scale] as P);
}

// Rotate points by `angle` radians around the origin.
// Used to zero-out the indicative angle of each stroke.
function rotateBy<P extends LocalPoint | GlobalPoint>(
  pts: P[],
  angle: number,
): P[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return pts.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos] as P);
}

// Vectorise a point sequence: translate to origin, scale, optionally rotate to
// indicative angle = 0, then flatten to an interleaved Float64Array
// normalised to unit length (required by the Protractor distance formula).
//
// rotationInvariant: True zeros out the indicative angle so the match is
// independent of drawing start position (needed for ellipses). False preserves
// absolute orientation so that rotationally distinct shapes (rectangle vs.
// diamond) remain distinguishable.
function vectorise<P extends LocalPoint | GlobalPoint>(
  pts: P[],
  rotationInvariant = false,
): Vec {
  let processed = translateToOrigin(pts);
  processed = scaleTo(processed, PROTRACTOR_SQUARE_SIZE);

  if (rotationInvariant) {
    // Indicative angle: angle from centroid (already at origin) to first point
    const indicativeAngle = Math.atan2(processed[0][1], processed[0][0]);
    processed = rotateBy(processed, -indicativeAngle);
  }

  const v = new Float64Array(processed.length * 2);
  let sum = 0;
  for (let i = 0; i < processed.length; i++) {
    v[2 * i] = processed[i][0];
    v[2 * i + 1] = processed[i][1];
    sum += processed[i][0] ** 2 + processed[i][1] ** 2;
  }
  const mag = Math.sqrt(sum);
  for (let i = 0; i < v.length; i++) {
    v[i] /= mag;
  }
  return v;
}

// Discrete Fréchet distance between two parameterized curves.
//
// This is curve-aware (not just point-to-point), so it penalizes structural
// mismatches like direction reversal in the arrow template vs a monotonic line.
//
// Returns a raw distance in [0, 2*sqrt(2)] for unit-magnitude vectors.
function frechetDistance(v1: Vec, v2: Vec): number {
  const n = v1.length / 2;
  const INF = Infinity;

  // F[i][j] = min Fréchet distance aligning v1[0..i] with v2[0..j]
  const F: number[][] = Array.from({ length: n }, () => new Array(n).fill(INF));

  // Base case
  F[0][0] = Math.hypot(v1[0] - v2[0], v1[1] - v2[1]);

  // First column: v1[0..i] aligned with v2[0]
  for (let i = 1; i < n; i++) {
    const ptDist = Math.hypot(v1[2 * i] - v2[0], v1[2 * i + 1] - v2[1]);
    F[i][0] = Math.max(F[i - 1][0], ptDist);
  }

  // First row: v1[0] aligned with v2[0..j]
  for (let j = 1; j < n; j++) {
    const ptDist = Math.hypot(v1[0] - v2[2 * j], v1[1] - v2[2 * j + 1]);
    F[0][j] = Math.max(F[0][j - 1], ptDist);
  }

  // Fill the DP table
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < n; j++) {
      const ptDist = Math.hypot(
        v1[2 * i] - v2[2 * j],
        v1[2 * i + 1] - v2[2 * j + 1],
      );
      F[i][j] = Math.max(
        Math.min(F[i - 1][j], F[i][j - 1], F[i - 1][j - 1]),
        ptDist,
      );
    }
  }

  return F[n - 1][n - 1];
}

// Convert a Fréchet distance to a similarity score in [0, 1].
//
// For unit-magnitude vectors, the maximum point-to-point distance is 2,
// so the maximum Fréchet distance is also bounded by 2.
function frechetScore(distance: number): number {
  return Math.max(0, 1 - distance / 2);
}

// =============================================================================
// Template — canonical point sequences for each shape
// =============================================================================

// Build a template for a rectangle drawn clockwise.
//
// startCorner selects which corner (0=TL, 1=TR, 2=BR, 3=BL) the stroke begins
// from.
//
// aspectRatio is width/height (>1 = wide, <1 = tall, 1 = square).Points
// are distributed proportionally to side length to match the arc-length uniform
// resampling of a real user stroke.
function makeRectangleTemplate(
  startCorner: number = 0,
  aspectRatio: number = 1,
): LocalPoint[] {
  const s = PROTRACTOR_SQUARE_SIZE / 2;
  // Scale axes to produce the target aspect ratio while keeping the longer
  // axis at s so scaleTo() in vectorise() normalises to a consistent size.
  const w = aspectRatio >= 1 ? s * aspectRatio : s;
  const h = aspectRatio >= 1 ? s : s / aspectRatio;
  const allCorners: LocalPoint[] = [
    pointFrom<LocalPoint>(-w, -h),
    pointFrom<LocalPoint>(w, -h),
    pointFrom<LocalPoint>(w, h),
    pointFrom<LocalPoint>(-w, h),
  ];
  const corners: LocalPoint[] = [
    ...allCorners.slice(startCorner),
    ...allCorners.slice(0, startCorner),
  ];
  // Compute side lengths for proportional point distribution.
  // resample() spaces points by arc length, so the template must mirror that
  // distribution — long sides get more points than short sides.
  const sideLengths = corners.map((c, i) => {
    const next = corners[(i + 1) % 4];
    return Math.hypot(next[0] - c[0], next[1] - c[1]);
  });
  const perimeter = sideLengths.reduce((a, b) => a + b, 0);
  const pts: LocalPoint[] = [];
  for (let side = 0; side < 4; side++) {
    const from = corners[side];
    const to = corners[(side + 1) % 4];
    const pointsForSide = Math.round(
      (sideLengths[side] / perimeter) * PROTRACTOR_N,
    );
    for (let k = 0; k < pointsForSide; k++) {
      const t = k / pointsForSide;
      pts.push([
        from[0] + t * (to[0] - from[0]),
        from[1] + t * (to[1] - from[1]),
      ] as LocalPoint);
    }
  }
  while (pts.length < PROTRACTOR_N) {
    pts.push(corners[0]);
  }
  return pts.slice(0, PROTRACTOR_N);
}

// Build a template for a diamond drawn clockwise.
//
// startCorner selects which vertex (0=Top, 1=Right, 2=Bottom, 3=Left) the
// stroke begins from.
//
// aspectRatio is width/height of the bounding box (>1 = wide, <1 = tall,
// 1 = square). All four sides of a diamond are always equal in length so equal
// point distribution per side is already arc-length proportional.
function makeDiamondTemplate(
  startCorner: number = 0,
  aspectRatio: number = 1,
): LocalPoint[] {
  const s = PROTRACTOR_SQUARE_SIZE / 2;
  const hw = aspectRatio >= 1 ? s * aspectRatio : s; // half-width
  const hh = aspectRatio >= 1 ? s : s / aspectRatio; // half-height
  const allCorners: LocalPoint[] = [
    pointFrom<LocalPoint>(0, -hh),
    pointFrom<LocalPoint>(hw, 0),
    pointFrom<LocalPoint>(0, hh),
    pointFrom<LocalPoint>(-hw, 0),
  ];
  const corners: LocalPoint[] = [
    ...allCorners.slice(startCorner),
    ...allCorners.slice(0, startCorner),
  ];
  const pts: LocalPoint[] = [];
  const perSide = Math.floor(PROTRACTOR_N / 4);
  for (let side = 0; side < 4; side++) {
    const from = corners[side];
    const to = corners[(side + 1) % 4];
    for (let k = 0; k < perSide; k++) {
      const t = k / perSide;
      pts.push([
        from[0] + t * (to[0] - from[0]),
        from[1] + t * (to[1] - from[1]),
      ] as LocalPoint);
    }
  }
  while (pts.length < PROTRACTOR_N) {
    pts.push(corners[0]);
  }
  return pts;
}

//  Build a template for an ellipse (circle) sampled uniformly.
//
//  startAngle shifts the starting position so multiple templates can cover
//  all common drawing start positions without needing rotation normalisation.
function makeEllipseTemplate(startAngle: number = 0): LocalPoint[] {
  const r = PROTRACTOR_SQUARE_SIZE / 2;
  return Array.from({ length: PROTRACTOR_N }, (_, i) => {
    const angle = startAngle + (2 * Math.PI * i) / PROTRACTOR_N;
    return [r * Math.cos(angle), r * Math.sin(angle)] as LocalPoint;
  });
}

// Build a template for a straight line at the given angle (radians).
function makeLineTemplate(angle: number = 0): LocalPoint[] {
  const s = PROTRACTOR_SQUARE_SIZE / 2;
  const basePts: LocalPoint[] = [];
  for (let i = 0; i < PROTRACTOR_N; i++) {
    const t = i / (PROTRACTOR_N - 1);
    basePts.push([-s + t * PROTRACTOR_SQUARE_SIZE, 0] as LocalPoint);
  }
  if (angle === 0) {
    return basePts;
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return basePts.map(([x, y]) => {
    return [x * cos - y * sin, x * sin + y * cos] as LocalPoint;
  });
}

// Build a template for an arrow: a shaft from left to right, then a V-shaped
// arrowhead pointing right. Drawn as a single continuous stroke: left -> right,
// back-left-up, right-tip, back-left-down.
function makeArrowTemplate(): LocalPoint[] {
  const s = PROTRACTOR_SQUARE_SIZE / 2;
  const tipX = s;
  const headLen = s * 0.35;
  const headAngle = Math.PI / 6; // 30°

  // Shaft: from (-s, 0) to (s, 0)
  const shaftPts = Math.floor(PROTRACTOR_N * 0.5);
  // Arrowhead: tip to upper base to back to tip to lower base
  const headPts = PROTRACTOR_N - shaftPts;
  const perHead = Math.floor(headPts / 2);

  const pts: LocalPoint[] = [];
  for (let i = 0; i < shaftPts; i++) {
    const t = i / (shaftPts - 1);
    pts.push([-s + t * (tipX - -s), 0] as LocalPoint);
  }

  // Upper arm: tip to upper-left
  const ux = tipX - headLen * Math.cos(headAngle);
  const uy = -headLen * Math.sin(headAngle);
  for (let i = 0; i < perHead; i++) {
    const t = i / (perHead - 1);
    pts.push([tipX + t * (ux - tipX), t * uy] as LocalPoint);
  }

  // Lower arm: tip to lower-left (back to tip first)
  const lx = tipX - headLen * Math.cos(headAngle);
  const ly = headLen * Math.sin(headAngle);
  const remaining = PROTRACTOR_N - pts.length;
  for (let i = 0; i < remaining; i++) {
    const t = i / Math.max(remaining - 1, 1);
    pts.push([tipX + t * (lx - tipX), t * ly] as LocalPoint);
  }

  while (pts.length < PROTRACTOR_N) {
    pts.push(pts[pts.length - 1]);
  }
  return pts.slice(0, PROTRACTOR_N);
}

// Pre-computed template library. We need mutiple templates per shape to cover
// different drawing start positions and configurations.
const TEMPLATES: readonly Template[] = (() => {
  const defs: Array<{
    type: Shape;
    pts: LocalPoint[];
    rotationInvariant?: boolean;
  }> = [
    // Square (1:1) templates
    { type: "rectangle", pts: makeRectangleTemplate(0) },
    { type: "rectangle", pts: makeRectangleTemplate(1) },
    { type: "rectangle", pts: makeRectangleTemplate(2) },
    { type: "rectangle", pts: makeRectangleTemplate(3) },
    // Wide (3:1) rectangle templates — thin horizontal shape
    { type: "rectangle", pts: makeRectangleTemplate(0, 3) },
    { type: "rectangle", pts: makeRectangleTemplate(1, 3) },
    { type: "rectangle", pts: makeRectangleTemplate(2, 3) },
    { type: "rectangle", pts: makeRectangleTemplate(3, 3) },
    // Tall (1:3) rectangle templates — thin vertical shape
    { type: "rectangle", pts: makeRectangleTemplate(0, 1 / 3) },
    { type: "rectangle", pts: makeRectangleTemplate(1, 1 / 3) },
    { type: "rectangle", pts: makeRectangleTemplate(2, 1 / 3) },
    { type: "rectangle", pts: makeRectangleTemplate(3, 1 / 3) },
    // Square (1:1) diamond templates
    { type: "diamond", pts: makeDiamondTemplate(0) },
    { type: "diamond", pts: makeDiamondTemplate(1) },
    { type: "diamond", pts: makeDiamondTemplate(2) },
    { type: "diamond", pts: makeDiamondTemplate(3) },
    // Wide (3:1) diamond templates: thin horizontal diamond
    { type: "diamond", pts: makeDiamondTemplate(0, 3) },
    { type: "diamond", pts: makeDiamondTemplate(1, 3) },
    { type: "diamond", pts: makeDiamondTemplate(2, 3) },
    { type: "diamond", pts: makeDiamondTemplate(3, 3) },
    // Tall (1:3) diamond templates: thin vertical diamond
    { type: "diamond", pts: makeDiamondTemplate(0, 1 / 3) },
    { type: "diamond", pts: makeDiamondTemplate(1, 1 / 3) },
    { type: "diamond", pts: makeDiamondTemplate(2, 1 / 3) },
    { type: "diamond", pts: makeDiamondTemplate(3, 1 / 3) },
    // Ellipse: 8 templates at 45° increments
    { type: "ellipse", pts: makeEllipseTemplate(0) },
    { type: "ellipse", pts: makeEllipseTemplate(Math.PI / 2) },
    { type: "ellipse", pts: makeEllipseTemplate(Math.PI) },
    { type: "ellipse", pts: makeEllipseTemplate((3 * Math.PI) / 2) },
    // Line: 8 templates at 45° increments
    { type: "line", pts: makeLineTemplate(0) },
    { type: "line", pts: makeLineTemplate(Math.PI / 4) },
    { type: "line", pts: makeLineTemplate(Math.PI / 2) },
    { type: "line", pts: makeLineTemplate((3 * Math.PI) / 4) },
    { type: "line", pts: makeLineTemplate(Math.PI) },
    { type: "line", pts: makeLineTemplate((5 * Math.PI) / 4) },
    { type: "line", pts: makeLineTemplate((3 * Math.PI) / 2) },
    { type: "line", pts: makeLineTemplate((7 * Math.PI) / 4) },
    // Arrow templates
    { type: "arrow", pts: makeArrowTemplate(), rotationInvariant: true },
  ];
  return defs.map(({ type, pts, rotationInvariant = false }) => ({
    type,
    vec: vectorise(pts, rotationInvariant),
    rotationInvariant,
  }));
})();

// =============================================================================
// Public API
// =============================================================================

// Recognizes common shapes from free-draw input points
export const recognizeShape = <P extends LocalPoint | GlobalPoint>(
  points: P[],
): ShapeRecognitionResult<P> => {
  const boundingBox = getElementBoundsFromPoints(points);

  if (!points || points.length < 3) {
    return { type: "freedraw", points, boundingBox };
  }

  const resampled = resample(points, PROTRACTOR_N);
  const resampledRev = [...resampled].reverse();

  // Pre-compute both fixed and rotation-invariant candidate vectors so each
  // template is compared with a consistently vectorised candidate.
  const candidateVecFixed = vectorise(resampled, false);
  const candidateVecFixedRev = vectorise(resampledRev, false);
  const candidateVecRotInv = vectorise(resampled, true);
  const candidateVecRotInvRev = vectorise(resampledRev, true);

  let bestScore = -1;
  let bestType: Shape = "freedraw";

  for (const tmpl of TEMPLATES) {
    const cv = tmpl.rotationInvariant ? candidateVecRotInv : candidateVecFixed;
    const cvRev = tmpl.rotationInvariant
      ? candidateVecRotInvRev
      : candidateVecFixedRev;
    const score = Math.max(
      frechetScore(frechetDistance(cv, tmpl.vec)),
      frechetScore(frechetDistance(cvRev, tmpl.vec)),
    );
    if (score > bestScore) {
      bestScore = score;
      bestType = tmpl.type;
    }
  }

  let type: Shape;
  if (bestScore >= PROTRACTOR_SCORE_THRESHOLD) {
    type = bestType;
  } else {
    type = "freedraw";
  }

  return { type, points, boundingBox };
};

// Converts a freedraw element to the detected shape
export const convertToShape = (
  points: LocalPoint[],
  appState: AppState,
  elementsMap: ElementsMap,
): ExcalidrawElement | undefined => {
  const recognizedShape = recognizeShape(points);

  const boundingBox = recognizedShape.boundingBox;
  const [minX, minY, maxX, maxY] = boundingBox;

  const frameId =
    getFrameLikeElements([...elementsMap.values()]).find((frame) => {
      const [fx1, fy1, fx2, fy2] = getElementAbsoluteCoords(frame, elementsMap);
      return fx1 <= minX && fy1 <= minY && fx2 >= maxX && fy2 >= maxY;
    })?.id ?? null;

  const roundness =
    appState.currentItemRoundness === "round"
      ? {
          type: isUsingAdaptiveRadius(recognizedShape.type)
            ? ROUNDNESS.ADAPTIVE_RADIUS
            : ROUNDNESS.PROPORTIONAL_RADIUS,
        }
      : null;

  switch (recognizedShape.type) {
    case "rectangle":
    case "diamond":
    case "ellipse": {
      return newElement({
        type: recognizedShape.type,
        x: recognizedShape.boundingBox[0],
        y: recognizedShape.boundingBox[1],
        width: recognizedShape.boundingBox[2] - recognizedShape.boundingBox[0],
        height: recognizedShape.boundingBox[3] - recognizedShape.boundingBox[1],
        groupIds: [],
        angle: 0 as Radians,
        frameId,
        roundness,
        roughness: appState.currentItemRoughness,
        backgroundColor: appState.currentItemBackgroundColor,
        strokeColor: appState.currentItemStrokeColor,
        fillStyle: appState.currentItemFillStyle,
        opacity: appState.currentItemOpacity,
        strokeStyle: appState.currentItemStrokeStyle,
        strokeWidth: appState.currentItemStrokeWidth,
      });
    }
    case "arrow": {
      const [arrowMinX, arrowMinY] = recognizedShape.boundingBox;
      const tempElement = newArrowElement({
        type: recognizedShape.type,
        x: arrowMinX,
        y: arrowMinY,
        startArrowhead: appState.currentItemStartArrowhead,
        endArrowhead: appState.currentItemEndArrowhead,
        points: [
          [
            recognizedShape.points[0][0] - arrowMinX,
            recognizedShape.points[0][1] - arrowMinY,
          ] as LocalPoint,
          [
            recognizedShape.points[recognizedShape.points.length - 2][0] -
              arrowMinX,
            recognizedShape.points[recognizedShape.points.length - 2][1] -
              arrowMinY,
          ] as LocalPoint,
        ],
        groupIds: [],
        frameId,
        locked: false,
        angle: 0 as Radians,
        roundness,
        roughness: appState.currentItemRoughness,
        backgroundColor: appState.currentItemBackgroundColor,
        strokeColor: appState.currentItemStrokeColor,
        fillStyle: appState.currentItemFillStyle,
        opacity: appState.currentItemOpacity,
        strokeStyle: appState.currentItemStrokeStyle,
        strokeWidth: appState.currentItemStrokeWidth,
      });

      const normalized =
        LinearElementEditor.getNormalizeElementPointsAndCoords(tempElement);

      return newArrowElement({
        ...tempElement,
        ...normalized,
      });
    }
    case "line": {
      const [lineMinX, lineMinY] = recognizedShape.boundingBox;
      const tempElement = newLinearElement({
        type: recognizedShape.type,
        x: lineMinX,
        y: lineMinY,
        points: [
          [
            recognizedShape.points[0][0] - lineMinX,
            recognizedShape.points[0][1] - lineMinY,
          ] as LocalPoint,
          [
            recognizedShape.points[recognizedShape.points.length - 1][0] -
              lineMinX,
            recognizedShape.points[recognizedShape.points.length - 1][1] -
              lineMinY,
          ] as LocalPoint,
        ],
        groupIds: [],
        frameId,
        locked: false,
        angle: 0 as Radians,
        roundness,
        roughness: appState.currentItemRoughness,
        backgroundColor: appState.currentItemBackgroundColor,
        strokeColor: appState.currentItemStrokeColor,
        fillStyle: appState.currentItemFillStyle,
        opacity: appState.currentItemOpacity,
        strokeStyle: appState.currentItemStrokeStyle,
        strokeWidth: appState.currentItemStrokeWidth,
      });

      const normalized =
        LinearElementEditor.getNormalizeElementPointsAndCoords(tempElement);

      return newLinearElement({
        ...tempElement,
        ...normalized,
      });
    }
  }

  return undefined;
};
