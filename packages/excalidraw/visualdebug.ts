import { isLineSegment, lineSegment, point, type GlobalPoint } from "../math";
import type { LineSegment } from "../utils";
import type { BoundingBox, Bounds } from "./element/bounds";
import { isBounds } from "./element/typeChecks";

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
  data: LineSegment<GlobalPoint>;
  permanent: boolean;
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
      point<GlobalPoint>(p[0] + xOffset - 10, p[1] + yOffset - 10),
      point<GlobalPoint>(p[0] + xOffset + 10, p[1] + yOffset + 10),
    ),
    {
      color: opts?.color ?? "cyan",
      permanent: opts?.permanent,
    },
  );
  debugDrawLine(
    lineSegment(
      point<GlobalPoint>(p[0] + xOffset - 10, p[1] + yOffset + 10),
      point<GlobalPoint>(p[0] + xOffset + 10, p[1] + yOffset - 10),
    ),
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
        lineSegment(
          point<GlobalPoint>(bbox.minX, bbox.minY),
          point<GlobalPoint>(bbox.maxX, bbox.minY),
        ),
        lineSegment(
          point<GlobalPoint>(bbox.maxX, bbox.minY),
          point<GlobalPoint>(bbox.maxX, bbox.maxY),
        ),
        lineSegment(
          point<GlobalPoint>(bbox.maxX, bbox.maxY),
          point<GlobalPoint>(bbox.minX, bbox.maxY),
        ),
        lineSegment(
          point<GlobalPoint>(bbox.minX, bbox.maxY),
          point<GlobalPoint>(bbox.minX, bbox.minY),
        ),
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
    color?: string;
    permanent?: boolean;
  },
) => {
  (isBounds(box) ? [box] : box).forEach((bbox) =>
    debugDrawLine(
      [
        lineSegment(
          point<GlobalPoint>(bbox[0], bbox[1]),
          point<GlobalPoint>(bbox[2], bbox[1]),
        ),
        lineSegment(
          point<GlobalPoint>(bbox[2], bbox[1]),
          point<GlobalPoint>(bbox[2], bbox[3]),
        ),
        lineSegment(
          point<GlobalPoint>(bbox[2], bbox[3]),
          point<GlobalPoint>(bbox[0], bbox[3]),
        ),
        lineSegment(
          point<GlobalPoint>(bbox[0], bbox[3]),
          point<GlobalPoint>(bbox[0], bbox[1]),
        ),
      ],
      {
        color: opts?.color ?? "green",
        permanent: !!opts?.permanent,
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
