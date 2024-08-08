import type { LineSegment } from "../../utils";
import type { AppState, Point } from "../types";
import { throttleRAF } from "../utils";
import { bootstrapCanvas, getNormalizedCanvasDimensions } from "./helpers";

let debugData: DebugElement[][] = [];

type DebugElement = {
  color: string;
  data: LineSegment;
};

export const debugDrawLine = (segment: LineSegment, color: string = "red") => {
  addToCurrentFrame({
    color,
    data: segment,
  });
};

export const debugDrawPoint = (point: Point, color: string = "cyan") => {
  debugDrawLine(
    [
      [point[0] - 10, point[1] - 10],
      [point[0] + 10, point[1] + 10],
    ],
    color,
  );
  debugDrawLine(
    [
      [point[0] - 10, point[1] + 10],
      [point[0] + 10, point[1] - 10],
    ],
    color,
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
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(segment[0][0], segment[0][1]);
  context.lineTo(segment[1][0], segment[1][0]);
  context.stroke();
};

const renderOrigin = (context: CanvasRenderingContext2D, zoom: number) => {
  context.strokeStyle = "#888";
  context.beginPath();
  context.moveTo(-10 * zoom, -10 * zoom);
  context.lineTo(10 * zoom, 10 * zoom);
  context.moveTo(10 * zoom, -10 * zoom);
  context.lineTo(-10 * zoom, 10 * zoom);
  context.stroke();
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
};
