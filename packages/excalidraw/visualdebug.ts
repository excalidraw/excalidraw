import type { LineSegment } from "../utils";
import type { Vector } from "../utils/geometry/shape";
import type { BoundingBox, Bounds } from "./element/bounds";
import type { InteractiveCanvasAppState, Point } from "./types";

declare global {
  interface Window {
    v: {
      enabled: boolean;
      forceRefresh: () => void;
      frames: [
        readonly [number, number],
        readonly [number, number],
        string,
      ][][];
      current: number;
      frameOnly: boolean;
      clearFrames: () => void;
      newFrame: () => void;
      next: () => void;
      prev: () => void;
      all: () => void;
      frame: () => void;
      getLines: () => [
        readonly [number, number],
        readonly [number, number],
        string,
      ][];
    };
  }
}

window.v =
  window.v ||
  ({
    enabled: localStorage.getItem("window_v_enabled") !== null,
    enable: () => {
      window.v.enabled = true;
      localStorage.setItem("window_v_enabled", "yes");
    },
    disable: () => {
      window.v.enabled = false;
      localStorage.removeItem("window_v_enabled");
    },
    forceRefresh: () => {},
    frames: [[]],
    current: 0,
    frameOnly: false,
    clearFrames: () => {
      window.v.frames = [[]];
      window.v.current = 0;
    },
    newFrame: () => window.v?.frames.push([]),
    next: () => {
      window.v.current =
        window.v.current === window.v.frames.length - 1
          ? 0
          : window.v.current + 1;
      window.v.forceRefresh();
    },
    prev: () => {
      window.v.current =
        window.v.current === 0
          ? window.v.frames.length - 1
          : window.v.current - 1;
      window.v.forceRefresh();
    },
    all: () => {
      window.v.frameOnly = false;
      window.v.forceRefresh();
    },
    frame: () => {
      window.v.frameOnly = true;
      window.v.forceRefresh();
    },
    getLines: () => {
      return window.v.frameOnly
        ? window.v.frames[window.v.current]
        : window.v.frames.flatMap((frame) => frame);
    },
  } as Window["v"]);

export const renderVisualDebug = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  if (!window.v?.enabled) {
    return;
  }

  context.save();
  context.translate(
    appState.scrollX * appState.zoom.value,
    appState.scrollY * appState.zoom.value,
  );
  window.v?.getLines().forEach((line) => {
    context.strokeStyle = line[2];
    context.beginPath();
    context.moveTo(
      line[0][0] * appState.zoom.value,
      line[0][1] * appState.zoom.value,
    );
    context.lineTo(
      line[1][0] * appState.zoom.value,
      line[1][1] * appState.zoom.value,
    );
    context.stroke();
  });

  // Render scene [0, 0]
  context.strokeStyle = "#888";
  context.beginPath();
  context.moveTo(-10 * appState.zoom.value, -10 * appState.zoom.value);
  context.lineTo(10 * appState.zoom.value, 10 * appState.zoom.value);
  context.moveTo(10 * appState.zoom.value, -10 * appState.zoom.value);
  context.lineTo(-10 * appState.zoom.value, 10 * appState.zoom.value);
  context.stroke();
  context.restore();
};

export function debugClear() {
  if (import.meta.env.DEV || import.meta.env.MODE === "test") {
    window.v.clearFrames();
  }
}

export function debugNewFrame() {
  if (import.meta.env.DEV || import.meta.env.MODE === "test") {
    window.v.newFrame();
  }
}

export function debugDrawNormal(
  normal: Vector,
  segment: LineSegment,
  color: string = "cyan",
) {
  if (
    (import.meta.env.DEV || import.meta.env.MODE === "test") &&
    normal &&
    segment
  ) {
    const [cx, cy] = [
      (segment[0][0] + segment[1][0]) / 2,
      (segment[0][1] + segment[1][1]) / 2,
    ];
    const [nx, ny] = scaleVector(normalize(normal), 20);
    window.v.frames[window.v.frames.length - 1].push([
      [cx, cy],
      [cx + nx, cy + ny],
      color,
    ]);
  }
}

const scaleVector = (vector: Vector, scalar: number): Vector => [
  vector[0] * scalar,
  vector[1] * scalar,
];

const normalize = (vector: Vector): Vector => {
  const m = magnitude(vector);

  return [vector[0] / m, vector[1] / m];
};

const magnitude = (vector: Vector) =>
  Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);

export function debugDrawSegments(
  segments?: Readonly<LineSegment> | Readonly<LineSegment>[] | null,
  color: string = "green",
) {
  if (import.meta.env.DEV || import.meta.env.MODE === "test") {
    if (segments && !isSegment(segments)) {
      segments.forEach((segment) =>
        window.v.frames[window.v.frames.length - 1].push([
          segment[0],
          segment[1],
          color,
        ]),
      );
    } else if (segments) {
      window.v.frames[window.v.frames.length - 1].push([
        segments[0],
        segments[1],
        color,
      ]);
    }
  }
}

const isSegment = (
  candidate: Readonly<LineSegment> | Readonly<LineSegment>[],
): candidate is Readonly<LineSegment> =>
  candidate.length > 0 ? !Array.isArray(candidate[0][0]) : true;

export function debugDrawPoint(
  p: Point,
  color: string = "#FF1493",
  fuzzy = false,
) {
  if (import.meta.env.DEV || import.meta.env.MODE === "test") {
    const xOffset = fuzzy ? Math.random() * 3 : 0;
    const yOffset = fuzzy ? Math.random() * 3 : 0;

    window.v.frames[window.v.frames.length - 1].push([
      [p[0] + xOffset - 10, p[1] + yOffset - 10],
      [p[0] + xOffset + 10, p[1] + yOffset + 10],
      color,
    ]);
    window.v.frames[window.v.frames.length - 1].push([
      [p[0] + xOffset - 10, p[1] + yOffset + 10],
      [p[0] + xOffset + 10, p[1] + yOffset - 10],
      color,
    ]);
  }
}

export const debugDrawBoundingBox = (bbox: BoundingBox) => {
  debugDrawSegments([
    [
      [bbox.minX, bbox.minY],
      [bbox.maxX, bbox.minY],
    ],
    [
      [bbox.maxX, bbox.minY],
      [bbox.maxX, bbox.maxY],
    ],
    [
      [bbox.maxX, bbox.maxY],
      [bbox.minX, bbox.maxY],
    ],
    [
      [bbox.minX, bbox.maxY],
      [bbox.minX, bbox.minY],
    ],
  ]);
};

export const debugDrawBounds = (bbox: Bounds, color: string = "green") => {
  debugDrawSegments(
    [
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[1]],
      ],
      [
        [bbox[2], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      [
        [bbox[2], bbox[3]],
        [bbox[0], bbox[3]],
      ],
      [
        [bbox[0], bbox[3]],
        [bbox[0], bbox[1]],
      ],
    ],
    color,
  );
};
