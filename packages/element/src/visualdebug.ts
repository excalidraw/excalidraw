import {
  isLineSegment,
  lineSegment,
  pointDistanceSq,
  pointFrom,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";
import { type Bounds, isBounds } from "@excalidraw/common";
import {
  getElementBounds,
  intersectElementWithLineSegment,
  isFreeDrawElement,
  isLinearElement,
  isPathALoop,
} from "@excalidraw/element";

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";
import type { Curve } from "@excalidraw/math";
import type { LineSegment } from "@excalidraw/utils";

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
  data: LineSegment<GlobalPoint> | Curve<GlobalPoint> | DebugPolygon;
  permanent: boolean;
};

export type DebugPolygon = {
  type: "polygon";
  points: GlobalPoint[];
  fill?: boolean;
  close?: boolean;
};

export const debugDrawHitVolume = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  options?: {
    rays?: number;
    color?: string;
    fill?: boolean;
  },
) => {
  if (
    (isLinearElement(element) || isFreeDrawElement(element)) &&
    !isPathALoop(element.points)
  ) {
    return;
  }

  const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
  const center = pointFrom<GlobalPoint>((x1 + x2) / 2, (y1 + y2) / 2);
  const rays = options?.rays ?? 100;
  const radius = Math.max(x2 - x1, y2 - y1) * 2;
  const points: GlobalPoint[] = [];

  for (let i = 0; i < rays; i += 1) {
    const angle = (i / rays) * Math.PI * 2;
    const end = pointFrom<GlobalPoint>(
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
    );
    const hits = intersectElementWithLineSegment(
      element,
      elementsMap,
      lineSegment(center, end),
    );
    if (hits.length === 0) {
      continue;
    }
    hits.sort(pointDistanceSq);
    points.push(hits[0]);
  }

  if (points.length >= 3) {
    debugDrawPolygon(points, {
      color: options?.color ?? "orange",
      fill: options?.fill ?? true,
    });
  } else {
    console.warn(
      `debugDrawHitVolume: could not compute hit volume for element ${element.id}`,
    );
  }
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

export const debugDrawPolygon = (
  points: GlobalPoint[],
  opts?: {
    color?: string;
    permanent?: boolean;
    fill?: boolean;
    close?: boolean;
  },
) => {
  if (points.length < 2) {
    return;
  }

  addToCurrentFrame({
    color: opts?.color ?? "orange",
    permanent: !!opts?.permanent,
    data: {
      type: "polygon",
      points,
      fill: opts?.fill,
      close: opts?.close,
    },
  });
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
  (isBounds(box) ? [box] : box).forEach((bbox: Bounds) =>
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
    points: readonly LocalPoint[];
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
