import { isArrowElement } from "./typeChecks";

import type {
  ArrowFlow,
  ArrowFlowDirection,
  ArrowFlowSpeed,
  ExcalidrawArrowElement,
  ExcalidrawElement,
} from "./types";

export const ARROW_FLOW_DIRECTIONS: readonly ArrowFlowDirection[] = [
  "forward",
  "backward",
  "both",
];
export const ARROW_FLOW_SPEEDS: readonly ArrowFlowSpeed[] = [
  "slow",
  "normal",
  "fast",
];

/** how fast packets travel, in scene px per second */
export const ARROW_FLOW_PACE: Record<ArrowFlowSpeed, number> = {
  slow: 70,
  normal: 140,
  fast: 260,
};

export const DEFAULT_ARROW_FLOW: ArrowFlow = {
  direction: "forward",
  speed: "normal",
};

/** A valid flow, or null for anything that isn't one (e.g. from an old or edited file). */
export const normalizeArrowFlow = (flow: unknown): ArrowFlow | null => {
  if (!flow || typeof flow !== "object") {
    return null;
  }
  const { direction, speed } = flow as Partial<ArrowFlow>;
  if (!direction || !ARROW_FLOW_DIRECTIONS.includes(direction)) {
    return null;
  }
  return {
    direction,
    speed:
      speed && ARROW_FLOW_SPEEDS.includes(speed)
        ? speed
        : DEFAULT_ARROW_FLOW.speed,
  };
};

export const hasArrowFlow = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawArrowElement & { flow: ArrowFlow } =>
  isArrowElement(element) &&
  !element.isDeleted &&
  !!normalizeArrowFlow(element.flow);

/**
 * The arrow's line as an SVG path in scene coordinates, for packets to travel
 * along. Round arrows are drawn by rough.js as a Catmull-Rom curve through
 * their points, so they get the same curve here; sharp and elbow arrows are
 * straight segments.
 */
export const getArrowFlowPath = (element: ExcalidrawArrowElement): string => {
  const points = element.points.map(
    (p) => [element.x + p[0], element.y + p[1]] as const,
  );
  if (points.length < 2) {
    return "";
  }
  const at = (i: number) => points[Math.min(points.length - 1, Math.max(0, i))];
  const num = (n: number) => Math.round(n * 100) / 100;

  let d = `M${num(points[0][0])} ${num(points[0][1])}`;
  if (!element.roundness || element.elbowed || points.length === 2) {
    for (const [x, y] of points.slice(1)) {
      d += ` L${num(x)} ${num(y)}`;
    }
    return d;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${num(c1x)} ${num(c1y)} ${num(c2x)} ${num(c2y)} ${num(p2[0])} ${num(
      p2[1],
    )}`;
  }
  return d;
};

/** length of the arrow's polyline (a close enough measure to pace packets) */
export const getArrowFlowLength = (element: ExcalidrawArrowElement): number =>
  element.points.reduce(
    (sum, p, i) =>
      i === 0
        ? 0
        : sum +
          Math.hypot(
            p[0] - element.points[i - 1][0],
            p[1] - element.points[i - 1][1],
          ),
    0,
  );
