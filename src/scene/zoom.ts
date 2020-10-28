import { PointerCoords, Translation, Zoom } from "../types";

export const getZoomOrigin = (
  canvas: HTMLCanvasElement | null,
  scale: number,
) => {
  if (canvas === null) {
    return { x: 0, y: 0 };
  }
  const context = canvas.getContext("2d");
  if (context === null) {
    return { x: 0, y: 0 };
  }

  const normalizedCanvasWidth = canvas.width / scale;
  const normalizedCanvasHeight = canvas.height / scale;

  return {
    x: normalizedCanvasWidth / 2,
    y: normalizedCanvasHeight / 2,
  };
};

export const getNewZoom = (
  focusPoint: PointerCoords,
  zoomValue: number,
  preZoomTranslation: Translation,
  prevZoomValue: number,
): Zoom => {
  return {
    value: zoomValue,
    focusPoint: focusPoint,
    translation: {
      x:
        focusPoint.x -
        (focusPoint.x - preZoomTranslation.x) * (zoomValue / prevZoomValue),
      y:
        focusPoint.y -
        (focusPoint.y - preZoomTranslation.y) * (zoomValue / prevZoomValue),
    },
  };
};

export const getNormalizedZoom = (zoom: number): number => {
  const normalizedZoom = parseFloat(zoom.toFixed(2));
  const clampedZoom = Math.max(0.1, Math.min(normalizedZoom, 2));
  return clampedZoom;
};
