import type { LocalPoint } from "@excalidraw/math";

const MIN_POINTS = 8;
const MIN_SIZE = 20;

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

function getBoundingBox(points: readonly LocalPoint[]): BoundingBox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function isClosed(points: readonly LocalPoint[], bbox: BoundingBox): boolean {
  const threshold = Math.max(bbox.width, bbox.height) * 0.3;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

/**
 * Divide the path into N equally-sized segments and count how many consecutive
 * segment-pairs change direction by more than 55°.
 *
 * Using coarse segments (instead of adjacent points) means a rectangle corner
 * that spans several noisy points is captured reliably, while a smooth circle
 * arc never exceeds the threshold even for large segments.
 */
function countCorners(points: readonly LocalPoint[]): number {
  const n = points.length;
  const NUM_SEGS = Math.min(16, Math.max(4, Math.floor(n / 5)));
  const segLen = Math.floor(n / NUM_SEGS);
  if (segLen < 2) return 0;

  const dirs: number[] = [];
  for (let s = 0; s < NUM_SEGS; s++) {
    const a = s * segLen;
    const b = Math.min(a + segLen - 1, n - 1);
    const dx = points[b][0] - points[a][0];
    const dy = points[b][1] - points[a][1];
    if (Math.hypot(dx, dy) > 2) {
      dirs.push(Math.atan2(dy, dx));
    }
  }

  let corners = 0;
  for (let i = 1; i < dirs.length; i++) {
    let diff = Math.abs(dirs[i] - dirs[i - 1]);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > (Math.PI * 55) / 180) corners++; // > 55°
  }
  return corners;
}

/**
 * Detect a hand-drawn ellipse or circle.
 *
 * Primary guard: fewer than 3 sharp corners (so rectangles & triangles are
 * excluded early before any metric computation).
 *
 * Secondary: in normalised ellipse space every point on the ellipse maps to
 * distance 1 from the centre.  We measure the coefficient of variation
 * (std / mean) of those distances — low CoV means "roundish".
 */
export function detectEllipse(
  points: readonly LocalPoint[],
): BoundingBox | null {
  if (points.length < MIN_POINTS) return null;

  const bbox = getBoundingBox(points);
  if (bbox.width < MIN_SIZE || bbox.height < MIN_SIZE) return null;
  if (!isClosed(points, bbox)) return null;

  // Hard gate: circles have 0–2 coarse-segment corners; rectangles have ≥ 4
  if (countCorners(points) >= 3) return null;

  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const rx = bbox.width / 2;
  const ry = bbox.height / 2;

  const dists = points.map(([x, y]) => {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return Math.sqrt(nx * nx + ny * ny);
  });

  const mean = dists.reduce((s, d) => s + d, 0) / dists.length;
  const variance =
    dists.reduce((s, d) => s + (d - mean) ** 2, 0) / dists.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev / mean > 0.22) return null;

  // Points must cover at least 240° of the circumference (no big gap)
  const angles = points.map(([x, y]) =>
    Math.atan2((y - cy) / ry, (x - cx) / rx),
  );
  const sorted = [...angles].sort((a, b) => a - b);
  let maxGap = 2 * Math.PI - (sorted[sorted.length - 1] - sorted[0]);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > maxGap) maxGap = gap;
  }
  if (maxGap > (2 * Math.PI * 120) / 360) return null; // gap > 120°

  return bbox;
}

/**
 * Detect a hand-drawn rectangle.
 */
export function detectRectangle(
  points: readonly LocalPoint[],
): BoundingBox | null {
  if (points.length < MIN_POINTS) return null;

  const bbox = getBoundingBox(points);
  if (bbox.width < MIN_SIZE || bbox.height < MIN_SIZE) return null;
  if (!isClosed(points, bbox)) return null;

  const aspectRatio =
    Math.max(bbox.width, bbox.height) / Math.min(bbox.width, bbox.height);
  if (aspectRatio > 10) return null;

  // Must have ~4 corners
  const corners = countCorners(points);
  if (corners < 3 || corners > 8) return null;

  // Every point must lie near one of the 4 edges.
  // 18 % is deliberately below the ~29 % gap that a 45° circle point would
  // have, so perfect circles are rejected even if corner count somehow passes.
  const tolerance = Math.min(bbox.width, bbox.height) * 0.18;

  for (const [x, y] of points) {
    if (
      Math.abs(x - bbox.minX) > tolerance &&
      Math.abs(x - bbox.maxX) > tolerance &&
      Math.abs(y - bbox.minY) > tolerance &&
      Math.abs(y - bbox.maxY) > tolerance
    ) {
      return null;
    }
  }

  // All 4 edges must be represented
  const et = tolerance * 2;
  if (!points.some(([x]) => Math.abs(x - bbox.minX) <= et)) return null;
  if (!points.some(([x]) => Math.abs(x - bbox.maxX) <= et)) return null;
  if (!points.some(([, y]) => Math.abs(y - bbox.minY) <= et)) return null;
  if (!points.some(([, y]) => Math.abs(y - bbox.maxY) <= et)) return null;

  return bbox;
}
