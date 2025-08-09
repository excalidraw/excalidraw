import { clamp, round } from "@excalidraw/math";

import type { NormalizedZoomValue } from "../types";
import { getZoomMin, getZoomMax } from "../obsidianUtils";

export const getNormalizedZoom = (zoom: number): NormalizedZoomValue => {
  return clamp(round(zoom, 6), getZoomMin(), getZoomMax()) as NormalizedZoomValue;
};

export const getNormalizedGridSize = (gridStep: number) => {
  return clamp(Math.round(gridStep), 1, 100);
};

export const getNormalizedGridStep = (gridStep: number) => {
  return clamp(Math.round(gridStep), 1, 100);
};
