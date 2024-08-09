import type { LineSegment } from "../../utils";
import type { BoundingBox, Bounds } from "../element/bounds";
import type { AppState, Point } from "../types";
import { throttleRAF } from "../utils";
import { bootstrapCanvas, getNormalizedCanvasDimensions } from "./helpers";

let debugData: DebugElement[][] = [];

type DebugElement = {
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
  debugData.push([]);
};

export const debugClear = () => {
  debugData = [];
};

export const debugRenderer = throttleRAF(
  (canvas: HTMLCanvasElement, appState: AppState, scale: number) => {
    _debugRenderer(canvas, appState, scale);
  },
  { trailing: true },
);

const isPoint = (point: any): point is Point =>
  Array.isArray(point) && point.length === 2;

const isLineSegment = (segment: any): segment is LineSegment =>
  Array.isArray(segment) &&
  segment.length === 2 &&
  isPoint(segment[0]) &&
  isPoint(segment[0]);

const isBounds = (box: any): box is Bounds =>
  Array.isArray(box) &&
  box.length === 4 &&
  typeof box[0] === "number" &&
  typeof box[1] === "number" &&
  typeof box[2] === "number" &&
  typeof box[3] === "number";

const addToCurrentFrame = (element: DebugElement) => {
  if (debugData.length === 0) {
    debugData[0] = [];
  }
  debugData[debugData.length - 1].push(element);
};

const renderLine = (
  context: CanvasRenderingContext2D,

  segment: LineSegment,
  color: string,
) => {
  context.save();
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(segment[0][0], segment[0][1]);
  context.lineTo(segment[1][0], segment[1][1]);
  context.stroke();
  context.restore();
};

const renderOrigin = (context: CanvasRenderingContext2D, zoom: number) => {
  context.strokeStyle = "#888";
  context.save();
  context.beginPath();
  context.moveTo(-10 * zoom, -10 * zoom);
  context.lineTo(10 * zoom, 10 * zoom);
  context.moveTo(10 * zoom, -10 * zoom);
  context.lineTo(-10 * zoom, 10 * zoom);
  context.stroke();
  context.save();
};

const _debugRenderer = (
  canvas: HTMLCanvasElement,
  appState: AppState,
  scale: number,
) => {
  const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
    canvas,
    scale,
  );

  const context = bootstrapCanvas({
    canvas,
    scale,
    normalizedWidth,
    normalizedHeight,
  });

  // Apply zoom
  context.save();
  context.translate(
    appState.scrollX * appState.zoom.value,
    appState.scrollY * appState.zoom.value,
  );

  renderOrigin(context, appState.zoom.value);

  // Render all debug frames
  debugData.forEach((frame) => {
    frame.forEach((el) => {
      switch (true) {
        case isLineSegment(el.data):
          renderLine(context, el.data, el.color);
          break;
      }
    });
  });

  debugData = debugData.map((frame) => frame.filter((el) => el.permanent));
};
