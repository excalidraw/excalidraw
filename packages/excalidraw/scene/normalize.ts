import { clamp, round } from "../../math";
import { MAX_ZOOM, MIN_ZOOM } from "../constants";
import type { NormalizedZoomValue } from "../types";

export const getNormalizedZoom = (zoom: number): NormalizedZoomValue => {
  return clamp(round(zoom, 6), MIN_ZOOM, MAX_ZOOM) as NormalizedZoomValue;
};

export const getNormalizedGridSize = (gridStep: number) => {
  return clamp(Math.round(gridStep), 1, 100);
};

export const getNormalizedGridStep = (gridStep: number) => {
  return clamp(Math.round(gridStep), 1, 100);
};
