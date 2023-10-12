import { CanvasSize } from "../types";

export function isPointerOutsideCanvas(
  canvasSize: CanvasSize,
  {
    x,
    y,
  }: {
    x: number;
    y: number;
  },
): boolean {
  if (canvasSize.mode !== "fixed") {
    return false;
  }
  return x < 0 || x > canvasSize.width || y < 0 || y > canvasSize.height;
}

export function shouldPreventPanOrZoom(canvasSize: CanvasSize): boolean {
  return canvasSize.mode === "fixed" && !!canvasSize.autoZoom;
}
