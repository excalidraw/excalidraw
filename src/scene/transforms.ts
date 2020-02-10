import { SceneState } from "./types";

export function getXCoordinateWithSceneState(
  x: number,
  {
    scrollX,
    zoom,
  }: {
    scrollX: SceneState["scrollX"];
    zoom: SceneState["zoom"];
  },
): number {
  return (x + scrollX) * zoom;
}

export function getYCoordinateWithSceneState(
  y: number,
  {
    scrollY,
    zoom,
  }: {
    scrollY: SceneState["scrollY"];
    zoom: SceneState["zoom"];
  },
): number {
  return (y + scrollY) * zoom;
}

// Calculate the difference of the canvas' center based on zoom level
export function getZoomTranslation(
  canvas: HTMLCanvasElement,
  prevZoom: SceneState["zoom"],
  zoom: SceneState["zoom"],
) {
  const context = canvas.getContext("2d");
  if (context === null) {
    return { x: 0, y: 0 };
  }

  const normalizedCanvasWidth = canvas.width;
  const normalizedCanvasHeight = canvas.height;

  const zoomDiff = prevZoom - zoom;
  const diffMiddleOfTheCanvas = {
    x: (normalizedCanvasWidth * zoomDiff) / 2,
    y: (normalizedCanvasHeight * zoomDiff) / 2,
  };

  return {
    x: parseFloat(diffMiddleOfTheCanvas.x.toFixed(8)),
    y: parseFloat(diffMiddleOfTheCanvas.y.toFixed(8)),
  };
}
