import { LaserPointer, type Point } from "@excalidraw/laser-pointer";

import { clamp, round, type LocalPoint } from "@excalidraw/math";

import getStroke from "perfect-freehand";

import type { StrokeOptions } from "perfect-freehand";

import type { ExcalidrawFreeDrawElement, PointerType } from "./types";

type FreedrawStrokeType = "constant" | "variable";

export const getElementStrokeType = (
  element: ExcalidrawFreeDrawElement,
): FreedrawStrokeType => {
  return element.drawingConfigs?.fixedStrokeWidth ? "constant" : "variable";
};

export const DRAWING_CONFIGS: Record<
  PointerType | "default",
  Record<FreedrawStrokeType, { streamline: number; simplify: number }>
> = {
  default: {
    constant: {
      streamline: 0.35,
      simplify: 0.1,
    },
    variable: {
      streamline: 0.35,
      simplify: 0.1,
    },
  },
  mouse: {
    constant: {
      streamline: 0.6,
      simplify: 0.1,
    },
    variable: {
      streamline: 0.6,
      simplify: 0.1,
    },
  },
  pen: {
    constant: {
      // for optimal performance, we use a lower streamline and simplify
      streamline: 0.2,
      simplify: 0.1,
    },
    variable: {
      // for optimal performance, we use a lower streamline and simplify
      streamline: 0.2,
      simplify: 0.1,
    },
  },
  touch: {
    constant: {
      streamline: 0.65,
      simplify: 0.1,
    },
    variable: {
      streamline: 0.65,
      simplify: 0.1,
    },
  },
} as const;

export const getFreedrawConfig = (
  eventType: string | null | undefined,
  strokeType: FreedrawStrokeType,
): { streamline: number; simplify: number } => {
  const inputConfig =
    DRAWING_CONFIGS[(eventType as PointerType | null) || "default"] ||
    DRAWING_CONFIGS.default;
  return inputConfig[strokeType];
};

/**
 * Calculates simulated pressure based on velocity between consecutive points.
 * Fast movement (large distances) -> lower pressure
 * Slow movement (small distances) -> higher pressure
 */
const calculateVelocityBasedPressure = (
  points: readonly LocalPoint[],
  index: number,
  fixedStrokeWidth: boolean | undefined,
  maxDistance = 8, // Maximum expected distance for normalization
): number => {
  if (fixedStrokeWidth) {
    return 1;
  }

  // First point gets highest pressure
  // This avoid "a dot followed by a line" effect, •== when first stroke is "slow"
  if (index === 0) {
    return 1;
  }

  const [x1, y1] = points[index - 1];
  const [x2, y2] = points[index];

  // Calculate distance between consecutive points
  const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  // Normalize distance and invert for pressure (0 = fast/low pressure, 1 = slow/high pressure)
  const normalizedDistance = Math.min(distance / maxDistance, 1);
  const basePressure = Math.max(0.1, 1 - normalizedDistance * 0.7); // Range: 0.1 to 1.0

  const constantPressure = 0.5;
  const pressure = constantPressure + (basePressure - constantPressure);

  return Math.max(0.1, Math.min(1.0, pressure));
};

export const getFreedrawStroke = (element: ExcalidrawFreeDrawElement) => {
  // Compose points as [x, y, pressure]
  let points: [number, number, number][];
  if (element.drawingConfigs?.fixedStrokeWidth) {
    points = element.points.map(
      ([x, y]: LocalPoint): [number, number, number] => [x, y, 1],
    );
  } else if (element.simulatePressure) {
    // Simulate pressure based on velocity between consecutive points
    points = element.points.map(([x, y]: LocalPoint, i) => [
      x,
      y,
      calculateVelocityBasedPressure(
        element.points,
        i,
        element.drawingConfigs?.fixedStrokeWidth,
      ),
    ]);
  } else {
    points = element.points.map(([x, y]: LocalPoint, i) => {
      const rawPressure = element.pressures?.[i] ?? 0.5;

      const amplifiedPressure = Math.pow(rawPressure, 0.6);
      const adjustedPressure = amplifiedPressure;

      return [x, y, clamp(adjustedPressure, 0.1, 1.0)];
    });
  }

  const streamline =
    element.drawingConfigs?.streamline ??
    getFreedrawConfig("default", getElementStrokeType(element)).streamline;
  const simplify =
    element.drawingConfigs?.simplify ??
    getFreedrawConfig("default", getElementStrokeType(element)).simplify;

  const laser = new LaserPointer({
    size: element.strokeWidth,
    streamline,
    simplify,
    sizeMapping: ({ pressure: t }) => {
      if (element.drawingConfigs?.fixedStrokeWidth) {
        return 0.6;
      }

      if (element.simulatePressure) {
        return 0.2 + t * 0.6;
      }

      return 0.2 + t * 0.8;
    },
  });

  for (const pt of points) {
    laser.addPoint(pt);
  }
  laser.close();

  return laser.getStrokeOutline();
};

/**
 * Generates an SVG path for a freedraw element using LaserPointer logic.
 * Uses actual pressure data if available, otherwise simulates pressure based on velocity.
 * No streamline, smoothing, or simulation is performed.
 */
export const getFreeDrawSvgPath = (
  element: ExcalidrawFreeDrawElement,
): string => {
  // legacy, for backwards compatibility
  if (element.drawingConfigs === null) {
    return _legacy_getFreeDrawSvgPath(element);
  }

  return getSvgPathFromStroke(getFreedrawStroke(element));
};

const roundPoint = (A: Point): string => {
  return `${round(A[0], 4, "round")},${round(A[1], 4, "round")} `;
};

const average = (A: Point, B: Point): string => {
  return `${round((A[0] + B[0]) / 2, 4, "round")},${round(
    (A[1] + B[1]) / 2,
    4,
    "round",
  )} `;
};

const getSvgPathFromStroke = (points: Point[]): string => {
  const len = points.length;

  if (len < 2) {
    return "";
  }

  let a = points[0];
  let b = points[1];

  if (len === 2) {
    return `M${roundPoint(a)}L${roundPoint(b)}`;
  }

  let result = "";

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += average(a, b);
  }

  return `M${roundPoint(points[0])}Q${roundPoint(points[1])}${average(
    points[1],
    points[2],
  )}${points.length > 3 ? "T" : ""}${result}L${roundPoint(points[len - 1])}`;
};

function _legacy_getFreeDrawSvgPath(element: ExcalidrawFreeDrawElement) {
  // If input points are empty (should they ever be?) return a dot
  const inputPoints = element.simulatePressure
    ? element.points
    : element.points.length
    ? element.points.map(([x, y], i) => [x, y, element.pressures[i]])
    : [[0, 0, 0.5]];

  // Consider changing the options for simulated pressure vs real pressure
  const options: StrokeOptions = {
    simulatePressure: element.simulatePressure,
    size: element.strokeWidth * 4.25,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t) => Math.sin((t * Math.PI) / 2), // https://easings.net/#easeOutSine
    last: !!element.lastCommittedPoint, // LastCommittedPoint is added on pointerup
  };

  return _legacy_getSvgPathFromStroke(
    getStroke(inputPoints as number[][], options),
  );
}

const med = (A: number[], B: number[]) => {
  return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
};

// Trim SVG path data so number are each two decimal points. This
// improves SVG exports, and prevents rendering errors on points
// with long decimals.
const TO_FIXED_PRECISION = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;

const _legacy_getSvgPathFromStroke = (points: number[][]): string => {
  if (!points.length) {
    return "";
  }

  const max = points.length - 1;

  return points
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ["M", points[0], "Q"],
    )
    .join(" ")
    .replace(TO_FIXED_PRECISION, "$1");
};
