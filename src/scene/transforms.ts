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

  const normalizedCanvasWidth = canvas.width / context.getTransform().a;
  const normalizedCanvasHeight = canvas.height / context.getTransform().d;

  const previousMiddleOfTheCanvas = {
    x: (normalizedCanvasWidth / 2) * prevZoom,
    y: (normalizedCanvasHeight / 2) * prevZoom,
  };
  const newMiddleOfTheCanvas = {
    x: (normalizedCanvasWidth / 2) * zoom,
    y: (normalizedCanvasHeight / 2) * zoom,
  };
  const diffMiddleOfTheCanvas = {
    x: previousMiddleOfTheCanvas.x - newMiddleOfTheCanvas.x,
    y: previousMiddleOfTheCanvas.y - newMiddleOfTheCanvas.y,
  };

  return {
    x: parseFloat(diffMiddleOfTheCanvas.x.toFixed(8)),
    y: parseFloat(diffMiddleOfTheCanvas.y.toFixed(8)),
  };
}
