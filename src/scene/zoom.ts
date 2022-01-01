import { NormalizedZoomValue, PointerCoords, Zoom } from "../types";

export const getNewZoom = (
  newZoomValue: NormalizedZoomValue,
  prevZoom: Zoom,
  canvasOffset: { left: number; top: number },
  zoomOnViewportPoint: PointerCoords = { x: 0, y: 0 },
): Zoom => {
  return {
    value: newZoomValue,
    translation: {
      x:
        zoomOnViewportPoint.x -
        canvasOffset.left -
        (zoomOnViewportPoint.x - canvasOffset.left - prevZoom.translation.x) *
          (newZoomValue / prevZoom.value),
      y:
        zoomOnViewportPoint.y -
        canvasOffset.top -
        (zoomOnViewportPoint.y - canvasOffset.top - prevZoom.translation.y) *
          (newZoomValue / prevZoom.value),
    },
  };
};

export const getNormalizedZoom = (zoom: number): NormalizedZoomValue => {
  const normalizedZoom = parseFloat(zoom.toFixed(2));
  const clampedZoom = Math.max(0.1, Math.min(normalizedZoom, 30));
  return clampedZoom as NormalizedZoomValue;
};
