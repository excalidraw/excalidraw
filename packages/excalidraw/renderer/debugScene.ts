import type { AppState } from "../types";
import { throttleRAF } from "../utils";
import { bootstrapCanvas, getNormalizedCanvasDimensions } from "./helpers";

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
  context.scale(appState.zoom.value, appState.zoom.value);
};

export const debugRenderer = throttleRAF(
  (canvas: HTMLCanvasElement, appState: AppState, scale: number) => {
    _debugRenderer(canvas, appState, scale);
  },
  { trailing: true },
);
