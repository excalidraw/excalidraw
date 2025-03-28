import type {
  ExcalidrawArrowElement,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
} from "../excalidraw/element/types";
import type { BoundingBox, Bounds } from "../excalidraw/element/bounds";
import { getCenterForBounds, getCommonBoundingBox } from "../excalidraw/element/bounds";
import { newArrowElement, newElement, newLinearElement } from "../excalidraw/element";
import { angleBetween, GlobalPoint, LocalPoint, perpendicularDistance, pointDistance } from "@excalidraw/math";
import { ROUNDNESS } from "@excalidraw/excalidraw/constants";

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

interface ShapeRecognitionOptions {
  closedDistThreshPercent: number;     // Max distance between stroke start/end to consider shape closed
  cornerAngleThresh: number;           // Angle (in degrees) below which a corner is considered "sharp" (for arrow detection)
  rdpTolerancePercent: number;         // RDP simplification tolerance (percentage of bounding box diagonal)
  rectAngleThresh: number;         // Angle (in degrees) to check for rectangle corners
  rectOrientationThresh: number;       // Angle difference (in degrees) to nearest 0/90 orientation to call it rectangle
}

const DEFAULT_OPTIONS: ShapeRecognitionOptions = {
  closedDistThreshPercent: 10,  // distance between start/end < % of bounding box diagonal
  cornerAngleThresh: 60,        // <60° considered a sharp corner (possible arrow tip)
  rdpTolerancePercent: 10,      // percentage of bounding box diagonal
  rectAngleThresh: 20,         // <20° considered a sharp corner (rectangle)
  rectOrientationThresh: 10,    //
};


/**
 * Recognizes common shapes from free-draw input
 * @param element The freedraw element to analyze
 * @returns Information about the recognized shape, or null if no shape is recognized
 */
export const recognizeShape = (
  element: ExcalidrawFreeDrawElement,
  opts: Partial<ShapeRecognitionOptions> = {},
): ShapeRecognitionResult => {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  const boundingBox = getCommonBoundingBox([element]);;

  // We need at least a few points to recognize a shape
  if (!element.points || element.points.length < 3) {
    return { type: "freedraw", simplified: element.points, boundingBox };
  }

  const tolerance = pointDistance(
    [boundingBox.minX, boundingBox.minY] as LocalPoint,
    [boundingBox.maxX, boundingBox.maxY] as LocalPoint,
  ) * options.rdpTolerancePercent / 100;
  const simplified = simplifyRDP(element.points, tolerance);
  console.log("Simplified points:", simplified);

  // Check if the original points form a closed shape
  const start = element.points[0], end = element.points[element.points.length - 1];
  const closedDist = pointDistance(start, end);
  const diag = Math.hypot(boundingBox.width, boundingBox.height); // diagonal of bounding box
  const isClosed = closedDist < Math.max(10, diag * options.closedDistThreshPercent / 100);  // e.g., threshold: 10px or % of size
  console.log("Closed shape:", isClosed);

  let bestShape: Shape = 'freedraw'; // TODO: Should this even be possible in this mode?

  const boundingBoxCenter = getCenterForBounds([
    boundingBox.minX,
    boundingBox.minY,
    boundingBox.maxX,
    boundingBox.maxY,
  ] as Bounds);

  // **Line** (open shape with low deviation from a straight line)
  if (!isClosed && simplified.length == 2) {
    bestShape = 'line';
  }

  // **Arrow** (open shape with a sharp angle indicating an arrowhead)
  if (!isClosed && simplified.length == 5) {
    // The last two segments will make an arrowhead
    console.log("Simplified points:", simplified);
    const arrow_start = simplified[2], arrow_tip = simplified[3], arrow_end = simplified[4];
    const tipAngle = angleBetween(arrow_tip, arrow_start, arrow_end); // angle at the second-last point (potential arrow tip)
    // Lengths of the last two segments

    const seg1Len = pointDistance(arrow_start, arrow_tip);
    const seg2Len = pointDistance(arrow_tip, arrow_end);
    // Length of the rest of the stroke (approx arrow shaft length)
    const shaftLen = pointDistance(simplified[0], simplified[1])
    // Heuristic checks for arrowhead: sharp angle and short segments relative to shaft
    console.log("Arrow tip angle:", tipAngle);
    if (tipAngle > 30 && tipAngle < 150 && seg1Len < shaftLen * 0.8 && seg2Len < shaftLen * 0.8) {
      bestShape = 'arrow';
    }
  }

  // **Rectangle or Diamond** (closed shape with 4 corners - RDP might include last point
  if (isClosed && (simplified.length == 4 || simplified.length == 5)) {
    const vertices = simplified.slice(); // copy
    if (simplified.length === 5) {
      vertices.pop(); // remove last point if RDP included it
    }

    // Compute angles at each corner
    console.log("Vertices:", vertices);
    var angles = []
    for (let i = 0; i < vertices.length; i++) {
      angles.push(angleBetween(vertices[i], vertices[(i + 1) % vertices.length], vertices[(i + 2) % vertices.length]));
    }

    console.log("Angles:", angles);
    console.log("Angles sum:", angles.reduce((a, b) => a + b, 0));

    // All angles are sharp enough, so we can check for rectangle/diamond
    if (angles.every(a => (a > options.rectAngleThresh && a < 180 - options.rectAngleThresh))) {
      // Determine orientation by checking the slope of each segment
      interface Segment { length: number; angleDeg: number; }
      const segments: Segment[] = [];
      for (let i = 0; i < 4; i++) {
        const p1 = simplified[i];
        const p2 = simplified[(i + 1) % (simplified.length)];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const length = Math.hypot(dx, dy);
        // angle of segment in degrees from horizontal
        let segAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (segAngle < 0) segAngle += 360;
        if (segAngle > 180) segAngle -= 180; // use [0,180] range for undirected line
        segments.push({ length, angleDeg: segAngle });
      }
      // Check for axis-aligned orientation
      const hasAxisAlignedSide = segments.some(seg => {
        const angle = seg.angleDeg;
        const distToHoriz = Math.min(Math.abs(angle - 0), Math.abs(angle - 180));
        const distToVert = Math.abs(angle - 90);
        return (distToHoriz < options.rectOrientationThresh) || (distToVert < options.rectOrientationThresh);
      });
      if (hasAxisAlignedSide) {
        bestShape = "rectangle";
      } else {
        // Not near axis-aligned, likely a rotated shape -> diamond
        bestShape = "diamond";
      }
    }
  } else {
    const aspectRatio = boundingBox.width && boundingBox.height ? Math.min(boundingBox.width, boundingBox.height) / Math.max(boundingBox.width, boundingBox.height) : 1;
    // If aspect ratio ~1 (nearly square) and simplified has few corners, good for circle
    if (aspectRatio > 0.8) {
      // Measure radius variance
      const cx = boundingBoxCenter[0];
      const cy = boundingBoxCenter[1];
      let totalDist = 0, maxDist = 0, minDist = Infinity;
      for (const p of simplified) {
        const d = Math.hypot(p[0] - cx, p[1] - cy);
        totalDist += d;
        maxDist = Math.max(maxDist, d);
        minDist = Math.min(minDist, d);
      }
      const avgDist = totalDist / simplified.length;
      const radiusVar = (maxDist - minDist) / (avgDist || 1);
      // If variance in radius is small, shape is round
      if (radiusVar < 0.3) {
        bestShape = 'ellipse';
      }
    }
  }

  return {
    type: bestShape,
    simplified,
    boundingBox
  } as ShapeRecognitionResult;
};

/**
 * Simplify a polyline using Ramer-Douglas-Peucker algorithm.
 * @param points Array of points [x,y] representing the stroke.
 * @param epsilon Tolerance for simplification (higher = more simplification).
 * @returns Simplified list of points.
 */
function simplifyRDP(points: readonly LocalPoint[], epsilon: number): readonly LocalPoint[] {
  if (points.length < 3) return points;
  // Find the point with the maximum distance from the line between first and last
  const first = points[0], last = points[points.length - 1];
  let index = -1;
  let maxDist = 0;
  for (let i = 1; i < points.length - 1; i++) {
    // Perpendicular distance from points[i] to line (first-last)
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
    // Not enough deviation, return straight line (keep only endpoints)
    return [first, last];
  }
}

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
