import type { LineSegment } from "../utils";
import type { BoundingBox, Bounds } from "./element/bounds";
import { isBounds, isLineSegment } from "./element/typeChecks";
import type { Point } from "./types";

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
  data: LineSegment;
  permanent: boolean;
};

export const debugDrawLine = (
  segment: LineSegment | LineSegment[],
  opts?: {
    color?: string;
    permanent?: boolean;
  },
) => {
  (isLineSegment(segment) ? [segment] : segment).forEach((data) =>
    addToCurrentFrame({
      color: opts?.color ?? "red",
      data,
      permanent: !!opts?.permanent,
    }),
  );
};

export const debugDrawPoint = (
  point: Point,
  opts?: {
    color?: string;
    permanent?: boolean;
    fuzzy?: boolean;
  },
) => {
  const xOffset = opts?.fuzzy ? Math.random() * 3 : 0;
  const yOffset = opts?.fuzzy ? Math.random() * 3 : 0;

  debugDrawLine(
    [
      [point[0] + xOffset - 10, point[1] + yOffset - 10],
      [point[0] + xOffset + 10, point[1] + yOffset + 10],
    ],
    {
      color: opts?.color ?? "cyan",
      permanent: opts?.permanent,
    },
  );
  debugDrawLine(
    [
      [point[0] + xOffset - 10, point[1] + yOffset + 10],
      [point[0] + xOffset + 10, point[1] + yOffset - 10],
    ],
    {
      color: opts?.color ?? "cyan",
      permanent: opts?.permanent,
    },
  );
};

export const debugDrawBoundingBox = (
  box: BoundingBox | BoundingBox[],
  opts?: {
    color?: string;
    permanent?: boolean;
  },
) => {
  (Array.isArray(box) ? box : [box]).forEach((bbox) =>
    debugDrawLine(
      [
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
      ],
      {
        color: opts?.color ?? "cyan",
        permanent: opts?.permanent,
      },
    ),
  );
};

export const debugDrawBounds = (
  box: Bounds | Bounds[],
  opts?: {
    color: string;
    permanent: boolean;
  },
) => {
  (isBounds(box) ? [box] : box).forEach((bbox) =>
    debugDrawLine(
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
      {
        color: opts?.color ?? "green",
        permanent: opts?.permanent,
      },
    ),
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
