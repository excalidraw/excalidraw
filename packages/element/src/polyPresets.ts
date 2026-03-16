import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

export const POLY_PRESET_TYPES = new Set(["rectangle", "diamond", "triangle"]);

export const isPolyPresetType = (type: string): boolean =>
  POLY_PRESET_TYPES.has(type);

/**
 * Compute polygon points for a 2D preset shape within a bounding box.
 * Points are in local coordinates relative to the element origin.
 *
 * For triangle: origin is at top-center, points use negative x for left side.
 * For rectangle/diamond: origin is at top-left corner.
 */
export const computePolyPoints = (
  type: string,
  width: number,
  height: number,
): LocalPoint[] => {
  switch (type) {
    case "rectangle":
      return [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(width, 0),
        pointFrom<LocalPoint>(width, height),
        pointFrom<LocalPoint>(0, height),
        pointFrom<LocalPoint>(0, 0),
      ];
    case "diamond": {
      const halfW = width / 2;
      const halfH = height / 2;
      return [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(halfW, halfH),
        pointFrom<LocalPoint>(0, height),
        pointFrom<LocalPoint>(-halfW, halfH),
        pointFrom<LocalPoint>(0, 0),
      ];
    }
    case "triangle": {
      const halfW = width / 2;
      return [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(halfW, height),
        pointFrom<LocalPoint>(-halfW, height),
        pointFrom<LocalPoint>(0, 0),
      ];
    }
    default:
      return [pointFrom<LocalPoint>(0, 0)];
  }
};

/**
 * Get the element x offset for centering (triangle needs special handling).
 */
export const getPolyPresetXOffset = (type: string, width: number): number => {
  if (type === "triangle" || type === "diamond") {
    return width / 2;
  }
  return 0;
};

/**
 * Get the aspect ratio height for shift-constrained presets.
 */
export const getPolyPresetAspectHeight = (
  type: string,
  width: number,
): number => {
  if (type === "triangle") {
    return width * (Math.sqrt(3) / 2);
  }
  // rectangle and diamond: square
  return width;
};
