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

// Translate so zoom origin is center of the canvas
// The translation required is the difference in size based on zoom divided by 2 / scale
export function getZoomTranslation(
  canvas: HTMLCanvasElement,
  zoom: SceneState["zoom"],
) {
  const zoomTranslationX = (canvas.width - canvas.width * zoom) / 2;
  const zoomTranslattionY = (canvas.height - canvas.height * zoom) / 2;

  return { x: zoomTranslationX, y: zoomTranslattionY };
}
