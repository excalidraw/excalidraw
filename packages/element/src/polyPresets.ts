import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

export const POLY_PRESET_TYPES = new Set([
  "rectangle",
  "diamond",
  "triangle",
  "pentagon",
  "hexagon",
  "octagon",
  "semicircle",
  "trapezoid",
  "rightTrapezoid",
  "rightTriangle",
]);

export const isPolyPresetType = (type: string): boolean =>
  POLY_PRESET_TYPES.has(type);

/**
 * Compute polygon points for a 2D preset shape within a bounding box.
 * Points are in local coordinates relative to the element origin.
 *
 * For triangle/diamond/pentagon: origin is at center-top, points use negative x.
 * For rectangle and others: origin is at top-left corner.
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
    case "pentagon": {
      const rx = width / 2;
      const ry = height / 2;
      const pts: LocalPoint[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / 5;
        pts.push(
          pointFrom<LocalPoint>(
            rx * Math.cos(angle),
            ry + ry * Math.sin(angle),
          ),
        );
      }
      pts.push(pts[0]);
      return pts;
    }
    case "hexagon": {
      const rx = width / 2;
      const ry = height / 2;
      const cx = 0;
      const cy = ry;
      const pts: LocalPoint[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / 6;
        pts.push(
          pointFrom<LocalPoint>(
            cx + rx * Math.cos(angle),
            cy + ry * Math.sin(angle),
          ),
        );
      }
      pts.push(pts[0]);
      return pts;
    }
    case "octagon": {
      // Pointy-top octagon centered at origin (like pentagon/hexagon).
      const rx = width / 2;
      const ry = height / 2;
      const pts: LocalPoint[] = [];
      for (let i = 0; i < 8; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / 8;
        pts.push(
          pointFrom<LocalPoint>(
            rx * Math.cos(angle),
            ry + ry * Math.sin(angle),
          ),
        );
      }
      pts.push(pts[0]);
      return pts;
    }
    case "semicircle": {
      const rx = width / 2;
      const ry = height; // full height = arc height
      const cx = rx;
      const segments = 16;
      const pts: LocalPoint[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = Math.PI - (Math.PI * i) / segments;
        pts.push(
          pointFrom<LocalPoint>(
            cx + rx * Math.cos(angle),
            ry - ry * Math.sin(angle),
          ),
        );
      }
      pts.push(pts[0]);
      return pts;
    }
    case "trapezoid": {
      const inset = width * 0.2;
      return [
        pointFrom<LocalPoint>(inset, 0),
        pointFrom<LocalPoint>(width - inset, 0),
        pointFrom<LocalPoint>(width, height),
        pointFrom<LocalPoint>(0, height),
        pointFrom<LocalPoint>(inset, 0),
      ];
    }
    case "rightTrapezoid": {
      const inset = width * 0.25;
      return [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(width - inset, 0),
        pointFrom<LocalPoint>(width, height),
        pointFrom<LocalPoint>(0, height),
        pointFrom<LocalPoint>(0, 0),
      ];
    }
    case "rightTriangle":
      return [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(0, height),
        pointFrom<LocalPoint>(width, height),
        pointFrom<LocalPoint>(0, 0),
      ];
    default:
      return [pointFrom<LocalPoint>(0, 0)];
  }
};

/**
 * Get the element x offset for centering (shapes with origin at center-top).
 */
export const getPolyPresetXOffset = (type: string, width: number): number => {
  if (
    type === "triangle" ||
    type === "diamond" ||
    type === "pentagon" ||
    type === "hexagon" ||
    type === "octagon"
  ) {
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
  if (type === "semicircle") {
    return width / 2;
  }
  if (type === "trapezoid" || type === "rightTrapezoid") {
    return width * 0.7;
  }
  // rectangle, diamond, pentagon, octagon, rightTriangle: square
  return width;
};
