import { NormalizedZoomValue, PointerCoords, Zoom } from "../types";

export const getNewZoom = (
  newZoomValue: NormalizedZoomValue,
  prevZoom: Zoom,
  zoomOnViewportPoint: PointerCoords = { x: 0, y: 0 },
): Zoom => {
  return {
    value: newZoomValue,
    translation: {
      x:
        zoomOnViewportPoint.x -
        (zoomOnViewportPoint.x - prevZoom.translation.x) *
          (newZoomValue / prevZoom.value),
      y:
        zoomOnViewportPoint.y -
        (zoomOnViewportPoint.y - prevZoom.translation.y) *
          (newZoomValue / prevZoom.value),
    },
  };
};

export const normalizeZoomValue = (zoom: number): NormalizedZoomValue => {
  const normalizedZoom = parseFloat(zoom.toFixed(2));
  const clampedZoom = Math.max(0.1, Math.min(normalizedZoom, 2));
  return clampedZoom as NormalizedZoomValue;
};
