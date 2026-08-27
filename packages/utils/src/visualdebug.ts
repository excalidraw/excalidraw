import {
  isLineSegment,
  lineSegment,
  pointFrom,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";

import { isBounds } from "@excalidraw/element";

import type { Curve } from "@excalidraw/math";
import type { LineSegment } from "@excalidraw/utils";

import type { Bounds } from "@excalidraw/element";

// The global data holder to collect the debug operations
declare global {
  interface Window {
    visualDebug?: {
      data: DebugElement[][];
      currentFrame?: number;
    };
  }
}

export type DebugElement = {
  color: string;
  data: LineSegment<GlobalPoint> | Curve<GlobalPoint>;
  permanent: boolean;
};

export const debugDrawCubicBezier = (
  c: Curve<GlobalPoint>,
  opts?: {
    color?: string;
    permanent?: boolean;
  },
) => {
  addToCurrentFrame({
    color: opts?.color ?? "purple",
    permanent: !!opts?.permanent,
    data: c,
  });
};

export const debugDrawLine = (
  segment: LineSegment<GlobalPoint> | LineSegment<GlobalPoint>[],
  opts?: {
    color?: string;
    permanent?: boolean;
  },
) => {
  const segments = (
    isLineSegment(segment) ? [segment] : segment
  ) as LineSegment<GlobalPoint>[];

  segments.forEach((data) =>
    addToCurrentFrame({
      color: opts?.color ?? "red",
      data,
      permanent: !!opts?.permanent,
    }),
  );
};

export const debugDrawPoint = (
  p: GlobalPoint,
  opts?: {
    color?: string;
    permanent?: boolean;
    fuzzy?: boolean;
  },
) => {
  const xOffset = opts?.fuzzy ? Math.random() * 3 : 0;
  const yOffset = opts?.fuzzy ? Math.random() * 3 : 0;

  debugDrawLine(
    lineSegment(
      pointFrom<GlobalPoint>(p[0] + xOffset - 10, p[1] + yOffset - 10),
      pointFrom<GlobalPoint>(p[0] + xOffset + 10, p[1] + yOffset + 10),
    ),
    {
      color: opts?.color ?? "cyan",
      permanent: opts?.permanent,
    },
  );
  debugDrawLine(
    lineSegment(
      pointFrom<GlobalPoint>(p[0] + xOffset - 10, p[1] + yOffset + 10),
      pointFrom<GlobalPoint>(p[0] + xOffset + 10, p[1] + yOffset - 10),
    ),
    {
      color: opts?.color ?? "cyan",
      permanent: opts?.permanent,
    },
  );
};

export const debugDrawBounds = (
  box: Bounds | Bounds[],
  opts?: {
    color?: string;
    permanent?: boolean;
  },
) => {
  (isBounds(box) ? [box] : box).forEach((bbox) =>
    debugDrawLine(
      [
        lineSegment(
          pointFrom<GlobalPoint>(bbox[0], bbox[1]),
          pointFrom<GlobalPoint>(bbox[2], bbox[1]),
        ),
        lineSegment(
          pointFrom<GlobalPoint>(bbox[2], bbox[1]),
          pointFrom<GlobalPoint>(bbox[2], bbox[3]),
        ),
        lineSegment(
          pointFrom<GlobalPoint>(bbox[2], bbox[3]),
          pointFrom<GlobalPoint>(bbox[0], bbox[3]),
        ),
        lineSegment(
          pointFrom<GlobalPoint>(bbox[0], bbox[3]),
          pointFrom<GlobalPoint>(bbox[0], bbox[1]),
        ),
      ],
      {
        color: opts?.color ?? "green",
        permanent: !!opts?.permanent,
      },
    ),
  );
};

export const debugDrawPoints = (
  {
    x,
    y,
    points,
  }: {
    x: number;
    y: number;
    points: LocalPoint[];
  },
  options?: any,
) => {
  points.forEach((p) =>
    debugDrawPoint(pointFrom<GlobalPoint>(x + p[0], y + p[1]), options),
  );
};

export const debugCloseFrame = () => {
  window.visualDebug?.data.push([]);
};

export const debugClear = () => {
  if (window.visualDebug?.data) {
    window.visualDebug.data = [];
  }
};

const addToCurrentFrame = (element: DebugElement) => {
  if (window.visualDebug?.data && window.visualDebug.data.length === 0) {
    window.visualDebug.data[0] = [];
  }
  window.visualDebug?.data &&
    window.visualDebug.data[window.visualDebug.data.length - 1].push(element);
};
