import {
  getBoundsFromPoints,
  getElementAbsoluteCoords,
} from "@excalidraw/element/bounds";
import {
  newArrowElement,
  newElement,
  newLinearElement,
} from "@excalidraw/element/newElement";
import {
  ELEMENT_PENDING_DRAW_SHAPE_OPACITY,
  getStrokeWidthByKey,
  ROUNDNESS,
} from "@excalidraw/common";
import {
  convexHull,
  elongation,
  kurtosis,
  orientPrincipalAxes,
  pointFrom,
  polygonArea,
  principalAxes,
  principalCoords,
  simplifyConvexPolygon,
  skewness,
} from "@excalidraw/math";

import type { App, AppState } from "@excalidraw/excalidraw/types";

import type { LocalPoint, GlobalPoint, Radians } from "@excalidraw/math";
import type { Bounds } from "@excalidraw/common";
import type {
  ExcalidrawArrowElement,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawRectangleElement,
  ElementsMap,
  ExcalidrawNonSelectionElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  ExcalidrawLineElement,
} from "@excalidraw/element/types";

import { getFrameLikeElements } from "./frame";
import { isLinearElement, isUsingAdaptiveRadius } from "./typeChecks";
import { LinearElementEditor } from "./linearElementEditor";

// A moment-based shape recognizer.
//
// NOTE: Rectangle vs. diamond is deliberately *not* rotation invariant. A 45
// rectangle = diamond.

type NonDeletedRecognizedShapeElement = NonDeleted<
  | ExcalidrawRectangleElement
  | ExcalidrawEllipseElement
  | ExcalidrawDiamondElement
  | ExcalidrawArrowElement
  | ExcalidrawLineElement
  | ExcalidrawFreeDrawElement
>;

type Shape = NonDeletedRecognizedShapeElement["type"];

interface ShapeRecognitionResult<P extends LocalPoint | GlobalPoint> {
  // The type of the recognized shape, or "freedraw" if no good match was found
  type: Shape;

  // The original input points (not simplified)
  points: readonly P[];

  // Bounding box of the original input points, used for positioning the
  // converted shape
  boundingBox: Bounds;
}

// Number of points every stroke is resampled to before feature extraction.
const RESAMPLE_N = 64;

// Minimum apparent (on-screen) size of a stroke's larger bounding-box
// dimension, in pixels, for recognition to run — below this the stroke reads
// as an accidental scribble. Compared against `sceneSize * zoom` so the same
// physical gesture behaves the same at every zoom level.
//
// Maximum not required. Runtime is O(point count), points come in at roughly
// one per frame.
const RECOGNITION_MIN_SCREEN_SIZE = 25;

// A stroke whose endpoints are farther apart than this fraction of its own
// path length is treated as open (a line or an arrow) rather than closed (a
// rectangle, diamond or ellipse).
const CLOSED_GAP_MAX_RATIO = 0.15;

// Maximum elongation for an open stroke to count as straight.
const LINEAR_MAX_ELONGATION = 0.25;

// Minimum |skew| along the major axis for an open, straight stroke to be an
// arrow rather than a plain line. Arrowhead add "mass" -> skews that way.
const ARROW_MIN_SKEW = 0.3;

// Maximum feature-space distance to a shape prototype, in units of the
// per-feature tolerances in CLOSED_SHAPE_PROTOTYPES. Beyond this the stroke is
// not enough like any known shape and stays freedraw.
const CLOSED_SHAPE_MAX_DISTANCE = 1.5;

// Accumulated turn required for a hull vertex to survive simplification. Sets
// the corner count an ellipse reports (~360°/25° ≈ 14) while leaving the four
// right-angle corners of a rectangle or diamond intact.
const HULL_CORNER_ANGLE_THRESHOLD = (25 * Math.PI) / 180;

// =============================================================================
// Feature extraction
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

// Statistical description of a stroke, in terms that don't depend on where,
// how big, or (except where noted) how rotated it was drawn.
interface StrokeFeatures {
  // Straight-line distance between the endpoints over the stroke's own path
  // length. ~0 when the stroke returns to its start.
  gapRatio: number;

  // Point cloud elongation along the major axis.
  elongation: number;

  // Skew of the points projected onto the major axis. Signed so that it is
  // <= 0 by construction.
  majorSkew: number;

  // Convex hull area over axis-aligned bounding box area, in the screen
  // frame: ~1 for a rectangle, ~PI/4 for an ellipse, ~1/2 for a diamond.
  hullFillRatio: number;

  // Corner count of the simplified convex hull: 4 for a rectangle or diamond,
  // many for an ellipse.
  hullCorners: number;

  // kurtosis along x times kurtosis along y, in the screen frame. The two
  // factors each vary with the aspect ratio, but their product barely does:
  // ~1.83 for any rectangle, 2.25 for any ellipse, 3.24 for any diamond.
  kurtosisProduct: number;
}

function extractFeatures<P extends LocalPoint | GlobalPoint>(
  points: readonly P[],
): StrokeFeatures {
  // Resample first: features are moments of the point set, so they would
  // otherwise be biased by pointer speed, which crowds samples wherever the
  // user drew slowly.
  const pts = resample(points, RESAMPLE_N);

  let pathLength = 0;
  for (let i = 1; i < pts.length; i++) {
    pathLength += Math.hypot(
      pts[i][0] - pts[i - 1][0],
      pts[i][1] - pts[i - 1][1],
    );
  }
  const gap = Math.hypot(
    pts[pts.length - 1][0] - pts[0][0],
    pts[pts.length - 1][1] - pts[0][1],
  );

  const axes = orientPrincipalAxes(pts, principalAxes(pts));
  const majorProjection = principalCoords(pts, axes).map(([u]) => u);

  const hull = convexHull(pts);
  const hullCorners = simplifyConvexPolygon(
    hull,
    HULL_CORNER_ANGLE_THRESHOLD,
  ).length;
  const [minX, minY, maxX, maxY] = getBoundsFromPoints(pts);
  const boxArea = (maxX - minX) * (maxY - minY);

  return {
    gapRatio: pathLength > 0 ? gap / pathLength : 0,
    elongation: elongation(axes),
    majorSkew: skewness(majorProjection),
    hullFillRatio: boxArea > 0 ? polygonArea(hull) / boxArea : 0,
    hullCorners,
    kurtosisProduct:
      kurtosis(pts.map(([x]) => x)) * kurtosis(pts.map(([, y]) => y)),
  };
}

// =============================================================================
// Classification
// =============================================================================

const CLOSED_SHAPE_PROTOTYPES: readonly {
  type: Shape;
  hullFillRatio: number;
  hullCorners: number;
  kurtosisProduct: number;
}[] = [
  {
    type: "rectangle",
    hullFillRatio: 1,
    hullCorners: 4,
    kurtosisProduct: 1.83,
  },
  {
    type: "diamond",
    hullFillRatio: 0.5,
    hullCorners: 4,
    kurtosisProduct: 3.24,
  },
  {
    type: "ellipse",
    hullFillRatio: Math.PI / 4,
    hullCorners: 14,
    kurtosisProduct: 2.25,
  },
];

const HULL_FILL_RATIO_TOLERANCE = 0.15;
const HULL_CORNERS_TOLERANCE = 6;
const KURTOSIS_PRODUCT_TOLERANCE = 0.7;

// Pick the closed shape whose prototype the stroke's features sit closest to,
// or freedraw when even the nearest one is too far away.
function classifyClosedStroke(features: StrokeFeatures): Shape {
  let best: Shape = "freedraw";
  let bestDistance = CLOSED_SHAPE_MAX_DISTANCE;

  for (const prototype of CLOSED_SHAPE_PROTOTYPES) {
    const distance = Math.hypot(
      (features.hullFillRatio - prototype.hullFillRatio) /
        HULL_FILL_RATIO_TOLERANCE,
      (features.hullCorners - prototype.hullCorners) / HULL_CORNERS_TOLERANCE,
      (features.kurtosisProduct - prototype.kurtosisProduct) /
        KURTOSIS_PRODUCT_TOLERANCE,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = prototype.type;
    }
  }

  return best;
}

// An open stroke is a line or an arrow, provided it is straight enough; the
// arrowhead is what makes the point distribution lopsided.
function classifyOpenStroke(features: StrokeFeatures): Shape {
  if (features.elongation > LINEAR_MAX_ELONGATION) {
    return "freedraw";
  }
  return Math.abs(features.majorSkew) >= ARROW_MIN_SKEW ? "arrow" : "line";
}

function classify(features: StrokeFeatures): Shape {
  return features.gapRatio > CLOSED_GAP_MAX_RATIO
    ? classifyOpenStroke(features)
    : classifyClosedStroke(features);
}

// Arrow endpoint selection

// When an arrow is recognized, the original input's last point may not
// correspond to the actual arrow tip. The tip must lie on the bounding-box
// perimeter and is the perimeter point farthest from the start (first input
// point). We find the closest original input point to that ideal tip.
function getArrowEndpoint<P extends LocalPoint | GlobalPoint>(
  points: readonly P[],
  boundingBox: Bounds,
  startPoint: P,
): P {
  const [minX, minY, maxX, maxY] = boundingBox;
  const w = maxX - minX;
  const h = maxY - minY;

  // Degenerate bounding box – fall back to last point
  if (w === 0 && h === 0) {
    return points[points.length - 1];
  }

  // Perimeter corners / edge points to check (4 corners + 4 edge midpoints
  // give good coverage of the perimeter).
  const perimeterPoints: LocalPoint[] = [
    pointFrom(minX, minY),
    pointFrom((minX + maxX) / 2, minY),
    pointFrom(maxX, minY),
    pointFrom(maxX, (minY + maxY) / 2),
    pointFrom(maxX, maxY),
    pointFrom((minX + maxX) / 2, maxY),
    pointFrom(minX, maxY),
    pointFrom(minX, (minY + maxY) / 2),
  ];

  // Ideal endpoint = perimeter point farthest from start.
  let idealDist = -1;
  let idealEndpoint: LocalPoint = pointFrom(maxX, maxY);
  for (const pp of perimeterPoints) {
    const d = Math.hypot(pp[0] - startPoint[0], pp[1] - startPoint[1]);
    if (d > idealDist) {
      idealDist = d;
      idealEndpoint = pp;
    }
  }

  // Find the original input point closest to the ideal endpoint.
  let bestDist = Infinity;
  let bestPoint: P = points[points.length - 1];
  for (const pt of points) {
    const d = Math.hypot(pt[0] - idealEndpoint[0], pt[1] - idealEndpoint[1]);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = pt;
    }
  }
  return bestPoint;
}

// =============================================================================
// Public API
// =============================================================================

// Recognizes common shapes from free-draw input points
export const recognizeShape = <P extends LocalPoint | GlobalPoint>(
  points: P[],
  previousElement: ExcalidrawElement | null,
  zoom: number = 1,
): ShapeRecognitionResult<P> => {
  const boundingBox = getBoundsFromPoints(points);

  const [minX, minY, maxX, maxY] = boundingBox;
  const maxDim = Math.max(maxX - minX, maxY - minY);
  if (points.length < 3 || maxDim * zoom < RECOGNITION_MIN_SCREEN_SIZE) {
    return { type: "freedraw", points, boundingBox };
  }

  const recognized = classify(extractFeatures(points));
  const type =
    previousElement?.type === "arrow" && recognized !== "arrow"
      ? "freedraw"
      : recognized;

  return { type, points, boundingBox };
};

// Converts a freedraw element to the detected shape.
//
// `frames` lets callers pass the scene's cached frame-like elements (e.g.
// scene.getNonDeletedFramesLikes()) to avoid spreading and re-filtering the
// whole element map on every invocation; when omitted it is derived from
// `elementsMap`.
export const convertToShape = (
  points: GlobalPoint[],
  appState: AppState,
  elementsMap: ElementsMap,
  previousElement: ExcalidrawElement | null,
  frames?: readonly ExcalidrawFrameLikeElement[],
): NonDeletedRecognizedShapeElement | undefined => {
  const recognizedShape = recognizeShape(
    points,
    previousElement,
    appState.zoom.value,
  );

  const boundingBox = recognizedShape.boundingBox;
  const [minX, minY, maxX, maxY] = boundingBox;

  const frameLikeElements =
    frames ?? getFrameLikeElements([...elementsMap.values()]);
  const frameId =
    frameLikeElements.find((frame) => {
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
        strokeWidth: getStrokeWidthByKey(
          recognizedShape.type,
          appState.currentItemStrokeWidthKey,
        ),
      }) as NonDeletedRecognizedShapeElement;
    }
    case "arrow": {
      const [arrowX, arrowY] = recognizedShape.points[0];

      let globalEndX: number;
      let globalEndY: number;
      if (previousElement && previousElement.type === "line") {
        const prevEndLocal = previousElement.points[1];
        // No need for rotation handling
        globalEndX = prevEndLocal[0] + previousElement.x;
        globalEndY = prevEndLocal[1] + previousElement.y;
      } else {
        [globalEndX, globalEndY] = getArrowEndpoint(
          recognizedShape.points,
          recognizedShape.boundingBox,
          recognizedShape.points[0],
        );
      }
      const endPoint: LocalPoint = pointFrom<LocalPoint>(
        globalEndX - arrowX,
        globalEndY - arrowY,
      );
      const arrowLen = Math.hypot(
        globalEndX - recognizedShape.points[0][0],
        globalEndY - recognizedShape.points[0][1],
      );
      if (arrowLen < 60) {
        const tempElement = newLinearElement({
          type: "line",
          x: arrowX,
          y: arrowY,
          points: [
            pointFrom<LocalPoint>(
              recognizedShape.points[0][0] - arrowX,
              recognizedShape.points[0][1] - arrowY,
            ),
            endPoint,
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
          strokeWidth: getStrokeWidthByKey(
            recognizedShape.type,
            appState.currentItemStrokeWidthKey,
          ),
        });

        const normalized =
          LinearElementEditor.getNormalizeElementPointsAndCoords(tempElement);

        return newLinearElement({
          ...tempElement,
          ...normalized,
        }) as NonDeletedRecognizedShapeElement;
      }
      const tempElement = newArrowElement({
        type: "arrow",
        x: arrowX,
        y: arrowY,
        startArrowhead: appState.currentItemStartArrowhead,
        endArrowhead: appState.currentItemEndArrowhead,
        points: [
          pointFrom<LocalPoint>(
            recognizedShape.points[0][0] - arrowX,
            recognizedShape.points[0][1] - arrowY,
          ),
          endPoint,
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
        strokeWidth: getStrokeWidthByKey(
          recognizedShape.type,
          appState.currentItemStrokeWidthKey,
        ),
      });

      const normalized =
        LinearElementEditor.getNormalizeElementPointsAndCoords(tempElement);

      return newArrowElement({
        ...tempElement,
        ...normalized,
      });
    }
    case "line": {
      const [lineX, lineY] = recognizedShape.points[0];
      const endPoint =
        recognizedShape.points[recognizedShape.points.length - 1];
      const tempElement = newLinearElement({
        type: recognizedShape.type,
        x: lineX,
        y: lineY,
        points: [
          pointFrom<LocalPoint>(
            recognizedShape.points[0][0] - lineX,
            recognizedShape.points[0][1] - lineY,
          ),
          pointFrom<LocalPoint>(endPoint[0] - lineX, endPoint[1] - lineY),
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
        strokeWidth: getStrokeWidthByKey(
          recognizedShape.type,
          appState.currentItemStrokeWidthKey,
        ),
      });

      const normalized =
        LinearElementEditor.getNormalizeElementPointsAndCoords(tempElement);

      return newLinearElement({
        ...tempElement,
        ...normalized,
      }) as NonDeletedRecognizedShapeElement;
    }
  }

  return undefined;
};

// Whether two drawShape preview elements are visually identical, so a redundant
// preview recompute on pointermove can skip setState (avoiding a no-op React
// re-render and roughjs shape regeneration).
const isDrawShapePreviewEqual = (
  a: NonDeletedExcalidrawElement | null,
  b: NonDeletedExcalidrawElement,
): boolean => {
  if (
    !a ||
    a.type !== b.type ||
    a.x !== b.x ||
    a.y !== b.y ||
    a.width !== b.width ||
    a.height !== b.height ||
    a.angle !== b.angle
  ) {
    return false;
  }
  if (isLinearElement(a) && isLinearElement(b)) {
    if (a.points.length !== b.points.length) {
      return false;
    }
    for (let i = 0; i < a.points.length; i++) {
      if (
        a.points[i][0] !== b.points[i][0] ||
        a.points[i][1] !== b.points[i][1]
      ) {
        return false;
      }
    }
  }
  return true;
};

// Append to the trail and recompute the shape preview. This runs inside
// withBatchedUpdatesThrottled (throttleRAF), so it fires at most once per
// animation frame regardless of raw pointermove rate.
export const convertToShapeHandlePointerMoveFromPointerDown = (
  app: App,
  pointerCoords: { x: number; y: number },
) => {
  if (app.state.activeTool.type === "drawShape") {
    app.drawShape.trail.addPointToPath(pointerCoords.x, pointerCoords.y);

    const drawShapeTrailPoints = app.drawShape.trail.getCurrentPoints();
    // note: size gate inside recognizeShape
    if (drawShapeTrailPoints.length >= 3) {
      const shapePreview = convertToShape(
        drawShapeTrailPoints,
        app.state,
        app.scene.getNonDeletedElementsMap(),
        app.state.newElement,
        app.scene.getNonDeletedFramesLikes(),
      ) as ExcalidrawNonSelectionElement | undefined;

      if (shapePreview) {
        const prevPreview = app.state.newElement;
        const nextPreview = {
          ...shapePreview,
          // Keep a stable id across the gesture while the recognized type
          // is unchanged, so the preview element's identity doesn't churn
          // frame to frame.
          id:
            prevPreview?.type === shapePreview.type
              ? prevPreview.id
              : shapePreview.id,
          seed: 1,
          opacity: ELEMENT_PENDING_DRAW_SHAPE_OPACITY,
          isDeleted: false as const,
        } as NonDeletedRecognizedShapeElement;

        if (!isDrawShapePreviewEqual(prevPreview, nextPreview)) {
          app.setState({ newElement: nextPreview });
        }
      } else if (app.state.newElement !== null) {
        app.setState({ newElement: null });
      }
    }

    return true;
  }

  return false;
};
