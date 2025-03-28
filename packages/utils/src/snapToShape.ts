import type {
  ExcalidrawArrowElement,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
} from "@excalidraw/element/types";
import type { BoundingBox, Bounds } from "@excalidraw/element/bounds";
import { getCenterForBounds, getCommonBoundingBox } from "@excalidraw/element/bounds";
import { newArrowElement, newElement, newLinearElement } from "@excalidraw/element/newElement";
import { angleBetween, GlobalPoint, LocalPoint, perpendicularDistance, pointDistance } from "@excalidraw/math";
import { ROUNDNESS } from "@excalidraw/common";

type Shape =
  | ExcalidrawRectangleElement["type"]
  | ExcalidrawEllipseElement["type"]
  | ExcalidrawDiamondElement["type"]
  | ExcalidrawArrowElement["type"]
  | ExcalidrawLinearElement["type"]
  | ExcalidrawFreeDrawElement["type"];

interface ShapeRecognitionResult {
  type: Shape;
  simplified: readonly LocalPoint[];
  boundingBox: BoundingBox;
}

const QUADRILATERAL_SIDES = 4;
const QUADRILATERAL_MIN_POINTS = 4; // RDP simplified vertices
const QUADRILATERAL_MAX_POINTS = 5; // RDP might include closing point
const ARROW_EXPECTED_POINTS = 5; // RDP simplified vertices for arrow shape
const LINE_EXPECTED_POINTS = 2; // RDP simplified vertices for line shape

const DEFAULT_OPTIONS = {
  // Max distance between stroke start/end (as % of bbox diagonal) to consider closed
  shapeIsClosedPercentThreshold: 20,
  // Min distance (px) to consider shape closed (takes precedence if larger than %)
  shapeIsClosedDistanceThreshold: 10,
  // RDP simplification tolerance (% of bbox diagonal)
  rdpTolerancePercent: 10,
  // Arrow specific thresholds
  arrowMinTipAngle: 30, // Min angle degrees for the tip
  arrowMaxTipAngle: 150, // Max angle degrees for the tip
  arrowHeadMaxShaftRatio: 0.8, // Max length ratio of arrowhead segment to shaft
  // Quadrilateral specific thresholds
  rectangleMinCornerAngle: 20, // Min deviation from 180 degrees for a valid corner
  rectangleMaxCornerAngle: 160, // Max deviation from 0 degrees for a valid corner
  // Angle difference (degrees) to nearest 0/90 orientation to classify as rectangle
  rectangleOrientationAngleThreshold: 10,
  // Max variance in radius (normalized) to consider a shape an ellipse
  ellipseRadiusVarianceThreshold: 0.5,
} as const; // Use 'as const' for stricter typing of default values


// Options for shape recognition, allowing partial overrides
type ShapeRecognitionOptions = typeof DEFAULT_OPTIONS;
type PartialShapeRecognitionOptions = Partial<ShapeRecognitionOptions>;

interface Segment {
  length: number;
  angleDeg: number; // Angle in degrees [0, 180) representing the line's orientation
}

/**
 * Simplify a polyline using Ramer-Douglas-Peucker algorithm.
 */
function simplifyRDP(
  points: readonly LocalPoint[],
  epsilon: number,
): readonly LocalPoint[] {
  if (points.length < 3) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];
  let index = -1;
  let maxDist = 0;

  // Find the point with the maximum distance from the line segment between first and last
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon && index !== -1) {
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    // Concatenate results (omit duplicate point at junction)
    return left.slice(0, -1).concat(right);
  } else {
    // Not enough deviation, return straight line segment (keep only endpoints)
    return [first, last];
  }
}

/**
 * Calculates the properties (length, angle) of segments in a polygon.
 */
function calculateSegments(vertices: readonly LocalPoint[]): Segment[] {
  const segments: Segment[] = [];
  const numVertices = vertices.length;
  for (let i = 0; i < numVertices; i++) {
    const p1 = vertices[i];
    // Ensure wrapping for the last segment connecting back to the start
    const p2 = vertices[(i + 1) % numVertices];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const length = Math.hypot(dx, dy);

    // Calculate angle in degrees [0, 360)
    let angleRad = Math.atan2(dy, dx);
    if (angleRad < 0) {
      angleRad += 2 * Math.PI;
    }
    let angleDeg = (angleRad * 180) / Math.PI;

    // Normalize angle to [0, 180) for undirected line orientation
    if (angleDeg >= 180) {
      angleDeg -= 180;
    }

    segments.push({ length, angleDeg });
  }
  return segments;
}

/**
 * Checks if the shape is closed based on the distance between start and end points.
 */
function isShapeClosed(
  points: readonly LocalPoint[],
  boundingBoxDiagonal: number,
  options: ShapeRecognitionOptions,
): boolean {
  const start = points[0];
  const end = points[points.length - 1];
  const closedDist = pointDistance(start, end);
  const closedThreshold = Math.max(
    options.shapeIsClosedDistanceThreshold,
    boundingBoxDiagonal * (options.shapeIsClosedPercentThreshold / 100),
  );
  return closedDist < closedThreshold;
}

/**
 * Checks if a quadrilateral is likely axis-aligned based on its segment angles.
 */
function isAxisAligned(
  segments: Segment[],
  orientationThreshold: number,
): boolean {
  return segments.some((seg) => {
    const angle = seg.angleDeg;
    // Distance to horizontal (0 or 180 degrees)
    const distToHoriz = Math.min(angle, 180 - angle);
    // Distance to vertical (90 degrees)
    const distToVert = Math.abs(angle - 90);
    return (
      distToHoriz < orientationThreshold || distToVert < orientationThreshold
    );
  });
}

/**
 * Calculates the variance of the distance from points to a center point.
 * Returns a normalized variance value (0 = perfectly round).
 */
function calculateRadiusVariance(
  points: readonly LocalPoint[],
  boundingBox: BoundingBox,
): number {
  if (points.length === 0) {
    return 0; // Or handle as an error/special case
  }

  const [cx, cy] = getCenterForBounds([
    boundingBox.minX,
    boundingBox.minY,
    boundingBox.maxX,
    boundingBox.maxY,
  ] as Bounds);

  let totalDist = 0;
  let maxDist = 0;
  let minDist = Infinity;

  for (const p of points) {
    const d = Math.hypot(p[0] - cx, p[1] - cy);
    totalDist += d;
    maxDist = Math.max(maxDist, d);
    minDist = Math.min(minDist, d);
  }

  const avgDist = totalDist / points.length;

  // Avoid division by zero if avgDist is 0 (e.g., all points are at the center)
  if (avgDist === 0) {
    return 0;
  }

  const radiusVariance = (maxDist - minDist) / avgDist;
  return radiusVariance;
}

/** Checks if the points form a straight line segment. */
function checkLine(
  points: readonly LocalPoint[],
  isClosed: boolean,
): Shape | null {
  if (!isClosed && points.length === LINE_EXPECTED_POINTS) {
    return "line";
  }
  return null;
}

/** Checks if the points form an arrow shape. */
function checkArrow(
  points: readonly LocalPoint[],
  isClosed: boolean,
  options: ShapeRecognitionOptions,
): Shape | null {
  if (isClosed || points.length !== ARROW_EXPECTED_POINTS) {
    return null;
  }

  const shaftStart = points[0];
  const shaftEnd = points[1]; // Assuming RDP simplifies shaft to 2 points
  const arrowBase = points[2];
  const arrowTip = points[3];
  const arrowTailEnd = points[4];

  const tipAngle = angleBetween(arrowTip, arrowBase, arrowTailEnd);

  if (tipAngle <= options.arrowMinTipAngle || tipAngle >= options.arrowMaxTipAngle) {
    return null;
  }

  const headSegment1Len = pointDistance(arrowBase, arrowTip);
  const headSegment2Len = pointDistance(arrowTip, arrowTailEnd);
  const shaftLen = pointDistance(shaftStart, shaftEnd); // Approx shaft length

  // Heuristic: Arrowhead segments should be significantly shorter than the shaft
  const isHeadShortEnough =
    headSegment1Len < shaftLen * options.arrowHeadMaxShaftRatio &&
    headSegment2Len < shaftLen * options.arrowHeadMaxShaftRatio;

  return isHeadShortEnough ? "arrow" : null;
}

/** Checks if the points form a rectangle or diamond shape. */
function checkQuadrilateral(
  points: readonly LocalPoint[],
  isClosed: boolean,
  options: ShapeRecognitionOptions,
): Shape | null {
  if (
    !isClosed ||
    points.length < QUADRILATERAL_MIN_POINTS ||
    points.length > QUADRILATERAL_MAX_POINTS
  ) {
    return null;
  }

  // Take the first 4 points as vertices (RDP might add 5th closing point)
  const vertices = points.slice(0, QUADRILATERAL_SIDES);
  // console.log("Vertices (Quad Check):", vertices);

  // Calculate internal angles
  const angles: number[] = [];
  for (let i = 0; i < QUADRILATERAL_SIDES; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % QUADRILATERAL_SIDES];
    const p3 = vertices[(i + 2) % QUADRILATERAL_SIDES];

    angles.push(angleBetween(p1, p2, p3));
  }

  const allCornersAreValid = angles.every(
    (a) =>
      a > options.rectangleMinCornerAngle &&
      a < options.rectangleMaxCornerAngle,
  );

  if (!allCornersAreValid) {
    return null;
  }

  const segments = calculateSegments(vertices);

  if (isAxisAligned(segments, options.rectangleOrientationAngleThreshold)) {
    return "rectangle";
  } else {
    // Not axis-aligned, but quadrilateral => classify as diamond
    return "diamond";
  }
}

/** Checks if the points form an ellipse shape. */
function checkEllipse(
  points: readonly LocalPoint[],
  isClosed: boolean,
  boundingBox: BoundingBox,
  options: ShapeRecognitionOptions,
): Shape | null {
  if (!isClosed) {
    return null;
  }

  // Need a minimum number of points for it to be an ellipse
  if (points.length < QUADRILATERAL_MAX_POINTS) {
    return null;
  }

  const radiusVariance = calculateRadiusVariance(points, boundingBox);

  return radiusVariance < options.ellipseRadiusVarianceThreshold
    ? "ellipse"
    : null;
}

/**
 * Recognizes common shapes from free-draw input points.
 * @param element The freedraw element to analyze.
 * @param opts Optional overrides for recognition thresholds.
 * @returns Information about the recognized shape.
 */
export const recognizeShape = (
  element: ExcalidrawFreeDrawElement,
  opts: PartialShapeRecognitionOptions = {},
): ShapeRecognitionResult => {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const { points } = element;
  const boundingBox = getCommonBoundingBox([element]);

  // Need at least a few points to recognize a shape
  if (!points || points.length < 3) {
    return { type: "freedraw", simplified: points, boundingBox };
  }

  const boundingBoxDiagonal = Math.hypot(boundingBox.width, boundingBox.height);
  const rdpTolerance = boundingBoxDiagonal * (options.rdpTolerancePercent / 100);
  const simplifiedPoints = simplifyRDP(points, rdpTolerance);

  const isClosed = isShapeClosed(simplifiedPoints, boundingBoxDiagonal, options);

  // --- Shape check order matters here ---
  let recognizedType: Shape =
    checkLine(simplifiedPoints, isClosed) ??
    checkArrow(simplifiedPoints, isClosed, options) ??
    checkQuadrilateral(simplifiedPoints, isClosed, options) ??
    checkEllipse(simplifiedPoints, isClosed, boundingBox, options) ??
    "freedraw"; // Default if no other shape matches

  return {
    type: recognizedType,
    simplified: simplifiedPoints,
    boundingBox,
  };
};


/**
 * Converts a freedraw element to the detected shape
 */
export const convertToShape = (
  freeDrawElement: ExcalidrawFreeDrawElement,
): ExcalidrawElement => {
  const recognizedShape = recognizeShape(freeDrawElement);

  switch (recognizedShape.type) {
    case "rectangle": case "diamond": case "ellipse": {
      return newElement({
        ...freeDrawElement,
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
        type: recognizedShape.type,
        x: recognizedShape.boundingBox.minX,
        y: recognizedShape.boundingBox.minY,
        width: recognizedShape.boundingBox.width!,
        height: recognizedShape.boundingBox.height!,
      });
    }
    case "arrow": {
      return newArrowElement({
        ...freeDrawElement,
        type: recognizedShape.type,
        endArrowhead: "arrow", // TODO: Get correct state
        points: [
          recognizedShape.simplified[0],
          recognizedShape.simplified[recognizedShape.simplified.length - 2]
        ],
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS }
      });
    }
    case "line": {
      return newLinearElement({
        ...freeDrawElement,
        type: recognizedShape.type,
        points: [
          recognizedShape.simplified[0],
          recognizedShape.simplified[recognizedShape.simplified.length - 1]
        ],
        roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS }
      });
    }
    default: return freeDrawElement
  }
};
