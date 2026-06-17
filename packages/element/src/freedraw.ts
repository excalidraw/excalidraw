import { isMemberOf } from "@excalidraw/common";

import type { StrokeOptions } from "perfect-freehand";

import type { StrokeShape } from "./types";

type FreedrawStrokeProfile = Readonly<
  Pick<
    StrokeOptions,
    "thinning" | "smoothing" | "streamline" | "easing" | "start" | "end"
  > & {
    sizeMultiplier: number;
  }
>;

const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2);

export const DEFAULT_FREEDRAW_STROKE_SHAPE: StrokeShape = "pencil";

export const FREEDRAW_STROKE_SHAPES: readonly StrokeShape[] = [
  "pencil",
  "marker",
  "brush",
  "technical",
  "calligraphy",
];

const FREEDRAW_STROKE_PROFILES: Record<StrokeShape, FreedrawStrokeProfile> = {
  pencil: {
    sizeMultiplier: 4.25,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    easing: easeOutSine,
  },
  marker: {
    sizeMultiplier: 6,
    thinning: 0.12,
    smoothing: 0.65,
    streamline: 0.45,
    easing: easeOutSine,
  },
  brush: {
    sizeMultiplier: 5,
    thinning: 0.8,
    smoothing: 0.65,
    streamline: 0.4,
    easing: easeOutSine,
    start: {
      taper: 12,
      cap: true,
      easing: easeOutSine,
    },
    end: {
      taper: 18,
      cap: true,
      easing: easeOutSine,
    },
  },
  technical: {
    sizeMultiplier: 3,
    thinning: 0,
    smoothing: 0.45,
    streamline: 0.75,
    easing: (t) => t,
  },
  calligraphy: {
    sizeMultiplier: 5.5,
    thinning: 0.95,
    smoothing: 0.55,
    streamline: 0.35,
    easing: easeOutSine,
    start: {
      taper: 16,
      cap: false,
      easing: easeOutSine,
    },
    end: {
      taper: 24,
      cap: false,
      easing: easeOutSine,
    },
  },
};

export const isFreedrawStrokeShape = (value: unknown): value is StrokeShape =>
  typeof value === "string" && isMemberOf(FREEDRAW_STROKE_SHAPES, value);

export const normalizeFreedrawStrokeShape = (value: unknown): StrokeShape =>
  isFreedrawStrokeShape(value) ? value : DEFAULT_FREEDRAW_STROKE_SHAPE;

export const getFreedrawStrokeOptions = (
  strokeShape: unknown,
  strokeWidth: number,
  simulatePressure: boolean,
): StrokeOptions => {
  const { sizeMultiplier, ...profile } =
    FREEDRAW_STROKE_PROFILES[normalizeFreedrawStrokeShape(strokeShape)];

  return {
    ...profile,
    simulatePressure,
    size: strokeWidth * sizeMultiplier,
    last: true,
  };
};
